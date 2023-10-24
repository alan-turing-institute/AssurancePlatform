import requests
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
        # Get Access Token
        url = "https://github.com/login/oauth/access_token"
        params = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": auth_token,
        }
        headers = {"Accept": "application/json"}
        response = requests.post(url, headers=headers, params=params)
        response.raise_for_status()  # Will raise an error if not a 2XX response
        access_token = response.json().get("access_token")

        # Get User Emails
        user_info_url = "https://api.github.com/user/emails"
        headers = {
            "Authorization": f"token {access_token}",
            "content-type": "application/json",
        }
        response = requests.get(user_info_url, headers=headers)
        if response.status_code != 200:
            print(response.json())
            response.raise_for_status()

        response.raise_for_status()
        user_info = response.json()
        return user_info[0]


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
