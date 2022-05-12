from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from .models import (
    AssuranceCase,
    EAPUser,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    EvidentialClaim,
    Evidence,
)
from .forms import EAPUserChangeForm, EAPUserCreationForm


class EAPUserAdmin(UserAdmin):
    add_form = EAPUserCreationForm
    form = EAPUserChangeForm
    model = EAPUser
    list_display = ["email"]


# Register your models here.

admin.site.register(AssuranceCase)
admin.site.register(EAPUser, EAPUserAdmin)
admin.site.register(TopLevelNormativeGoal)
admin.site.register(Context)
admin.site.register(SystemDescription)
admin.site.register(PropertyClaim)
admin.site.register(EvidentialClaim)
admin.site.register(Evidence)
