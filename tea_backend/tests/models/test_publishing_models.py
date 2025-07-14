"""
Tests for publishing and case study models.

This module provides comprehensive tests for:
- CaseStudy model (case study management)
- CaseStudyFeatureImage model (case study image uploads)
- PublishedAssuranceCase model (published case snapshots)
"""

import json

import pytest
from django.db import IntegrityError
from django.test import TestCase

from api.models import CaseStudy, CaseStudyFeatureImage, PublishedAssuranceCase
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.publishing_factories import (
    CaseStudyFactory,
    CaseStudyFeatureImageFactory,
    CaseStudyWithAssuranceCasesFactory,
    PublishedAssuranceCaseFactory,
    PublishedCaseStudyFactory,
    SafetyCaseStudyFactory,
    SecurityCaseStudyFactory,
)
from tests.factories.user_factories import EAPUserFactory


class TestCaseStudyModel(TestCase):
    """Test CaseStudy model functionality."""

    def test_should_create_case_study_with_required_fields(self):
        """Test that CaseStudy can be created with minimum required fields."""
        case_study = CaseStudyFactory()

        self.assertIsNotNone(case_study.id)
        self.assertTrue(case_study.title.startswith("Case Study"))
        self.assertIsNotNone(case_study.description)
        self.assertIsNotNone(case_study.authors)
        self.assertEqual(case_study.category, "Safety")
        self.assertEqual(case_study.type, "Research")
        self.assertIsNotNone(case_study.created_on)
        self.assertIsNotNone(case_study.owner)
        self.assertFalse(case_study.published)
        self.assertIsNone(case_study.published_date)

    def test_should_have_string_representation(self):
        """Test CaseStudy string representation."""
        case_study = CaseStudyFactory(title="AI Safety Study")

        self.assertEqual(str(case_study), "AI Safety Study")

    def test_should_support_different_categories(self):
        """Test CaseStudy supports different categories."""
        safety_study = SafetyCaseStudyFactory()
        security_study = SecurityCaseStudyFactory()

        self.assertEqual(safety_study.category, "Safety")
        self.assertEqual(security_study.category, "Security")

    def test_should_support_different_types(self):
        """Test CaseStudy supports different types."""
        research_study = CaseStudyFactory(type="Research")
        industry_study = CaseStudyFactory(type="Industry")

        self.assertEqual(research_study.type, "Research")
        self.assertEqual(industry_study.type, "Industry")

    def test_should_support_publishing(self):
        """Test CaseStudy publishing functionality."""
        case_study = PublishedCaseStudyFactory()

        self.assertTrue(case_study.published)
        self.assertIsNotNone(case_study.published_date)

    def test_should_belong_to_owner(self):
        """Test CaseStudy belongs to an owner."""
        owner = EAPUserFactory()
        case_study = CaseStudyFactory(owner=owner)

        self.assertEqual(case_study.owner, owner)
        self.assertIn(case_study, owner.case_study.all())

    def test_should_support_assurance_case_associations(self):
        """Test CaseStudy many-to-many relationship with PublishedAssuranceCase."""
        case_study = CaseStudyWithAssuranceCasesFactory()

        self.assertEqual(case_study.assurance_cases.count(), 2)

        for published_case in case_study.assurance_cases.all():
            self.assertIsInstance(published_case, PublishedAssuranceCase)

    def test_should_allow_manual_assurance_case_association(self):
        """Test manually associating CaseStudy with PublishedAssuranceCases."""
        case_study = CaseStudyFactory()
        published_case1 = PublishedAssuranceCaseFactory()
        published_case2 = PublishedAssuranceCaseFactory()
        published_case3 = PublishedAssuranceCaseFactory()

        case_study.assurance_cases.add(published_case1, published_case2, published_case3)

        self.assertEqual(case_study.assurance_cases.count(), 3)
        self.assertIn(published_case1, case_study.assurance_cases.all())
        self.assertIn(published_case2, case_study.assurance_cases.all())
        self.assertIn(published_case3, case_study.assurance_cases.all())

    def test_should_handle_assurance_case_removal(self):
        """Test removing PublishedAssuranceCase associations from CaseStudy."""
        case_study = CaseStudyWithAssuranceCasesFactory()
        published_cases = list(case_study.assurance_cases.all())
        case_to_remove = published_cases[0]

        case_study.assurance_cases.remove(case_to_remove)

        self.assertEqual(case_study.assurance_cases.count(), 1)
        self.assertNotIn(case_to_remove, case_study.assurance_cases.all())

    def test_should_delete_case_study_when_owner_deleted(self):
        """Test that CaseStudy is deleted when owner is deleted."""
        owner = EAPUserFactory()
        case_study = CaseStudyFactory(owner=owner)
        case_study_id = case_study.id

        owner.delete()

        self.assertFalse(CaseStudy.objects.filter(id=case_study_id).exists())

    def test_should_maintain_case_study_when_assurance_case_deleted(self):
        """Test that CaseStudy persists when associated PublishedAssuranceCase is deleted."""
        case_study = CaseStudyWithAssuranceCasesFactory()
        initial_count = case_study.assurance_cases.count()
        case_to_delete = case_study.assurance_cases.first()
        case_id = case_to_delete.id

        case_to_delete.delete()

        # Case study should still exist
        case_study.refresh_from_db()
        self.assertIsNotNone(case_study.id)
        # But should have one less associated case
        self.assertEqual(case_study.assurance_cases.count(), initial_count - 1)
        self.assertFalse(PublishedAssuranceCase.objects.filter(id=case_id).exists())

    def test_should_handle_long_title_and_description(self):
        """Test CaseStudy with maximum length title and description."""
        long_title = "a" * 500  # Max length for title field
        long_description = "b" * 2000  # Max length for description field

        case_study = CaseStudyFactory(title=long_title, description=long_description)

        self.assertEqual(case_study.title, long_title)
        self.assertEqual(case_study.description, long_description)

    def test_should_handle_long_authors_field(self):
        """Test CaseStudy with maximum length authors field."""
        long_authors = "c" * 500  # Max length for authors field
        case_study = CaseStudyFactory(authors=long_authors)

        self.assertEqual(case_study.authors, long_authors)

    def test_should_allow_multiple_case_studies_per_owner(self):
        """Test that an owner can have multiple case studies."""
        owner = EAPUserFactory()
        study1 = CaseStudyFactory(owner=owner, title="Study 1")
        study2 = CaseStudyFactory(owner=owner, title="Study 2")
        study3 = CaseStudyFactory(owner=owner, title="Study 3")

        self.assertEqual(owner.case_study.count(), 3)
        self.assertIn(study1, owner.case_study.all())
        self.assertIn(study2, owner.case_study.all())
        self.assertIn(study3, owner.case_study.all())

    def test_should_handle_unpublishing(self):
        """Test CaseStudy unpublishing functionality."""
        case_study = PublishedCaseStudyFactory()

        # Unpublish the case study
        case_study.published = False
        case_study.published_date = None
        case_study.save()

        self.assertFalse(case_study.published)
        self.assertIsNone(case_study.published_date)


class TestPublishedAssuranceCaseModel(TestCase):
    """Test PublishedAssuranceCase model functionality."""

    def test_should_create_published_case_with_required_fields(self):
        """Test that PublishedAssuranceCase can be created with minimum required fields."""
        published_case = PublishedAssuranceCaseFactory()

        self.assertIsNotNone(published_case.id)
        self.assertTrue(published_case.title.startswith("Published Case"))
        self.assertIsNotNone(published_case.description)
        self.assertIsNotNone(published_case.content)
        self.assertIsNotNone(published_case.assurance_case)
        self.assertIsNotNone(published_case.created_at)

    def test_should_have_string_representation(self):
        """Test PublishedAssuranceCase string representation."""
        case_study = CaseStudyFactory(title="AI Study")
        published_case = PublishedAssuranceCaseFactory(title="AI Safety Case")

        # Manually associate to test string representation
        case_study.assurance_cases.add(published_case)

        expected_str = f"Snapshot of AI Safety Case for Case Study {case_study.id}"
        self.assertEqual(str(published_case), expected_str)

    def test_should_reference_original_assurance_case(self):
        """Test PublishedAssuranceCase references original AssuranceCase."""
        original_case = AssuranceCaseFactory()
        published_case = PublishedAssuranceCaseFactory(assurance_case=original_case)

        self.assertEqual(published_case.assurance_case, original_case)

    def test_should_handle_json_content(self):
        """Test PublishedAssuranceCase JSON content field."""
        test_content = {"goals": ["goal1", "goal2"], "evidence": ["evidence1"]}
        published_case = PublishedAssuranceCaseFactory(content=json.dumps(test_content))

        parsed_content = json.loads(published_case.content)
        self.assertEqual(parsed_content["goals"], ["goal1", "goal2"])
        self.assertEqual(parsed_content["evidence"], ["evidence1"])

    def test_should_handle_long_title_and_description(self):
        """Test PublishedAssuranceCase with maximum length fields."""
        long_title = "d" * 500  # Max length for title field
        long_description = "e" * 2000  # Max length for description field

        published_case = PublishedAssuranceCaseFactory(
            title=long_title, description=long_description
        )

        self.assertEqual(published_case.title, long_title)
        self.assertEqual(published_case.description, long_description)

    def test_should_delete_published_case_when_assurance_case_deleted(self):
        """Test that PublishedAssuranceCase is deleted when original AssuranceCase is deleted."""
        original_case = AssuranceCaseFactory()
        published_case = PublishedAssuranceCaseFactory(assurance_case=original_case)
        published_case_id = published_case.id

        original_case.delete()

        self.assertFalse(PublishedAssuranceCase.objects.filter(id=published_case_id).exists())

    def test_should_allow_multiple_published_cases_per_assurance_case(self):
        """Test that an AssuranceCase can have multiple published snapshots."""
        original_case = AssuranceCaseFactory()
        published_case1 = PublishedAssuranceCaseFactory(
            assurance_case=original_case, title="Snapshot 1"
        )
        published_case2 = PublishedAssuranceCaseFactory(
            assurance_case=original_case, title="Snapshot 2"
        )
        published_case3 = PublishedAssuranceCaseFactory(
            assurance_case=original_case, title="Snapshot 3"
        )

        published_cases = PublishedAssuranceCase.objects.filter(assurance_case=original_case)
        self.assertEqual(published_cases.count(), 3)
        self.assertIn(published_case1, published_cases)
        self.assertIn(published_case2, published_cases)
        self.assertIn(published_case3, published_cases)


class TestCaseStudyFeatureImageModel(TestCase):
    """Test CaseStudyFeatureImage model functionality."""

    def test_should_create_feature_image_with_required_fields(self):
        """Test that CaseStudyFeatureImage can be created with minimum required fields."""
        feature_image = CaseStudyFeatureImageFactory()

        self.assertIsNotNone(feature_image.id)
        self.assertIsNotNone(feature_image.case_study)
        self.assertIsNotNone(feature_image.image)
        self.assertIsNotNone(feature_image.uploaded_at)

    def test_should_have_string_representation(self):
        """Test CaseStudyFeatureImage string representation."""
        case_study = CaseStudyFactory(title="AI Ethics Study")
        feature_image = CaseStudyFeatureImageFactory(case_study=case_study)

        expected_str = "Feature Image for AI Ethics Study"
        self.assertEqual(str(feature_image), expected_str)

    def test_should_enforce_one_to_one_relationship(self):
        """Test that CaseStudyFeatureImage enforces one image per case study."""
        case_study = CaseStudyFactory()
        CaseStudyFeatureImageFactory(case_study=case_study)

        # Try to create another image for the same case study
        with pytest.raises(IntegrityError):
            CaseStudyFeatureImageFactory(case_study=case_study)

    def test_should_delete_image_when_case_study_deleted(self):
        """Test that CaseStudyFeatureImage is deleted when case study is deleted."""
        case_study = CaseStudyFactory()
        feature_image = CaseStudyFeatureImageFactory(case_study=case_study)
        image_id = feature_image.id

        case_study.delete()

        self.assertFalse(CaseStudyFeatureImage.objects.filter(id=image_id).exists())

    def test_should_handle_image_file_properly(self):
        """Test CaseStudyFeatureImage handles image file properly."""
        feature_image = CaseStudyFeatureImageFactory()

        # Image should have a name
        self.assertTrue(feature_image.image.name.endswith((".jpg", ".jpeg", ".png")))

    def test_should_provide_access_through_case_study(self):
        """Test that CaseStudy provides access to its feature image."""
        case_study = CaseStudyFactory()
        feature_image = CaseStudyFeatureImageFactory(case_study=case_study)

        # Should be accessible through the case study
        self.assertEqual(case_study.feature_image, feature_image)

    def test_should_handle_image_replacement(self):
        """Test replacing a feature image for a case study."""
        case_study = CaseStudyFactory()
        original_image = CaseStudyFeatureImageFactory(case_study=case_study)
        original_id = original_image.id

        # Delete the original and create a new one
        original_image.delete()
        new_image = CaseStudyFeatureImageFactory(case_study=case_study)

        # Original should be gone, new one should exist
        self.assertFalse(CaseStudyFeatureImage.objects.filter(id=original_id).exists())
        self.assertTrue(CaseStudyFeatureImage.objects.filter(id=new_image.id).exists())
        self.assertEqual(case_study.feature_image, new_image)


class TestPublishingModelRelationships(TestCase):
    """Test relationships between publishing models and other models."""

    def test_should_handle_complex_case_study_scenario(self):
        """Test complex case study scenario with multiple components."""
        # Create owner and case studies
        owner = EAPUserFactory()
        case_study1 = CaseStudyFactory(owner=owner, title="Safety Study")
        case_study2 = PublishedCaseStudyFactory(owner=owner, title="Security Study")

        # Create original assurance cases
        original_case1 = AssuranceCaseFactory()
        original_case2 = AssuranceCaseFactory()

        # Create published snapshots
        published_case1 = PublishedAssuranceCaseFactory(
            assurance_case=original_case1, title="Safety Case Snapshot"
        )
        published_case2 = PublishedAssuranceCaseFactory(
            assurance_case=original_case2, title="Security Case Snapshot"
        )

        # Associate published cases with case studies
        case_study1.assurance_cases.add(published_case1)
        case_study2.assurance_cases.add(published_case2)

        # Add feature images
        feature_image1 = CaseStudyFeatureImageFactory(case_study=case_study1)
        feature_image2 = CaseStudyFeatureImageFactory(case_study=case_study2)

        # Verify all relationships
        self.assertEqual(owner.case_study.count(), 2)
        self.assertEqual(case_study1.assurance_cases.count(), 1)
        self.assertEqual(case_study2.assurance_cases.count(), 1)
        self.assertEqual(case_study1.feature_image, feature_image1)
        self.assertEqual(case_study2.feature_image, feature_image2)

        # Verify published cases reference originals
        self.assertEqual(published_case1.assurance_case, original_case1)
        self.assertEqual(published_case2.assurance_case, original_case2)

    def test_should_handle_case_study_with_multiple_published_cases(self):
        """Test case study with multiple published assurance cases."""
        case_study = CaseStudyFactory()

        # Create multiple published cases
        published_case1 = PublishedAssuranceCaseFactory(title="Version 1")
        published_case2 = PublishedAssuranceCaseFactory(title="Version 2")
        published_case3 = PublishedAssuranceCaseFactory(title="Version 3")

        case_study.assurance_cases.add(published_case1, published_case2, published_case3)

        self.assertEqual(case_study.assurance_cases.count(), 3)
        self.assertIn(published_case1, case_study.assurance_cases.all())
        self.assertIn(published_case2, case_study.assurance_cases.all())
        self.assertIn(published_case3, case_study.assurance_cases.all())

    def test_should_handle_published_case_shared_across_studies(self):
        """Test published assurance case shared across multiple case studies."""
        # Create multiple case studies
        study1 = CaseStudyFactory(title="Study 1")
        study2 = CaseStudyFactory(title="Study 2")
        study3 = CaseStudyFactory(title="Study 3")

        # Create a published case
        published_case = PublishedAssuranceCaseFactory(title="Shared Case")

        # Associate with all case studies
        study1.assurance_cases.add(published_case)
        study2.assurance_cases.add(published_case)
        study3.assurance_cases.add(published_case)

        # Verify the published case appears in all studies
        self.assertIn(published_case, study1.assurance_cases.all())
        self.assertIn(published_case, study2.assurance_cases.all())
        self.assertIn(published_case, study3.assurance_cases.all())

        # Verify from the published case perspective
        associated_studies = CaseStudy.objects.filter(assurance_cases=published_case)
        self.assertEqual(associated_studies.count(), 3)
        self.assertIn(study1, associated_studies)
        self.assertIn(study2, associated_studies)
        self.assertIn(study3, associated_studies)
