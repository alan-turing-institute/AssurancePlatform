"""
ASGI config for tea_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.2/howto/deployment/asgi/
"""

import os  # noqa: I001

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tea_backend.settings")
django_asgi_app = get_asgi_application()

from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

import websockets.routing  # noqa: E402
from websockets.middleware import TokenAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            TokenAuthMiddleware(URLRouter(websockets.routing.websocket_urlpatterns))
        ),
    }
)
