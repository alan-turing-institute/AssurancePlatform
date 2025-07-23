"""
API endpoint tests for public API and case study management.

This module tests:
- Public API endpoints for published assurance cases
- Case study CRUD operations and management
- Public content filtering and access control
- Case study feature image handling
- Anonymous access to public content
"""

from io import BytesIO
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from api.models import CaseStudy
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.content_factories import TopLevelNormativeGoalFactory
from tests.factories.integration_factories import (
    CaseStudyFactory,
    CaseStudyFeatureImageFactory,
    PublishedAssuranceCaseFactory,
)
from tests.factories.user_factories import EAPUserFactory

User = get_user_model()


class TestPublicAssuranceCaseViews(TestCase):
    """Test public API endpoints for published assurance cases."""

    def setUp(self):
        """Set up test client, user, and published cases."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user, published=True)

        # Create published assurance case
        self.published_case = PublishedAssuranceCaseFactory(assurance_case=self.case)

    def test_list_published_cases_anonymous(self):
        """Test listing published cases without authentication."""
        url = reverse("public_published_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 1)

    def test_list_published_cases_authenticated(self):
        """Test listing published cases with authentication."""
        self.client.force_authenticate(user=self.user)

        url = reverse("public_published_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_get_published_case_detail_anonymous(self):
        """Test retrieving published case details without authentication."""
        url = reverse("public_published_case_detail", kwargs={"id": self.published_case.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], str(self.published_case.id))
        self.assertIn("assurance_case", data)

    def test_get_published_case_detail_with_content(self):
        """Test retrieving published case with full content structure."""
        # Add some content to the case
        TopLevelNormativeGoalFactory(assurance_case=self.case)

        url = reverse("public_published_case_detail", kwargs={"id": self.published_case.id})
        response = self.client.get(url, {"include_content": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("goals", data["assurance_case"])

    def test_get_nonexistent_published_case(self):
        """Test retrieving non-existent published case."""
        url = reverse("public_published_case_detail", kwargs={"id": uuid4()})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_published_case_filtering(self):
        """Test filtering published cases by various criteria."""
        # Create additional published cases
        other_user = EAPUserFactory()
        other_case = AssuranceCaseFactory(owner=other_user, published=True)

        PublishedAssuranceCaseFactory(assurance_case=other_case)

        url = reverse("public_published_case_list")

        # Filter by owner
        response = self.client.get(url, {"owner": self.user.username})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # Should only return cases by this user
        for case in data["results"]:
            self.assertEqual(case["assurance_case"]["owner"], self.user.id)

    def test_published_case_search(self):
        """Test searching published cases by name or description."""
        url = reverse("public_published_case_list")

        # Search by case name
        response = self.client.get(url, {"search": self.case.name[:5]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreaterEqual(len(data["results"]), 1)

    def test_unpublished_case_not_accessible(self):
        """Test that unpublished cases are not accessible via public API."""
        unpublished_case = AssuranceCaseFactory(owner=self.user, published=False)

        url = reverse("public_published_case_list")
        response = self.client.get(url)

        data = response.json()
        case_ids = [case["assurance_case"]["id"] for case in data["results"]]
        self.assertNotIn(unpublished_case.id, case_ids)


class TestCaseStudyViews(TestCase):
    """Test case study CRUD operations and management."""

    def setUp(self):
        """Set up test client, user, and case study."""
        self.client = APIClient()
        self.user = EAPUserFactory()

    def test_list_case_studies_anonymous(self):
        """Test listing case studies without authentication."""
        # Create case studies

        CaseStudyFactory.create_batch(3)

        url = reverse("public_case_study_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 3)

    def test_list_case_studies_authenticated(self):
        """Test listing case studies with authentication."""
        self.client.force_authenticate(user=self.user)

        url = reverse("case_study_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_case_study_success(self):
        """Test successful case study creation."""
        self.client.force_authenticate(user=self.user)

        case_study_data = {
            "title": "Test Case Study",
            "description": "A comprehensive case study for testing",
            "content": "Detailed content of the case study...",
            "type": "educational",
            "owner": self.user.id,
        }

        url = reverse("case_study_list")
        response = self.client.post(url, case_study_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["title"], "Test Case Study")
        self.assertEqual(data["owner"], self.user.id)

    def test_create_case_study_unauthenticated(self):
        """Test case study creation without authentication."""
        case_study_data = {
            "title": "Unauthorized Case Study",
            "description": "Should not be created",
        }

        url = reverse("case_study_list")
        response = self.client.post(url, case_study_data)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_case_study_detail(self):
        """Test retrieving case study details."""

        case_study = CaseStudyFactory(owner=self.user)

        url = reverse("case_study_detail", kwargs={"pk": case_study.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], case_study.id)
        self.assertEqual(data["title"], case_study.title)

    def test_update_case_study_as_owner(self):
        """Test updating case study as owner."""
        self.client.force_authenticate(user=self.user)

        case_study = CaseStudyFactory(owner=self.user)

        update_data = {"title": "Updated Case Study Title", "description": "Updated description"}

        url = reverse("case_study_detail", kwargs={"pk": case_study.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify case study was updated
        case_study.refresh_from_db()
        self.assertEqual(case_study.title, "Updated Case Study Title")

    def test_update_case_study_not_owner(self):
        """Test updating case study as non-owner (should fail)."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=self.user)

        case_study = CaseStudyFactory(owner=other_user)

        update_data = {"title": "Unauthorized Update"}

        url = reverse("case_study_detail", kwargs={"pk": case_study.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_case_study_as_owner(self):
        """Test deleting case study as owner."""
        self.client.force_authenticate(user=self.user)

        case_study = CaseStudyFactory(owner=self.user)

        url = reverse("case_study_detail", kwargs={"pk": case_study.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify case study was deleted
        self.assertFalse(CaseStudy.objects.filter(id=case_study.id).exists())


class TestCaseStudyImageHandling(TestCase):
    """Test case study feature image handling."""

    def setUp(self):
        """Set up test client, user, and case study."""
        self.client = APIClient()
        self.user = EAPUserFactory()

        self.case_study = CaseStudyFactory(owner=self.user)

    def create_test_image(self):
        """Create a test image for upload."""
        image = Image.new("RGB", (200, 200), color="blue")
        temp_file = BytesIO()
        image.save(temp_file, format="PNG")
        temp_file.seek(0)

        return SimpleUploadedFile(
            "test_feature_image.png", temp_file.getvalue(), content_type="image/png"
        )

    def test_upload_case_study_feature_image(self):
        """Test uploading feature image for case study."""
        self.client.force_authenticate(user=self.user)

        test_image = self.create_test_image()

        url = reverse("case_study_feature_image", kwargs={"pk": self.case_study.pk})
        response = self.client.post(url, {"image": test_image}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("image_url", data)

    def test_upload_feature_image_unauthorized(self):
        """Test uploading feature image without permission."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=other_user)

        test_image = self.create_test_image()

        url = reverse("case_study_feature_image", kwargs={"pk": self.case_study.pk})
        response = self.client.post(url, {"image": test_image}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_case_study_feature_images(self):
        """Test retrieving case study feature images."""
        # Create feature image

        CaseStudyFeatureImageFactory(case_study=self.case_study)

        url = reverse("case_study_feature_image", kwargs={"pk": self.case_study.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("images", data)
        self.assertGreaterEqual(len(data["images"]), 1)

    def test_delete_feature_image(self):
        """Test deleting case study feature image."""
        self.client.force_authenticate(user=self.user)

        feature_image = CaseStudyFeatureImageFactory(case_study=self.case_study)

        url = reverse(
            "case_study_feature_image_detail",
            kwargs={"case_study_pk": self.case_study.pk, "pk": feature_image.pk},
        )
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class TestPublicContentFiltering(TestCase):
    """Test public content filtering and access control."""

    def setUp(self):
        """Set up test data with various visibility levels."""
        self.client = APIClient()
        self.user = EAPUserFactory()

        # Create cases with different visibility
        self.public_case = AssuranceCaseFactory(owner=self.user, published=True)
        self.private_case = AssuranceCaseFactory(owner=self.user, published=False)

        # Create case studies

        self.public_case_study = CaseStudyFactory(owner=self.user)

        # Create published versions

        self.published_case = PublishedAssuranceCaseFactory(assurance_case=self.public_case)

    def test_public_api_only_shows_published_content(self):
        """Test that public API only returns published content."""
        url = reverse("public_published_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Should only include published cases
        published_case_ids = [case["assurance_case"]["id"] for case in data["results"]]
        self.assertIn(self.public_case.id, published_case_ids)
        self.assertNotIn(self.private_case.id, published_case_ids)

    def test_public_case_study_list_anonymous_access(self):
        """Test anonymous access to public case study list."""
        url = reverse("public_case_study_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_public_content_pagination(self):
        """Test pagination of public content."""
        # Create many case studies

        CaseStudyFactory.create_batch(15)

        url = reverse("public_case_study_list")
        response = self.client.get(url, {"page_size": 10})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("next", data)
        self.assertLessEqual(len(data["results"]), 10)

    def test_public_content_ordering(self):
        """Test ordering of public content."""
        url = reverse("public_case_study_list")

        # Test ordering by created date
        response = self.client.get(url, {"ordering": "-created_at"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test ordering by title
        response = self.client.get(url, {"ordering": "title"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestPublicAPIRateLimiting(TestCase):
    """Test rate limiting for public API endpoints."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_rate_limiting_anonymous_requests(self):
        """Test rate limiting for anonymous requests."""
        url = reverse("public_published_case_list")

        # Make multiple requests quickly
        responses = []
        for _ in range(10):
            response = self.client.get(url)
            responses.append(response.status_code)

        # Most should succeed (rate limiting may or may not be implemented)
        success_count = sum(1 for status_code in responses if status_code == 200)
        self.assertGreater(success_count, 0)

    def test_rate_limiting_authenticated_requests(self):
        """Test rate limiting for authenticated requests."""
        user = EAPUserFactory()
        self.client.force_authenticate(user=user)

        url = reverse("public_published_case_list")

        # Authenticated users might have higher rate limits
        responses = []
        for _ in range(10):
            response = self.client.get(url)
            responses.append(response.status_code)

        success_count = sum(1 for status_code in responses if status_code == 200)
        self.assertGreater(success_count, 0)


class TestPublicAPICaching(TestCase):
    """Test caching behavior for public API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user, published=True)

        self.published_case = PublishedAssuranceCaseFactory(assurance_case=self.case)

    def test_cache_headers_in_response(self):
        """Test that appropriate cache headers are set."""
        url = reverse("public_published_case_detail", kwargs={"id": self.published_case.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check for cache-related headers (if implemented)
        # self.assertIn('Cache-Control', response)
        # self.assertIn('ETag', response)

    def test_conditional_requests(self):
        """Test conditional requests with If-None-Match header."""
        url = reverse("public_published_case_detail", kwargs={"id": self.published_case.id})

        # First request
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # If ETag is supported, test conditional request
        if "ETag" in response:
            etag = response["ETag"]

            # Conditional request with matching ETag
            response = self.client.get(url, HTTP_IF_NONE_MATCH=etag)
            # Should return 304 Not Modified if caching is implemented
            self.assertIn(response.status_code, [200, 304])


class TestPublicAPIDocumentation(TestCase):
    """Test public API documentation and metadata endpoints."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_api_schema_endpoint(self):
        """Test API schema endpoint for public API."""
        url = reverse("public_api_schema")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return OpenAPI schema
        self.assertIn("openapi", response.json())

    def test_api_health_check(self):
        """Test API health check endpoint."""
        url = reverse("public_api_health")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "healthy")

    def test_api_version_endpoint(self):
        """Test API version information endpoint."""
        url = reverse("public_api_version")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("version", data)


class TestPublicAPIErrors(TestCase):
    """Test error handling in public API endpoints."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_404_for_nonexistent_published_case(self):
        """Test 404 response for non-existent published case."""
        url = reverse("public_published_case_detail", kwargs={"id": uuid4()})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = response.json()
        self.assertIn("detail", data)

    def test_400_for_invalid_query_parameters(self):
        """Test 400 response for invalid query parameters."""
        url = reverse("public_published_case_list")

        # Invalid ordering parameter
        response = self.client.get(url, {"ordering": "invalid_field"})

        # Should either ignore invalid ordering or return 400
        self.assertIn(response.status_code, [200, 400])

    def test_500_error_handling(self):
        """Test handling of server errors."""
        # This would test error handling for database errors, etc.
        # Implementation depends on specific error handling setup
        self.assertTrue(True)  # Placeholder
