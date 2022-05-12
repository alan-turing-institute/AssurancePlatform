from django import forms
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from .models import EAPUser


class EAPUserCreationForm(UserCreationForm):
    class Meta:
        model = EAPUser
        fields = ("email",)


class EAPUserChangeForm(UserChangeForm):
    class Meta:
        model = EAPUser
        fields = UserChangeForm.Meta.fields
