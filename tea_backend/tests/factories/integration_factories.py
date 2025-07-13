"""
FactoryBoy factories for integration and collaboration models.

This module provides factories for creating test data for:
- GitHubRepository (GitHub integration)
- Comment (commenting system)
- AssuranceCaseImage (image uploads)
"""

import factory

from api.models import AssuranceCaseImage, Comment, GitHubRepository
from tests.factories.base import BaseFactory
from tests.factories.case_factories import (
    AssuranceCaseFactory,
    TopLevelNormativeGoalFactory,
)
from tests.factories.content_factories import (
    ContextFactory,
    EvidenceFactory,
    PropertyClaimFactory,
    StrategyFactory,
)
from tests.factories.user_factories import EAPUserFactory


class GitHubRepositoryFactory(BaseFactory):
    """Factory for creating GitHubRepository instances."""

    class Meta:
        model = GitHubRepository

    name = factory.Sequence(lambda n: f"test-repo-{n}")
    url = factory.LazyAttribute(lambda obj: f"https://github.com/testuser/{obj.name}")
    description = factory.Faker("text", max_nb_chars=200)
    owner = factory.SubFactory(EAPUserFactory)


class GitHubRepositoryWithoutDescriptionFactory(GitHubRepositoryFactory):
    """Factory for creating GitHubRepository without description."""

    description = None


class CommentFactory(BaseFactory):
    """Factory for creating Comment instances."""

    class Meta:
        model = Comment

    author = factory.SubFactory(EAPUserFactory)
    content = factory.Faker("text", max_nb_chars=500)
    assurance_case = factory.SubFactory(AssuranceCaseFactory)

    # Set all other foreign keys to None by default
    goal = None
    strategy = None
    property_claim = None
    evidence = None
    context = None


class AssuranceCaseCommentFactory(CommentFactory):
    """Factory for creating comments on AssuranceCase."""

    assurance_case = factory.SubFactory(AssuranceCaseFactory)


class GoalCommentFactory(CommentFactory):
    """Factory for creating comments on TopLevelNormativeGoal."""

    goal = factory.SubFactory(TopLevelNormativeGoalFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.goal.assurance_case if obj.goal else None
    )


class ContextCommentFactory(CommentFactory):
    """Factory for creating comments on Context."""

    context = factory.SubFactory(ContextFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.context.assurance_case if obj.context else None
    )


class StrategyCommentFactory(CommentFactory):
    """Factory for creating comments on Strategy."""

    strategy = factory.SubFactory(StrategyFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.strategy.assurance_case if obj.strategy else None
    )


class PropertyClaimCommentFactory(CommentFactory):
    """Factory for creating comments on PropertyClaim."""

    property_claim = factory.SubFactory(PropertyClaimFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.property_claim.assurance_case if obj.property_claim else None
    )


class EvidenceCommentFactory(CommentFactory):
    """Factory for creating comments on Evidence."""

    evidence = factory.SubFactory(EvidenceFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.evidence.assurance_case if obj.evidence else None
    )


class AssuranceCaseImageFactory(BaseFactory):
    """Factory for creating AssuranceCaseImage instances."""

    class Meta:
        model = AssuranceCaseImage

    assurance_case = factory.SubFactory(AssuranceCaseFactory)

    image = factory.django.ImageField(filename="test_image.png")
