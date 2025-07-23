"""
FactoryBoy factories for core assurance case models.

This module provides factories for creating test data for:
- AssuranceCase (main assurance case entity)
- TopLevelNormativeGoal (top-level goals with assumptions)
"""

import factory
from django.utils import timezone
from faker import Faker

from api.models import AssuranceCase, TopLevelNormativeGoal
from tests.factories.base import BaseFactory
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory


class AssuranceCaseFactory(BaseFactory):
    """Factory for creating AssuranceCase instances."""

    class Meta:
        model = AssuranceCase

    name = factory.Sequence(lambda n: f"Test Assurance Case {n}")
    description = factory.Faker("text", max_nb_chars=500)
    owner = factory.SubFactory(EAPUserFactory)
    color_profile = "default"
    published = False
    published_date = None

    @factory.post_generation
    def edit_groups(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add edit groups after creation."""
        if not create:
            return

        if extracted:
            for group in extracted:
                self.edit_groups.add(group)

    @factory.post_generation
    def view_groups(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add view groups after creation."""
        if not create:
            return

        if extracted:
            for group in extracted:
                self.view_groups.add(group)

    @factory.post_generation
    def review_groups(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add review groups after creation."""
        if not create:
            return

        if extracted:
            for group in extracted:
                self.review_groups.add(group)


class PublishedAssuranceCaseFactory(AssuranceCaseFactory):
    """Factory for creating published AssuranceCase instances."""

    published = True
    published_date = factory.LazyFunction(timezone.now)


class AssuranceCaseWithGroupsFactory(AssuranceCaseFactory):
    """Factory for creating AssuranceCase with default groups."""

    @factory.post_generation
    def setup_groups(self, create, extracted, **kwargs):  # noqa: ARG002
        """Set up default groups."""
        if not create:
            return

        # Create default groups
        edit_group = EAPGroupFactory(name=f"Edit Group for {self.name}")
        view_group = EAPGroupFactory(name=f"View Group for {self.name}")
        review_group = EAPGroupFactory(name=f"Review Group for {self.name}")

        self.edit_groups.add(edit_group)
        self.view_groups.add(view_group)
        self.review_groups.add(review_group)


class TopLevelNormativeGoalFactory(BaseFactory):
    """Factory for creating TopLevelNormativeGoal instances."""

    class Meta:
        model = TopLevelNormativeGoal

    name = factory.Sequence(lambda n: f"Goal {n}")
    short_description = factory.Faker("sentence")
    long_description = factory.Faker("text", max_nb_chars=1000)
    assumption = factory.Faker("text", max_nb_chars=500)
    assurance_case = factory.SubFactory(AssuranceCaseFactory)
    in_sandbox = False

    @factory.lazy_attribute
    def keywords(self):
        """Generate comma-separated keywords."""
        fake = Faker()
        words = fake.words(nb=5)
        return ", ".join(words)


class SandboxTopLevelNormativeGoalFactory(TopLevelNormativeGoalFactory):
    """Factory for creating TopLevelNormativeGoal instances in sandbox."""

    in_sandbox = True


class GoalWithAssumptionFactory(TopLevelNormativeGoalFactory):
    """Factory for creating TopLevelNormativeGoal with detailed assumption."""

    assumption = factory.Faker("paragraph", nb_sentences=3)


class EmptyGoalFactory(TopLevelNormativeGoalFactory):
    """Factory for creating minimal TopLevelNormativeGoal instances."""

    name = ""
    short_description = "Minimal goal"
    long_description = "Minimal goal description"
    keywords = ""
    assumption = ""
