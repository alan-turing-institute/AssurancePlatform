import json
from datetime import datetime
from typing import cast

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from channels.layers import get_channel_layer
from django.contrib.auth.models import AnonymousUser
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from django.db.models.query import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from eap_api.models import EAPUser
from eap_api.serializers import UsernameAwareUserSerializer

from .models import AssuranceCaseConnection


class AssuranceCaseConsumer(WebsocketConsumer):
    def connect(self):
        self.case_id: int = int(self.scope["url_route"]["kwargs"]["case_id"])
        user: EAPUser | AnonymousUser = self.scope["user"]
        self.case_group_name: str | None = None
        self.user_data: dict | None = None

        if user.is_authenticated:
            user_serializer = UsernameAwareUserSerializer(user)
            self.user_data = cast(dict, user_serializer.data)

            self.case_group_name = f"assurance_case_{self.case_id}"

            async_to_sync(self.channel_layer.group_add)(  # type: ignore  # noqa: PGH003
                self.case_group_name, self.channel_name
            )

            persist_connection(user, self.case_group_name, self.channel_name)
            self.accept()
            current_connections: str = json.dumps(
                get_current_connections(self.case_group_name), cls=DjangoJSONEncoder
            )
            self.send(text_data=current_connections)
        else:
            self.close()

    def disconnect(self, code):

        user: EAPUser | AnonymousUser = self.scope["user"]

        if self.case_group_name is not None:
            async_to_sync(self.channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
                self.case_group_name, self.channel_name
            )
        remove_connection(user, self.case_group_name, self.channel_name)
        return super().disconnect(code)

    def receive(self, text_data=None, _=None):
        data_as_json: dict = json.loads(cast(str, text_data))
        message_content: str = data_as_json["content"]
        now: datetime = timezone.now()

        if self.user_data is not None:
            async_to_sync(self.channel_layer.group_send)(  # type: ignore  # noqa: PGH003
                self.case_group_name,
                {
                    "type": "case_message",
                    "content": message_content,
                    "username": self.user_data["username"],
                    "user_id": self.user_data["id"],
                    "datetime": now.isoformat(),
                },
            )

    def case_message(self, event: dict):
        self.send(text_data=json.dumps(event))


def persist_connection(
    user: EAPUser | AnonymousUser,
    case_group_name: str | None,
    channel_name: str,
) -> None:
    user_connections: QuerySet[AssuranceCaseConnection] = (
        AssuranceCaseConnection.objects.filter(
            user__pk=user.pk, case_group_name=case_group_name
        )
    )

    channel_layer = get_channel_layer()
    for user_connection in user_connections:
        async_to_sync(channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
            case_group_name, user_connection.channel_name
        )

        user_connection.delete()

    AssuranceCaseConnection.objects.create(
        user=user, case_group_name=case_group_name, channel_name=channel_name
    )


def remove_connection(
    user: EAPUser | AnonymousUser, case_group_name: str | None, channel_name: str
) -> None:
    connection = get_object_or_404(
        AssuranceCaseConnection,
        Q(user=user),
        Q(case_group_name=case_group_name),
        Q(channel_name=channel_name),
    )

    connection.delete()


def get_current_connections(case_group_name: str) -> list[dict]:
    current_connections: QuerySet[AssuranceCaseConnection] = (
        AssuranceCaseConnection.objects.filter(case_group_name=case_group_name)
    )

    return [
        {
            "username": UsernameAwareUserSerializer(connection.user).data["username"],
            "connection_date": connection.connection_date,
        }
        for connection in current_connections
    ]
