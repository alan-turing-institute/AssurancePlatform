"""
API endpoint tests for assurance case CRUD operations and permissions.

This module tests:
- AssuranceCase CRUD operations
- Permission management (view/edit/review groups)
- Image upload and management
- Publishing workflows
- Identifier updates and sandbox operations
- Case sharing functionality
"""

from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from api.models import AssuranceCase
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.content_factories import TopLevelNormativeGoalFactory
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory

User = get_user_model()


class TestAssuranceCaseListView(TestCase):
    """Test assurance case list and creation endpoints."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory()

    def test_list_assurance_cases_authenticated(self):
        """Test listing assurance cases when authenticated."""
        self.client.force_authenticate(user=self.user)

        # Create cases with different permissions
        own_case = AssuranceCaseFactory(owner=self.user)
        other_case = AssuranceCaseFactory()

        # Add user to view group of other case
        other_case.view_groups.add(self.user.groups.first() or EAPGroupFactory(users=[self.user]))

        url = reverse("assurance_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

        # Should see own case and cases where user has view permission
        case_ids = [case["id"] for case in data["results"]]
        self.assertIn(own_case.id, case_ids)

    def test_list_assurance_cases_unauthenticated(self):
        """Test listing assurance cases when not authenticated."""
        url = reverse("assurance_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_assurance_case_success(self):
        """Test successful assurance case creation."""
        self.client.force_authenticate(user=self.user)

        case_data = {
            "name": "Test Assurance Case",
            "description": "A test case for API testing",
            "owner": self.user.id,
        }

        url = reverse("assurance_case_list")
        response = self.client.post(url, case_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Assurance Case")
        self.assertEqual(data["owner"], self.user.id)

    def test_create_assurance_case_invalid_data(self):
        """Test assurance case creation with invalid data."""
        self.client.force_authenticate(user=self.user)

        # Missing required fields
        case_data = {"description": "Missing name field"}

        url = reverse("assurance_case_list")
        response = self.client.post(url, case_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestAssuranceCaseDetailView(TestCase):
    """Test assurance case detail operations."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.other_user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_get_case_detail_owner(self):
        """Test retrieving case details as owner."""
        self.client.force_authenticate(user=self.user)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], self.case.id)
        self.assertEqual(data["name"], self.case.name)

    def test_get_case_detail_with_view_permission(self):
        """Test retrieving case details with view permission."""
        self.client.force_authenticate(user=self.other_user)

        # Add other_user to view group
        view_group = EAPGroupFactory(users=[self.other_user])
        self.case.view_groups.add(view_group)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_case_detail_no_permission(self):
        """Test retrieving case details without permission."""
        self.client.force_authenticate(user=self.other_user)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_case_as_owner(self):
        """Test updating case as owner."""
        self.client.force_authenticate(user=self.user)

        update_data = {"name": "Updated Case Name", "description": "Updated description"}

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify case was updated
        self.case.refresh_from_db()
        self.assertEqual(self.case.name, "Updated Case Name")
        self.assertEqual(self.case.description, "Updated description")

    def test_update_case_with_edit_permission(self):
        """Test updating case with edit permission."""
        self.client.force_authenticate(user=self.other_user)

        # Add other_user to edit group
        edit_group = EAPGroupFactory(users=[self.other_user])
        self.case.edit_groups.add(edit_group)

        update_data = {"name": "Updated by Editor"}

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_case_no_permission(self):
        """Test updating case without permission."""
        self.client.force_authenticate(user=self.other_user)

        update_data = {"name": "Unauthorized Update"}

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_case_as_owner(self):
        """Test deleting case as owner."""
        self.client.force_authenticate(user=self.user)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify case was deleted
        self.assertFalse(AssuranceCase.objects.filter(id=self.case.id).exists())

    def test_delete_case_no_permission(self):
        """Test deleting case without permission."""
        self.client.force_authenticate(user=self.other_user)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestAssuranceCaseImageManagement(TestCase):
    """Test assurance case image upload and management."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def create_test_image(self):
        """Create a test image for upload."""
        # Create a simple test image
        image = Image.new("RGB", (100, 100), color="red")
        temp_file = BytesIO()
        image.save(temp_file, format="PNG")
        temp_file.seek(0)

        return SimpleUploadedFile("test_image.png", temp_file.getvalue(), content_type="image/png")

    def test_upload_case_image_success(self):
        """Test successful case image upload."""
        self.client.force_authenticate(user=self.user)

        test_image = self.create_test_image()

        url = reverse("assurance_case_image", kwargs={"pk": self.case.pk})
        response = self.client.post(url, {"image": test_image}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify image was associated with case
        self.case.refresh_from_db()
        self.assertTrue(hasattr(self.case, "assurancecaseimage"))

    def test_upload_case_image_no_permission(self):
        """Test case image upload without permission."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=other_user)

        test_image = self.create_test_image()

        url = reverse("assurance_case_image", kwargs={"pk": self.case.pk})
        response = self.client.post(url, {"image": test_image}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_upload_invalid_file_type(self):
        """Test uploading invalid file type."""
        self.client.force_authenticate(user=self.user)

        # Create a text file instead of image
        text_file = SimpleUploadedFile(
            "test.txt", b"This is not an image", content_type="text/plain"
        )

        url = reverse("assurance_case_image", kwargs={"pk": self.case.pk})
        response = self.client.post(url, {"image": text_file}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestAssuranceCaseSandboxOperations(TestCase):
    """Test assurance case sandbox operations."""

    def setUp(self):
        """Set up test client, user, and case with goals."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_sandbox_attach_operation(self):
        """Test sandbox attach operation."""
        self.client.force_authenticate(user=self.user)

        # Create another goal to attach
        other_goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        sandbox_data = {
            "operation": "attach",
            "source_id": self.goal.id,
            "target_id": other_goal.id,
            "relation_type": "support",
        }

        url = reverse("assurance_case_sandbox", kwargs={"pk": self.case.pk})
        response = self.client.post(url, sandbox_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_sandbox_detach_operation(self):
        """Test sandbox detach operation."""
        self.client.force_authenticate(user=self.user)

        sandbox_data = {"operation": "detach", "element_id": self.goal.id}

        url = reverse("assurance_case_sandbox", kwargs={"pk": self.case.pk})
        response = self.client.post(url, sandbox_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_sandbox_operation_no_permission(self):
        """Test sandbox operation without permission."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=other_user)

        sandbox_data = {"operation": "attach", "source_id": self.goal.id, "target_id": self.goal.id}

        url = reverse("assurance_case_sandbox", kwargs={"pk": self.case.pk})
        response = self.client.post(url, sandbox_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestAssuranceCaseSharing(TestCase):
    """Test assurance case sharing functionality."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_get_shared_with_list(self):
        """Test retrieving list of users/groups case is shared with."""
        self.client.force_authenticate(user=self.user)

        # Add some groups to the case
        view_group = EAPGroupFactory()
        edit_group = EAPGroupFactory()
        self.case.view_groups.add(view_group)
        self.case.edit_groups.add(edit_group)

        url = reverse("assurance_case_shared_with", kwargs={"pk": self.case.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("view_groups", data)
        self.assertIn("edit_groups", data)

    def test_update_sharing_permissions(self):
        """Test updating case sharing permissions."""
        self.client.force_authenticate(user=self.user)

        new_group = EAPGroupFactory()

        sharing_data = {"view_groups": [new_group.id], "edit_groups": []}

        url = reverse("assurance_case_shared_with", kwargs={"pk": self.case.pk})
        response = self.client.post(url, sharing_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify permissions were updated
        self.case.refresh_from_db()
        self.assertIn(new_group, self.case.view_groups.all())

    def test_sharing_permissions_non_owner(self):
        """Test that only owners can modify sharing permissions."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=other_user)

        sharing_data = {"view_groups": [], "edit_groups": []}

        url = reverse("assurance_case_shared_with", kwargs={"pk": self.case.pk})
        response = self.client.post(url, sharing_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestAssuranceCaseIdentifierUpdates(TestCase):
    """Test assurance case identifier update functionality."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_update_case_identifiers(self):
        """Test updating case element identifiers."""
        self.client.force_authenticate(user=self.user)

        # Create some goals
        goal1 = TopLevelNormativeGoalFactory(assurance_case=self.case)
        goal2 = TopLevelNormativeGoalFactory(assurance_case=self.case)

        identifier_updates = {
            "updates": [
                {"element_id": goal1.id, "new_identifier": "G1"},
                {"element_id": goal2.id, "new_identifier": "G2"},
            ]
        }

        url = reverse("assurance_case_update_ids", kwargs={"pk": self.case.pk})
        response = self.client.post(url, identifier_updates)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify identifiers were updated
        goal1.refresh_from_db()
        goal2.refresh_from_db()
        self.assertEqual(goal1.short_description, "G1")
        self.assertEqual(goal2.short_description, "G2")

    def test_update_identifiers_no_permission(self):
        """Test updating identifiers without permission."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=other_user)

        goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        identifier_updates = {"updates": [{"element_id": goal.id, "new_identifier": "G1"}]}

        url = reverse("assurance_case_update_ids", kwargs={"pk": self.case.pk})
        response = self.client.post(url, identifier_updates)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_identifiers_invalid_element(self):
        """Test updating identifiers with invalid element ID."""
        self.client.force_authenticate(user=self.user)

        identifier_updates = {"updates": [{"element_id": 99999, "new_identifier": "G1"}]}

        url = reverse("assurance_case_update_ids", kwargs={"pk": self.case.pk})
        response = self.client.post(url, identifier_updates)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestAssuranceCasePermissions(TestCase):
    """Test comprehensive permission system for assurance cases."""

    def setUp(self):
        """Set up test users, groups, and case."""
        self.client = APIClient()

        # Create users
        self.owner = EAPUserFactory()
        self.viewer = EAPUserFactory()
        self.editor = EAPUserFactory()
        self.reviewer = EAPUserFactory()
        self.unauthorized = EAPUserFactory()

        # Create groups
        self.view_group = EAPGroupFactory(users=[self.viewer])
        self.edit_group = EAPGroupFactory(users=[self.editor])
        self.review_group = EAPGroupFactory(users=[self.reviewer])

        # Create case with permissions
        self.case = AssuranceCaseFactory(owner=self.owner)
        self.case.view_groups.add(self.view_group)
        self.case.edit_groups.add(self.edit_group)
        self.case.review_groups.add(self.review_group)

    def test_owner_has_full_access(self):
        """Test that owner has full access to case."""
        self.client.force_authenticate(user=self.owner)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})

        # Can read
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Can update
        response = self.client.patch(url, {"description": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Can delete
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_viewer_has_read_only_access(self):
        """Test that viewer can only read the case."""
        self.client.force_authenticate(user=self.viewer)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})

        # Can read
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Cannot update
        response = self.client.patch(url, {"description": "Updated"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot delete
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_editor_has_read_write_access(self):
        """Test that editor can read and write but not delete."""
        self.client.force_authenticate(user=self.editor)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})

        # Can read
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Can update
        response = self.client.patch(url, {"description": "Updated by editor"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Cannot delete (only owner can delete)
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_user_no_access(self):
        """Test that unauthorized user has no access."""
        self.client.force_authenticate(user=self.unauthorized)

        url = reverse("assurance_case_detail", kwargs={"pk": self.case.pk})

        # Cannot read
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot update
        response = self.client.patch(url, {"description": "Unauthorized"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Cannot delete
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
