from django.db import models
from django.utils import timezone
import datetime
from enum import Enum

# Create your models here.


class Shape(Enum):
    """
    Enum class to hold the various shapes for the objects on
    our diagram.
    """

    RECTANGLE = 0
    DIAMOND = 1
    ROUNDED_RECTANGLE = 2
    CYLINDER = 3


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
    shape = None

    def __str__(self):
        return self.name

    def was_published_recently(self):
        return self.created_date >= timezone.now() - datetime.timedelta(days=1)


class TopLevelNormativeGoal(CaseItem):
    keywords = models.CharField(max_length=3000)
    assurance_case = models.ForeignKey(
        AssuranceCase, related_name="goals", on_delete=models.CASCADE
    )
    shape = Shape.RECTANGLE

    def __str__(self):
        return self.name


class Context(CaseItem):
    shape = Shape.DIAMOND
    goal = models.ForeignKey(
        TopLevelNormativeGoal, related_name="context", on_delete=models.CASCADE
    )


class SystemDescription(CaseItem):
    shape = Shape.DIAMOND
    goal = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="system_description",
        on_delete=models.CASCADE,
    )


class PropertyClaim(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    parent = models.ForeignKey(
        TopLevelNormativeGoal, related_name="property_claims", on_delete=models.CASCADE
    )
    level = models.PositiveIntegerField()

    def save(self, *args, **kwargs):
        try:
            parent_level = self.parent.level
        except AttributeError:
            # If the parent is a TopLevelNormativeGoal rather than a PropertyClaim, it
            # doesn't have a level.
            parent_level = 0
        self.level = parent_level + 1
        super().save(*args, **kwargs)


class Argument(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    property_claim = models.ManyToManyField(PropertyClaim, related_name="arguments")


class EvidentialClaim(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    argument = models.ForeignKey(
        Argument, related_name="evidential_claims", on_delete=models.CASCADE
    )


class Evidence(CaseItem):
    URL = models.CharField(max_length=3000)
    shape = Shape.CYLINDER
    evidential_claim = models.ManyToManyField(EvidentialClaim, related_name="evidence")
