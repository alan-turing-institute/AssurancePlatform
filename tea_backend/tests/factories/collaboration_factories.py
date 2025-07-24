"""
Factory definitions for collaboration-related models.

This module provides FactoryBoy factories for:
- Comment model
"""

import factory
from django.contrib.contenttypes.models import ContentType

from api.models import Comment
from tests.factories.case_factories import AssuranceCaseFactory, TopLevelNormativeGoalFactory
from tests.factories.content_factories import (
    ContextFactory,
    EvidenceFactory,
    PropertyClaimFactory,
    StrategyFactory,
)
from tests.factories.user_factories import EAPUserFactory


class CommentFactory(factory.django.DjangoModelFactory):
    """Factory for Comment model."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    created_at = factory.Faker("date_time_this_year")

    # Generic foreign key fields
    content_type = factory.LazyAttribute(
        lambda obj: ContentType.objects.get_for_model(obj.content_object)
    )
    object_id = factory.SelfAttribute("content_object.id")

    # Default content object (can be overridden)
    content_object = factory.SubFactory(TopLevelNormativeGoalFactory)

    # Optional parent for nested comments
    parent = None

    @factory.post_generation
    def set_content_type(self, create, extracted, **kwargs):
        """Set content_type based on content_object."""
        if create and self.content_object:
            self.content_type = ContentType.objects.get_for_model(self.content_object)
            self.object_id = self.content_object.id
            self.save()


class ReplyCommentFactory(CommentFactory):
    """Factory for reply comments (with parent)."""

    parent = factory.SubFactory(CommentFactory)
    content = factory.Faker("sentence", nb_words=10)


# Specialized comment factories for different content types
class AssuranceCaseCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on AssuranceCase."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    assurance_case = factory.SubFactory(AssuranceCaseFactory)


class GoalCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on TopLevelNormativeGoal."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    goal = factory.SubFactory(TopLevelNormativeGoalFactory)


class ContextCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on Context."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    context = factory.SubFactory(ContextFactory)


class StrategyCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on Strategy."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    strategy = factory.SubFactory(StrategyFactory)


class PropertyClaimCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on PropertyClaim."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    property_claim = factory.SubFactory(PropertyClaimFactory)


class EvidenceCommentFactory(factory.django.DjangoModelFactory):
    """Factory for comments on Evidence."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("paragraph", nb_sentences=3)
    evidence = factory.SubFactory(EvidenceFactory)
