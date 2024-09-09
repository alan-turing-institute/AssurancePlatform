import json
from datetime import datetime
from typing import cast

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from eap_api.models import EAPUser
from eap_api.serializers import UsernameAwareUserSerializer


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

            self.accept()
        else:
            self.close()

    def disconnect(self, code):
        if self.case_group_name is not None:
            async_to_sync(self.channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
                self.case_group_name, self.channel_name
            )
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
