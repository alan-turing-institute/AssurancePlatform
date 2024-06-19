import datetime
from enum import Enum

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

# Classes representing tables in the database for EAP app.


class EAPUser(AbstractUser):
    auth_provider = models.CharField(max_length=200, default="legacy")

    def __str__(self):
        return self.username


class EAPGroup(models.Model):
    name = models.CharField(max_length=200)
    created_date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        EAPUser, related_name="owned_groups", on_delete=models.CASCADE
    )
    member = models.ManyToManyField(EAPUser, related_name="all_groups")

    def __str__(self):
        return self.name


class GitHubRepository(models.Model):
    name = models.CharField(max_length=200)
    url = models.URLField()
    description = models.TextField(blank=True, null=True)
    created_date = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        EAPUser, related_name="github_repositories", on_delete=models.CASCADE
    )

    def __str__(self):
        return self.name


class Shape(Enum):
    """
    Enum class to hold the various shapes for the objects on
    our diagram.
    """

    RECTANGLE = 0
    DIAMOND = 1
    ROUNDED_RECTANGLE = 2
    CYLINDER = 3
    PARALLELOGRAM = 4


class CaseItem(models.Model):
    """A class that all the assurance case items inherit from.

    CaseItem is an abstract base class, meaning that it's not meant to have its own
    table.
    """

    name = models.CharField(max_length=200)
    short_description = models.CharField(max_length=1000)
    long_description = models.CharField(max_length=3000)
    shape = Shape
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class AssuranceCase(models.Model):
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=1000)
    created_date = models.DateTimeField(auto_now_add=True)
    lock_uuid = models.CharField(max_length=50, default=None, null=True, blank=True)
    owner = models.ForeignKey(
        EAPUser, related_name="cases", on_delete=models.CASCADE, null=True
    )
    edit_groups = models.ManyToManyField(
        EAPGroup, related_name="editable_cases", blank=True
    )
    view_groups = models.ManyToManyField(
        EAPGroup, related_name="viewable_cases", blank=True
    )
    shape = None
    color_profile = models.CharField(max_length=200, default="default")

    def __str__(self):
        return self.name

    def was_published_recently(self):
        return self.created_date >= timezone.now() - datetime.timedelta(days=1)


class Comment(models.Model):
    author = models.ForeignKey(
        EAPUser, related_name="comments", on_delete=models.CASCADE
    )
    assurance_case = models.ForeignKey(
        AssuranceCase, related_name="comments", on_delete=models.CASCADE
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author} on {self.assurance_case}"

    class Meta:
        ordering = ["created_at"]


class TopLevelNormativeGoal(CaseItem):
    keywords = models.CharField(max_length=3000)
    assurance_case = models.ForeignKey(
        AssuranceCase, related_name="goals", on_delete=models.CASCADE
    )
    shape = Shape.RECTANGLE

    def __str__(self):
        return self.name


class Context(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    goal = models.ForeignKey(
        TopLevelNormativeGoal, related_name="context", on_delete=models.CASCADE
    )


class Strategy(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    goal = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="strategies",
        on_delete=models.CASCADE,
    )

    def __str__(self):
        return self.name


class PropertyClaim(CaseItem):
    class ClaimType(models.TextChoices):
        """Enum class for different types of property claims."""

        SYSTEM = "System claim"
        PROJECT = "Project claim"

    shape = Shape.RECTANGLE
    claim_type = models.CharField(
        max_length=32, choices=ClaimType.choices, default=ClaimType.PROJECT
    )
    goal = models.ForeignKey(
        TopLevelNormativeGoal,
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )
    property_claim = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )
    strategy = models.ForeignKey(
        Strategy,
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )

    level = models.PositiveIntegerField()

    def save(self, *args, **kwargs):
        parent_count = sum(
            [bool(self.goal), bool(self.strategy), bool(self.property_claim)]
        )

        if parent_count != 1:
            raise ValueError("A PropertyClaim should have exactly one parent.")

        if self.property_claim is not None and self.property_claim.pk == self.pk:
            raise ValueError("A PropertyClaim cannot be the parent of itself.")

        try:
            parent_level = self.property_claim.level
        except AttributeError:
            parent_level = 0

        self.level = parent_level + 1

        super().save(*args, **kwargs)


class Evidence(CaseItem):
    URL = models.CharField(max_length=3000)
    shape = Shape.CYLINDER
    property_claim = models.ManyToManyField(PropertyClaim, related_name="evidence")
