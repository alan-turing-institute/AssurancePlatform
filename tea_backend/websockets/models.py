from django.db import models
from api.models import EAPUser


class AssuranceCaseConnection(models.Model):
    user = models.ForeignKey(
        EAPUser, on_delete=models.CASCADE, related_name="connected"
    )

    case_group_name = models.CharField(max_length=100, null=False)
    channel_name = models.CharField(max_length=100, null=False)
    connection_date = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.user.username} connected to {self.case_group_name}"
