import json
import logging
from typing import cast

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from channels.layers import get_channel_layer
from django.contrib.auth.models import AnonymousUser
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models.query import QuerySet
from django.utils import timezone
from eap_api.models import EAPUser
from eap_api.serializers import UsernameAwareUserSerializer

from .models import AssuranceCaseConnection


class AssuranceCaseConsumer(WebsocketConsumer):
    def connect(self):
        self.case_id: int = int(self.scope["url_route"]["kwargs"]["case_id"])
        user: EAPUser | AnonymousUser = self.scope["user"]
        self.case_group_name: str | None = None
        self.user_data: dict = {}

        if user.is_authenticated:
            user_serializer = UsernameAwareUserSerializer(user)
            self.user_data = cast(dict, user_serializer.data)
            self.case_group_name = f"assurance_case_{self.case_id}"

            async_to_sync(self.channel_layer.group_add)(  # type: ignore  # noqa: PGH003
                self.case_group_name, self.channel_name
            )

            self.persist_connection()
            self.accept()
            async_to_sync(self.channel_layer.group_send)(  # type: ignore  # noqa: PGH003
                self.case_group_name,
                self.get_connections_message(),
            )
        else:
            self.close()

    def get_connections_message(self) -> dict:
        return {
            "type": "case_message",
            "content": {"current_connections": self.get_current_connections()},
            "datetime": timezone.now().isoformat(),
        }

    def disconnect(self, code):

        if self.case_group_name is not None:
            async_to_sync(self.channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
                self.case_group_name, self.channel_name
            )
            self.remove_connection()

            async_to_sync(self.channel_layer.group_send)(  # type: ignore  # noqa: PGH003
                self.case_group_name,
                self.get_connections_message(),
            )
        return super().disconnect(code)

    def receive(self, text_data=None, _=None):

        message_content: str = ""
        is_ping_message: bool = False
        try:
            data_as_json: dict = json.loads(cast(str, text_data))
            message_content: str = data_as_json["content"]
            is_ping_message = message_content == "ping"
        except (json.JSONDecodeError, KeyError) as error:
            logging.warning(
                "Cannot parse message. Context: %s",
                {"text_data": text_data, "error": error},
            )
            message_content = f"ERROR: Could not parse JSON message: `{text_data}`"

        if self.user_data is not None and not is_ping_message:
            async_to_sync(self.channel_layer.group_send)(  # type: ignore  # noqa: PGH003
                self.case_group_name,
                {
                    "type": "case_message",
                    "content": message_content,
                    "username": self.user_data["username"],
                    "id": self.user_data["id"],
                    "datetime": timezone.now().isoformat(),
                },
            )

    def case_message(self, event: dict):
        self.send(text_data=json.dumps(event, cls=DjangoJSONEncoder))

    def remove_connection(self) -> None:

        try:
            connection = AssuranceCaseConnection.objects.get(
                user=EAPUser.objects.get(pk=self.user_data["id"]),
                case_group_name=self.case_group_name,
                channel_name=self.channel_name,
            )
            connection.delete()
        except (AssuranceCaseConnection.DoesNotExist, TypeError) as error:
            logging.warning(
                "Error on remove: Could locate connection. Context: %s",
                {
                    "user": self.user_data,
                    "case_group_name": self.case_group_name,
                    "channel_name": self.channel_name,
                    "error": error,
                },
            )

    def get_current_connections(self) -> list[dict]:
        current_connections: QuerySet[AssuranceCaseConnection] = (
            AssuranceCaseConnection.objects.filter(case_group_name=self.case_group_name)
        )

        return [
            {
                "user": {
                    "username": UsernameAwareUserSerializer(connection.user).data[
                        "username"
                    ],  # type: ignore  # noqa: PGH003
                    "id": connection.user.pk,
                },
                "connection_date": connection.connection_date,
            }
            for connection in current_connections
        ]

    def persist_connection(self) -> None:
        user_model: EAPUser = EAPUser.objects.get(pk=self.user_data["id"])

        user_connections: QuerySet[
            AssuranceCaseConnection
        ] = AssuranceCaseConnection.objects.filter(
            user=user_model, case_group_name=self.case_group_name  # type: ignore  # noqa: PGH003
        )

        channel_layer = get_channel_layer()
        for user_connection in user_connections:
            async_to_sync(channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
                self.case_group_name, user_connection.channel_name
            )

            user_connection.delete()

        AssuranceCaseConnection.objects.create(
            user=user_model,
            case_group_name=self.case_group_name,
            channel_name=self.channel_name,
        )
