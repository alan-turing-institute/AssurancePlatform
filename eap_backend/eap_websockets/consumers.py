import json
from typing import cast

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer


class AssuranceCaseConsumer(WebsocketConsumer):
    def connect(self):
        self.case_id: int = int(self.scope["url_route"]["kwargs"]["case_id"])
        self.case_group_name: str = f"assurance_case_{self.case_id}"

        async_to_sync(self.channel_layer.group_add)(  # type: ignore  # noqa: PGH003
            self.case_group_name, self.channel_name
        )

        self.accept()

    def disconnect(self, _):

        async_to_sync(self.channel_layer.group_discard)(  # type: ignore  # noqa: PGH003
            self.case_group_name, self.channel_name
        )

    def receive(self, text_data=None, _=None):
        data_as_json: dict = json.loads(cast(str, text_data))
        message_content: str = data_as_json["content"]

        async_to_sync(self.channel_layer.group_send)(  # type: ignore  # noqa: PGH003
            self.case_group_name, {"type": "case_message", "content": message_content}
        )

    def case_message(self, event: dict):
        content: str = event["content"]

        self.send(text_data=json.dumps({"content": content}))
