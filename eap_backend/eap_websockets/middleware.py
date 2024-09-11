import contextlib

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.authtoken.models import Token


@database_sync_to_async
def get_user(token_key):
    try:
        token = Token.objects.get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):

        query_string_elements: list[str] = scope["query_string"].decode().split("&")

        token_key: str | None = None
        with contextlib.suppress(ValueError):
            token_key = (
                dict(
                    key_and_value.split("=") for key_and_value in query_string_elements
                )
            ).get("token", None)
        scope["user"] = (
            AnonymousUser() if token_key is None else await get_user(token_key)
        )

        return await super().__call__(scope, receive, send)
