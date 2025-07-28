"""
FactoryBoy factories for publishing and case study models.

This module provides factories for creating test data for:
- CaseStudy (case study management)
- CaseStudyFeatureImage (case study image uploads)
- PublishedAssuranceCase (published case snapshots)
"""

import factory
from django.utils import timezone

from api.models import CaseStudy, CaseStudyFeatureImage, PublishedAssuranceCase
from tests.factories.base import BaseFactory
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.user_factories import EAPUserFactory


class PublishedAssuranceCaseFactory(BaseFactory):
    """Factory for creating PublishedAssuranceCase instances."""

    class Meta:
        model = PublishedAssuranceCase

    title = factory.Sequence(lambda n: f"Published Case {n}")
    description = factory.Faker("text", max_nb_chars=500)
    content = factory.Faker("json")
    assurance_case = factory.SubFactory(AssuranceCaseFactory)
    created_at = factory.LazyFunction(timezone.now)


class CaseStudyFactory(BaseFactory):
    """Factory for creating CaseStudy instances."""

    class Meta:
        model = CaseStudy

    title = factory.Sequence(lambda n: f"Case Study {n}")
    description = factory.Faker("text", max_nb_chars=500)
    authors = factory.Faker("name")
    category = "Safety"
    type = "Research"
    sector = factory.Faker("word")
    contact = factory.Faker("email")
    image = factory.Faker("url")
    published_date = None
    published = False
    owner = factory.SubFactory(EAPUserFactory)

    @factory.post_generation
    def assurance_cases(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add assurance cases after creation."""
        if not create:
            return

        if extracted:
            for case in extracted:
                self.assurance_cases.add(case)


class PublishedCaseStudyFactory(CaseStudyFactory):
    """Factory for creating published CaseStudy instances."""

    published = True
    published_date = factory.LazyFunction(timezone.now)


class CaseStudyWithAssuranceCasesFactory(CaseStudyFactory):
    """Factory for creating CaseStudy with associated published assurance cases."""

    @factory.post_generation
    def setup_assurance_cases(self, create, extracted, **kwargs):  # noqa: ARG002
        """Set up default published assurance cases."""
        if not create:
            return

        # Create and associate published assurance cases
        published_case1 = PublishedAssuranceCaseFactory()
        published_case2 = PublishedAssuranceCaseFactory()

        self.assurance_cases.add(published_case1, published_case2)


class SafetyCaseStudyFactory(CaseStudyFactory):
    """Factory for creating Safety category CaseStudy instances."""

    category = "Safety"
    type = "Research"


class SecurityCaseStudyFactory(CaseStudyFactory):
    """Factory for creating Security category CaseStudy instances."""

    category = "Security"
    type = "Industry"


class CaseStudyFeatureImageFactory(BaseFactory):
    """Factory for creating CaseStudyFeatureImage instances."""

    class Meta:
        model = CaseStudyFeatureImage

    case_study = factory.SubFactory(CaseStudyFactory)
    image = factory.django.ImageField(filename="case_study_feature.jpg")
    uploaded_at = factory.LazyFunction(timezone.now)
