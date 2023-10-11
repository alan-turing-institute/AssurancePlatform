import json
import urllib.request as requests

from django.conf import settings
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed

from .models import EAPUser


class Github:
    """
    Github class to fetch the user info and return it
    """

    @staticmethod
    def validate(auth_token):
        """
        validate method Queries the GitHub URL to fetch the user info
        """

        try:
            url = "https://github.com/login/oauth/access_token?client_id={}&client_secret={}&code={}".format(
                settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET, auth_token
            )
            req = requests.urlopen(url)
            reply = req.read()
            access_token = (reply.decode("utf-8").split("&"))[0][13:]
            headers = {
                "Authorization": f"token {access_token}",
                "content-type": "application/json",
                "Access-Control-Expose-Headers": "ETag, Link, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval",
            }
            user_info_url = "https://api.github.com/user/emails"
            req = requests.Request(user_info_url, headers=headers)
            response = requests.urlopen(req)
            response = response.read()
            data = response.decode("utf-8")
            user_info = json.loads(data)
            return user_info[0]
        except Exception:
            return "The token is either invalid or has expired"


def register_social_user(provider, email):
    filtered_user_by_email = EAPUser.objects.filter(email=email)
    if filtered_user_by_email.exists():
        if provider == filtered_user_by_email[0].auth_provider:
            new_user = EAPUser.objects.get(email=email)

            registered_user = EAPUser.objects.get(email=email)
            registered_user.check_password(settings.GITHUB_CLIENT_SECRET)

            Token.objects.filter(user=registered_user).delete()
            Token.objects.create(user=registered_user)
            new_token = list(
                Token.objects.filter(user_id=registered_user).values("key")
            )

            return {
                "username": registered_user.username,
                "email": registered_user.email,
                "token": str(new_token[0]["key"]),
            }

        else:
            raise AuthenticationFailed(
                detail="Please continue your login using "
                + filtered_user_by_email[0].auth_provider
            )

    else:
        user = {
            "username": email,
            "email": email,
            "password": settings.GITHUB_CLIENT_SECRET,  # Dummy password for now
            "auth_provider": "github",
        }
        user = EAPUser.objects.create_user(**user)
        user.is_active = True
        user.auth_provider = provider
        user.save()
        new_user = EAPUser.objects.get(email=email)
        new_user.check_password(settings.GITHUB_CLIENT_SECRET)
        Token.objects.create(user=new_user)
        new_token = list(Token.objects.filter(user_id=new_user).values("key"))
        return {
            "email": new_user.email,
            "username": new_user.username,
            "token": str(new_token[0]["key"]),
        }
