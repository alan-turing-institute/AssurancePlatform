from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import EAPUser


class EAPUserCreationForm(UserCreationForm):
    class Meta:
        model = EAPUser
        fields = ("username",)


class EAPUserChangeForm(UserChangeForm):
    class Meta:
        model = EAPUser
        fields = UserChangeForm.Meta.fields  # type: ignore[attr-defined]
