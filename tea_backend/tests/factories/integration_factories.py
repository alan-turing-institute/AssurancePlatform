"""
Factory definitions for integration-related models.

This module provides FactoryBoy factories for:
- GitHubRepository model
- PublishedAssuranceCase model
- CaseStudy model
- CaseStudyFeatureImage model
"""

import factory
from django.utils import timezone

from api.models import CaseStudy, CaseStudyFeatureImage, GitHubRepository, PublishedAssuranceCase
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.user_factories import EAPUserFactory


class GitHubRepositoryFactory(factory.django.DjangoModelFactory):
    """Factory for GitHubRepository model."""

    class Meta:
        model = GitHubRepository

    name = factory.Sequence(lambda n: f"test-repo-{n}")
    url = factory.LazyAttribute(
        lambda obj: f"https://github.com/{obj.owner.auth_username}/{obj.name}"
    )
    owner = factory.SubFactory(EAPUserFactory, auth_provider="github")


class PublishedAssuranceCaseFactory(factory.django.DjangoModelFactory):
    """Factory for PublishedAssuranceCase model."""

    class Meta:
        model = PublishedAssuranceCase

    assurance_case = factory.SubFactory(AssuranceCaseFactory)
    repository = factory.SubFactory(GitHubRepositoryFactory)
    branch = "main"
    file_path = factory.Sequence(lambda n: f"case-{n}.json")
    commit_sha = factory.Faker("sha1")
    published_at = factory.LazyFunction(timezone.now)
    description = factory.Faker("sentence", nb_words=8)


class CaseStudyFactory(factory.django.DjangoModelFactory):
    """Factory for CaseStudy model."""

    class Meta:
        model = CaseStudy

    title = factory.Faker("sentence", nb_words=4)
    description = factory.Faker("paragraph", nb_sentences=3)
    content = factory.Faker("text", max_nb_chars=2000)
    type = factory.Iterator(["educational", "industrial", "research"])
    owner = factory.SubFactory(EAPUserFactory)
    created_at = factory.Faker("date_time_this_year")


class CaseStudyFeatureImageFactory(factory.django.DjangoModelFactory):
    """Factory for CaseStudyFeatureImage model."""

    class Meta:
        model = CaseStudyFeatureImage

    case_study = factory.SubFactory(CaseStudyFactory)
    image = factory.django.ImageField(
        filename="test_feature.jpg", width=400, height=300, color="red"
    )
    alt_text = factory.Faker("sentence", nb_words=6)
    created_at = factory.LazyFunction(timezone.now)
