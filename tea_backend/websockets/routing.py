from django.urls import re_path

from . import consumers

websocket_urlpatterns: list = [
    re_path(r"ws/case/(?P<case_id>\w+)/$", consumers.AssuranceCaseConsumer.as_asgi()),
]
