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
admin.site.register(Context)
admin.site.register(SystemDescription)
admin.site.register(PropertyClaim)
admin.site.register(Argument)
admin.site.register(EvidentialClaim)
admin.site.register(Evidence)
