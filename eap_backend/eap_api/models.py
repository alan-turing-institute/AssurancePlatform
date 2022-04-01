from django.db import models
from django.utils import timezone
import datetime
from enum import Enum

# Create your models here.


class LevelError(Exception):
    def __init__(self, case_item):
        msg = (
            "Can't save the following case item, because its parents aren't all "
            f"one level above it: {case_item}"
        )
        super().__init__(case_item)


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
    created_date = models.DateTimeField(auto_now_add=True)
    shape = Shape
    level = models.PositiveIntegerField()

    class Meta:
        abstract = True

    def _check_parent_levels(self, *parent_lists):
        """Given lists of parent elements, return True if all of them have a `level`
        that's one less than this element's level, otherwise raise a LevelError.

        Typically parent_lists would be fields of `self`, but which fields, that depends
        on the subclass.
        """
        for l in parent_lists:
            for parent in l:
                if parent.level != self.level - 1:
                    raise LevelError(self)
        return True

    @staticmethod
    def make_save_method(*parent_list_namess):
        """Return a function that can be used as a `save` method for a subclass of
        CaseItem.

        The returned method first checks that `_check_parent_levels` passes for
        `parent_lists`, then calls Model.save. The argument `parent_list_names` should
        be a list of strings, that are the names of fields of the subclass that hold
        parents of the item, e.g. `parent_list_names = ["goal"]` would result in
        `_check_parent_levels` being called with `parent_lists = [self.goal]`.
        """
        # TODO I suspect that this doesn't work as it's written, unless
        # models.ForeignKey and model.ManyToManyField support iteration like this. Fix.

        def save(self, *args, **kwargs):
            parent_lists = [getattr(self, name) for name in parent_list_names]
            self._check_parent_levels(*parent_lists)
            super().save(*args, **kwargs)

        return save


class AssuranceCase(models.Model):
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=1000)
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
    created_date = models.DateTimeField(auto_now_add=True)
    goal = models.ForeignKey(
        TopLevelNormativeGoal, related_name="context", on_delete=models.CASCADE
    )

    save = CaseItem.make_save_method("goal")


class SystemDescription(CaseItem):
    shape = Shape.DIAMOND
    goal = models.ForeignKey(
        TopLevelNormativeGoal,
        related_name="system_description",
        on_delete=models.CASCADE,
    )

    save = CaseItem.make_save_method("goal")


class PropertyClaim(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    goal = models.ForeignKey(
        TopLevelNormativeGoal, related_name="property_claims", on_delete=models.CASCADE
    )

    save = CaseItem.make_save_method("goal")


class Argument(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    property_claim = models.ManyToManyField(PropertyClaim, related_name="arguments")

    save = CaseItem.make_save_method("property_claim")


class EvidentialClaim(CaseItem):
    shape = Shape.ROUNDED_RECTANGLE
    argument = models.ForeignKey(
        Argument, related_name="evidential_claims", on_delete=models.CASCADE
    )

    save = CaseItem.make_save_method("argument")


class Evidence(CaseItem):
    URL = models.CharField(max_length=3000)
    shape = Shape.CYLINDER
    evidential_claim = models.ManyToManyField(EvidentialClaim, related_name="evidence")

    save = CaseItem.make_save_method("evidential_claim")
