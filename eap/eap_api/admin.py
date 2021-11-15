from django.contrib import admin
from .models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    Argument,
    EvidentialClaim,
    Evidence,
)


# Register your models here.

admin.site.register(AssuranceCase)
admin.site.register(TopLevelNormativeGoal)