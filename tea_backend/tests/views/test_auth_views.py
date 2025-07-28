"""
API endpoint tests for authentication and user management.

This module tests:
- GitHub OAuth authentication flow
- User registration and login endpoints
- Password management endpoints
- User profile operations
- Token-based authentication
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from tests.factories.user_factories import EAPUserFactory

User = get_user_model()


class TestGitHubOAuthView(TestCase):
    """Test GitHub OAuth authentication endpoint."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_github_oauth_success(self):
        """Test successful GitHub OAuth authentication."""
        url = "/api/auth/github/"

        # Mock successful GitHub OAuth response
        mock_github_response = {
            "access_token": "test_access_token",
            "scope": "user:email",
            "token_type": "bearer",
        }

        mock_user_data = {
            "id": 12345,
            "login": "testuser",
            "email": "test@github.com",
            "name": "Test User",
        }

        with (
            patch("api.views.requests.post") as mock_post,
            patch("api.views.requests.get") as mock_get,
        ):
            # Mock GitHub token exchange
            mock_post.return_value.json.return_value = mock_github_response
            mock_post.return_value.status_code = 200

            # Mock GitHub user data fetch
            mock_get.return_value.json.return_value = mock_user_data
            mock_get.return_value.status_code = 200

            response = self.client.post(url, {"code": "test_auth_code", "state": "test_state"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertIn("user", data)

        # Verify user was created
        user = User.objects.get(auth_username="testuser")
        self.assertEqual(user.auth_provider, "github")
        self.assertEqual(user.email, "test@github.com")

    def test_github_oauth_invalid_code(self):
        """Test GitHub OAuth with invalid authorization code."""
        url = "/api/auth/github/"

        with patch("api.views.requests.post") as mock_post:
            mock_post.return_value.status_code = 400
            mock_post.return_value.json.return_value = {"error": "bad_verification_code"}

            response = self.client.post(url, {"code": "invalid_code", "state": "test_state"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_github_oauth_existing_user(self):
        """Test GitHub OAuth login for existing user."""
        # Create existing user
        existing_user = EAPUserFactory(
            auth_provider="github", auth_username="existinguser", email="existing@github.com"
        )

        url = "/api/auth/github/"

        mock_github_response = {
            "access_token": "test_access_token",
            "scope": "user:email",
            "token_type": "bearer",
        }

        mock_user_data = {
            "id": 67890,
            "login": "existinguser",
            "email": "existing@github.com",
            "name": "Existing User",
        }

        with (
            patch("api.views.requests.post") as mock_post,
            patch("api.views.requests.get") as mock_get,
        ):
            mock_post.return_value.json.return_value = mock_github_response
            mock_post.return_value.status_code = 200

            mock_get.return_value.json.return_value = mock_user_data
            mock_get.return_value.status_code = 200

            response = self.client.post(url, {"code": "test_auth_code", "state": "test_state"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["user"]["id"], existing_user.id)


class TestUserManagementViews(TestCase):
    """Test user management API endpoints."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory()

    def test_get_current_user_authenticated(self):
        """Test retrieving current user details when authenticated."""
        self.client.force_authenticate(user=self.user)
        url = reverse("self_detail")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], self.user.id)
        self.assertEqual(data["username"], self.user.username)
        self.assertEqual(data["email"], self.user.email)

    def test_get_current_user_unauthenticated(self):
        """Test retrieving current user details when not authenticated."""
        url = reverse("self_detail")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_current_user(self):
        """Test updating current user profile."""
        self.client.force_authenticate(user=self.user)
        url = reverse("self_detail")

        update_data = {"first_name": "Updated", "last_name": "Name", "email": "updated@example.com"}

        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify user was updated
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Updated")
        self.assertEqual(self.user.last_name, "Name")
        self.assertEqual(self.user.email, "updated@example.com")

    def test_list_users(self):
        """Test listing users."""
        self.client.force_authenticate(user=self.user)
        # Create additional users
        EAPUserFactory.create_batch(3)

        url = reverse("user_list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 3)

    def test_get_user_detail(self):
        """Test retrieving specific user details."""
        self.client.force_authenticate(user=self.user)
        target_user = EAPUserFactory()

        url = reverse("user_detail", kwargs={"pk": target_user.pk})

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], target_user.id)
        self.assertEqual(data["username"], target_user.username)


class TestPasswordManagement(TestCase):
    """Test password management endpoints."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory()

    def test_change_password_success(self):
        """Test successful password change."""
        self.client.force_authenticate(user=self.user)
        url = reverse("change_user_password", kwargs={"pk": self.user.pk})

        password_data = {"old_password": "testpass123", "new_password": "newpassword456"}

        response = self.client.post(url, password_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify password was changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword456"))

    def test_change_password_wrong_old_password(self):
        """Test password change with incorrect old password."""
        self.client.force_authenticate(user=self.user)
        url = reverse("change_user_password", kwargs={"pk": self.user.pk})

        password_data = {"old_password": "wrongpassword", "new_password": "newpassword456"}

        response = self.client.post(url, password_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_unauthorized_user(self):
        """Test password change for different user (should fail)."""
        self.client.force_authenticate(user=self.user)
        other_user = EAPUserFactory()

        url = reverse("change_user_password", kwargs={"pk": other_user.pk})

        password_data = {"old_password": "testpass123", "new_password": "newpassword456"}

        response = self.client.post(url, password_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestTokenAuthentication(TestCase):
    """Test token-based authentication."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_token_creation_on_user_creation(self):
        """Test that tokens are created automatically for new users."""
        user = EAPUserFactory()

        # Token should be created automatically
        token = Token.objects.filter(user=user).first()
        self.assertIsNotNone(token)
        self.assertEqual(len(token.key), 40)  # Standard token length

    def test_api_access_with_token(self):
        """Test API access using token authentication."""
        user = EAPUserFactory()
        token = Token.objects.get(user=user)

        # Set authorization header
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        url = reverse("self_detail")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], user.id)

    def test_api_access_with_invalid_token(self):
        """Test API access with invalid token."""
        self.client.credentials(HTTP_AUTHORIZATION="Token invalid_token_key")

        url = reverse("self_detail")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class TestUserRegistration(TestCase):
    """Test user registration endpoints."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    def test_user_registration_success(self):
        """Test successful user registration."""
        url = reverse("rest_register")

        registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password1": "complexpassword123",
            "password2": "complexpassword123",
        }

        response = self.client.post(url, registration_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify user was created
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "newuser@example.com")
        self.assertTrue(user.check_password("complexpassword123"))

    def test_user_registration_password_mismatch(self):
        """Test user registration with password mismatch."""
        url = reverse("rest_register")

        registration_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password1": "complexpassword123",
            "password2": "differentpassword456",
        }

        response = self.client.post(url, registration_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", str(response.content).lower())

    def test_user_registration_duplicate_username(self):
        """Test user registration with existing username."""
        existing_user = EAPUserFactory(username="existinguser")

        url = reverse("rest_register")

        registration_data = {
            "username": existing_user.username,
            "email": "different@example.com",
            "password1": "complexpassword123",
            "password2": "complexpassword123",
        }

        response = self.client.post(url, registration_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestGitHubRepositoryIntegration(TestCase):
    """Test GitHub repository integration for users."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory()

    def test_get_user_github_repositories(self):
        """Test retrieving user's GitHub repositories."""
        self.client.force_authenticate(user=self.user)
        url = reverse("github_repository_list", kwargs={"pk": self.user.pk})

        mock_repos = [
            {
                "id": 123,
                "name": "test-repo",
                "full_name": "testuser/test-repo",
                "private": False,
                "html_url": "https://github.com/testuser/test-repo",
            },
            {
                "id": 456,
                "name": "private-repo",
                "full_name": "testuser/private-repo",
                "private": True,
                "html_url": "https://github.com/testuser/private-repo",
            },
        ]

        with patch("api.views.requests.get") as mock_get:
            mock_get.return_value.json.return_value = mock_repos
            mock_get.return_value.status_code = 200

            response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["name"], "test-repo")
        self.assertEqual(data[1]["name"], "private-repo")

    def test_get_github_repositories_unauthorized(self):
        """Test accessing another user's GitHub repositories."""
        self.client.force_authenticate(user=self.user)
        other_user = EAPUserFactory()

        url = reverse("github_repository_list", kwargs={"pk": other_user.pk})

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
