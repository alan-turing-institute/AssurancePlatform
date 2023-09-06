from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .forms import EAPUserChangeForm, EAPUserCreationForm
from .models import (
    AssuranceCase,
    EAPUser,
    Evidence,
    EvidentialClaim,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
)


class EAPUserAdmin(UserAdmin):
    add_form = EAPUserCreationForm
    form = EAPUserChangeForm
    model = EAPUser
    list_display = ["username"]


# Register your models here.

admin.site.register(AssuranceCase)
admin.site.register(EAPUser, EAPUserAdmin)
admin.site.register(TopLevelNormativeGoal)
admin.site.register(Strategy)
admin.site.register(PropertyClaim)
admin.site.register(EvidentialClaim)
admin.site.register(Evidence)
