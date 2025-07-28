import datetime
import uuid
from enum import Enum

from django.conf import settings  # Ensure we use the correct user model
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

# Classes representing tables in the database for EAP app.


class EAPUser(AbstractUser):
    auth_provider: models.CharField = models.CharField(max_length=200, default="legacy")
    auth_username: models.CharField = models.CharField(max_length=200, default="")

    def __str__(self):
        return self.username


class EAPGroup(models.Model):
    name: models.CharField = models.CharField(max_length=200)
    created_date: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    owner: models.ForeignKey = models.ForeignKey(
        EAPUser, related_name="owned_groups", on_delete=models.CASCADE
    )
    member: models.ManyToManyField = models.ManyToManyField(EAPUser, related_name="all_groups")

    def __str__(self):
        return self.name


class GitHubRepository(models.Model):
    name: models.CharField = models.CharField(max_length=200)
    url: models.URLField = models.URLField()
    description: models.TextField = models.TextField(blank=True, null=True)
    created_date: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    owner: models.ForeignKey = models.ForeignKey(
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

    name: models.CharField = models.CharField(max_length=200, blank=True)
    short_description: models.CharField = models.CharField(max_length=1000)
    long_description: models.CharField = models.CharField(max_length=3000)
    shape: Shape
    created_date: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    in_sandbox: models.BooleanField = models.BooleanField(default=False)

    class Meta:
        abstract = True


class AssuranceCase(models.Model):
    name: models.CharField = models.CharField(max_length=200)
    description: models.CharField = models.CharField(max_length=1000)
    created_date: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    lock_uuid: models.CharField = models.CharField(
        max_length=50, default=None, null=True, blank=True
    )
    owner: models.ForeignKey = models.ForeignKey(
        EAPUser, related_name="cases", on_delete=models.CASCADE, null=True
    )
    edit_groups: models.ManyToManyField = models.ManyToManyField(
        EAPGroup, related_name="editable_cases", blank=True
    )
    view_groups: models.ManyToManyField = models.ManyToManyField(
        EAPGroup, related_name="viewable_cases", blank=True
    )

    review_groups: models.ManyToManyField = models.ManyToManyField(
        EAPGroup, related_name="reviewable_cases", blank=True
    )
    shape = None
    color_profile: models.CharField = models.CharField(max_length=200, default="default")
    published: models.BooleanField = models.BooleanField(default=False)
    published_date: models.DateTimeField = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name

    def was_published_recently(self):
        return self.created_date >= timezone.now() - datetime.timedelta(days=1)


class TopLevelNormativeGoal(CaseItem):
    keywords: models.CharField = models.CharField(max_length=3000)
    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase, related_name="goals", on_delete=models.CASCADE
    )
    # shape = Shape.RECTANGLE
    assumption: models.TextField = models.TextField(blank=True, default="")

    def __str__(self):
        return self.name


class Context(CaseItem):
    shape: Shape = Shape.ROUNDED_RECTANGLE
    goal: models.ForeignKey = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="context",
        on_delete=models.CASCADE,
        null=True,
    )

    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="contexts",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )


class Strategy(CaseItem):
    shape: Shape = Shape.ROUNDED_RECTANGLE
    assumption: models.TextField = models.TextField(blank=True, default="")
    justification: models.TextField = models.TextField(blank=True, default="")
    goal: models.ForeignKey = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="strategies",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )

    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="strategies",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )

    def __str__(self):
        return self.name


class PropertyClaim(CaseItem):
    class ClaimType(models.TextChoices):
        """Enum class for different types of property claims."""

        SYSTEM = "System claim"
        PROJECT = "Project claim"

    shape: Shape = Shape.RECTANGLE
    assumption: models.TextField = models.TextField(blank=True, default="")
    claim_type: models.CharField = models.CharField(
        max_length=32, choices=ClaimType.choices, default=ClaimType.PROJECT
    )
    goal: models.ForeignKey = models.ForeignKey(
        TopLevelNormativeGoal,
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )
    property_claim: models.ForeignKey = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )
    strategy: models.ForeignKey = models.ForeignKey(
        Strategy,
        null=True,
        blank=True,
        related_name="property_claims",
        on_delete=models.CASCADE,
    )

    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="property_claims",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )

    level: models.PositiveIntegerField = models.PositiveIntegerField()

    def save(self, *args, **kwargs):
        parent_count = sum([bool(self.goal), bool(self.strategy), bool(self.property_claim)])

        error_message: str = ""
        if parent_count > 1:
            error_message = "A PropertyClaim should have at most one parent."
            raise ValueError(error_message)

        if self.property_claim is not None and self.property_claim.pk == self.pk:
            error_message = "A PropertyClaim cannot be the parent of itself."
            raise ValueError(error_message)

        try:
            parent_level = self.property_claim.level  # type:ignore[attr-defined]
        except AttributeError:
            parent_level = 0

        self.level = parent_level + 1

        super().save(*args, **kwargs)


class Evidence(CaseItem):
    URL: models.CharField = models.CharField(max_length=3000, null=True, blank=True)
    shape: Shape = Shape.CYLINDER
    property_claim: models.ManyToManyField = models.ManyToManyField(
        PropertyClaim, related_name="evidence"
    )

    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="evidence",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )


class AssuranceCaseImage(models.Model):
    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="case_image",
        on_delete=models.CASCADE,
        unique=True,
    )
    image: models.ImageField = models.ImageField(upload_to="images/", default=None)


class Comment(models.Model):
    author: models.ForeignKey = models.ForeignKey(
        EAPUser, related_name="comments", on_delete=models.CASCADE
    )

    assurance_case: models.ForeignKey = models.ForeignKey(
        AssuranceCase,
        related_name="comments",
        on_delete=models.CASCADE,
        null=True,
        default=None,
    )
    goal: models.ForeignKey = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="comments",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )
    strategy: models.ForeignKey = models.ForeignKey(
        Strategy,
        related_name="comments",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )
    property_claim: models.ForeignKey = models.ForeignKey(
        PropertyClaim,
        related_name="comments",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )
    evidence: models.ForeignKey = models.ForeignKey(
        Evidence,
        related_name="comments",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )
    context: models.ForeignKey = models.ForeignKey(
        Context,
        related_name="comments",
        on_delete=models.CASCADE,
        default=None,
        null=True,
    )

    content: models.TextField = models.TextField()
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.author} on {self.assurance_case}"

    class Meta:
        ordering = ["created_at"]


class PublishedAssuranceCase(models.Model):
    id: models.UUIDField = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assurance_case: models.ForeignKey = models.ForeignKey("AssuranceCase", on_delete=models.CASCADE)
    # case_study = models.ForeignKey("CaseStudy", on_delete=models.CASCADE)
    title: models.CharField = models.CharField(max_length=255)
    description: models.CharField = models.CharField(max_length=1000, null=True, blank=True)
    content: models.JSONField = models.JSONField()  # Stores full assurance case details
    created_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Snapshot of {self.title} for Case Study {self.case_study.id}"


class CaseStudy(models.Model):
    id: models.AutoField = models.AutoField(primary_key=True)
    title: models.CharField = models.CharField(max_length=255)
    description: models.TextField = models.TextField(blank=True, null=True)
    authors: models.CharField = models.CharField(max_length=255, blank=True, null=True)
    category: models.CharField = models.CharField(max_length=100, blank=True, null=True)
    type: models.CharField = models.CharField(max_length=100, blank=True, null=True)
    published_date: models.DateTimeField = models.DateTimeField(blank=True, null=True)
    last_modified_on: models.DateTimeField = models.DateTimeField(auto_now=True)
    created_on: models.DateTimeField = models.DateTimeField(auto_now_add=True)
    sector: models.CharField = models.CharField(max_length=100, blank=True, null=True)
    contact: models.EmailField = models.EmailField(blank=True, null=True)
    assurance_cases: models.ManyToManyField = models.ManyToManyField(
        PublishedAssuranceCase, blank=True
    )
    image: models.URLField = models.URLField(blank=True, null=True)
    published: models.BooleanField = models.BooleanField(default=False)

    # Add the owner field
    owner: models.ForeignKey = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # Dynamically uses your custom user model
        related_name="case_study",
        on_delete=models.CASCADE,
        null=True,
    )

    def __str__(self):
        return self.title


class CaseStudyFeatureImage(models.Model):
    case_study: models.OneToOneField = models.OneToOneField(
        CaseStudy, on_delete=models.CASCADE, related_name="feature_image"
    )
    image: models.ImageField = models.ImageField(upload_to="case_study_images/")
    uploaded_at: models.DateTimeField = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feature Image for {self.case_study.title}"
