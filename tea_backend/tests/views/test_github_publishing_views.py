"""
API endpoint tests for GitHub integration and publishing features.

This module tests:
- GitHub repository management
- OAuth token handling and validation
- Publishing workflow automation
- Repository synchronization
- Branch and commit management
"""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import GitHubRepository, PublishedAssuranceCase
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.integration_factories import (
    GitHubRepositoryFactory,
    PublishedAssuranceCaseFactory,
)
from tests.factories.user_factories import EAPUserFactory

User = get_user_model()


class TestGitHubRepositoryViews(TestCase):
    """Test GitHub repository management API endpoints."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory(auth_provider="github", auth_username="testuser")
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_list_github_repositories_authenticated(self):
        """Test listing GitHub repositories when authenticated."""
        self.client.force_authenticate(user=self.user)

        url = reverse("githubrepository_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_list_github_repositories_unauthenticated(self):
        """Test listing GitHub repositories when not authenticated."""
        url = reverse("githubrepository_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_github_repository_success(self):
        """Test successful GitHub repository creation."""
        self.client.force_authenticate(user=self.user)

        repo_data = {
            "name": "test-assurance-repo",
            "url": "https://github.com/testuser/test-assurance-repo",
            "owner": self.user.id,
        }

        url = reverse("githubrepository_list")
        response = self.client.post(url, repo_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "test-assurance-repo")
        self.assertEqual(data["owner"], self.user.id)

    def test_create_github_repository_invalid_url(self):
        """Test GitHub repository creation with invalid URL."""
        self.client.force_authenticate(user=self.user)

        repo_data = {
            "name": "test-repo",
            "url": "invalid-url",  # Invalid URL format
            "owner": self.user.id,
        }

        url = reverse("githubrepository_list")
        response = self.client.post(url, repo_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_repository_detail(self):
        """Test retrieving GitHub repository details."""
        self.client.force_authenticate(user=self.user)

        # Create repository using factory
        repo = GitHubRepositoryFactory(owner=self.user)

        url = reverse("githubrepository_detail", kwargs={"pk": repo.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], repo.id)
        self.assertEqual(data["name"], repo.name)

    def test_update_repository_as_owner(self):
        """Test updating repository as owner."""
        self.client.force_authenticate(user=self.user)

        repo = GitHubRepositoryFactory(owner=self.user)

        update_data = {"name": "updated-repo-name"}

        url = reverse("githubrepository_detail", kwargs={"pk": repo.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify repository was updated
        repo.refresh_from_db()
        self.assertEqual(repo.name, "updated-repo-name")

    def test_delete_repository_as_owner(self):
        """Test deleting repository as owner."""
        self.client.force_authenticate(user=self.user)

        repo = GitHubRepositoryFactory(owner=self.user)

        url = reverse("githubrepository_detail", kwargs={"pk": repo.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify repository was deleted
        self.assertFalse(GitHubRepository.objects.filter(id=repo.id).exists())

    def test_access_other_user_repository(self):
        """Test accessing another user's repository (should fail)."""
        other_user = EAPUserFactory()
        self.client.force_authenticate(user=self.user)

        other_repo = GitHubRepositoryFactory(owner=other_user)

        url = reverse("githubrepository_detail", kwargs={"pk": other_repo.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestGitHubIntegrationViews(TestCase):
    """Test GitHub OAuth and integration endpoints."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory(auth_provider="github", auth_username="testuser")

    @patch("requests.get")
    def test_sync_user_repositories(self, mock_get):
        """Test syncing user repositories from GitHub."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API response
        mock_repos = [
            {
                "id": 123,
                "name": "repo1",
                "full_name": "testuser/repo1",
                "html_url": "https://github.com/testuser/repo1",
                "private": False,
            },
            {
                "id": 456,
                "name": "repo2",
                "full_name": "testuser/repo2",
                "html_url": "https://github.com/testuser/repo2",
                "private": True,
            },
        ]

        mock_get.return_value.json.return_value = mock_repos
        mock_get.return_value.status_code = 200

        url = reverse("sync_github_repositories")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("synced_count", data)
        self.assertEqual(data["synced_count"], 2)

    @patch("requests.get")
    def test_sync_repositories_api_error(self, mock_get):
        """Test repository sync when GitHub API returns error."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API error
        mock_get.return_value.status_code = 401
        mock_get.return_value.json.return_value = {"message": "Bad credentials"}

        url = reverse("sync_github_repositories")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sync_repositories_non_github_user(self):
        """Test repository sync for non-GitHub user."""
        non_github_user = EAPUserFactory(auth_provider="local")
        self.client.force_authenticate(user=non_github_user)

        url = reverse("sync_github_repositories")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("requests.post")
    def test_create_github_repository(self, mock_post):
        """Test creating a new repository on GitHub."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API response for repository creation
        mock_response = {
            "id": 789,
            "name": "new-repo",
            "full_name": "testuser/new-repo",
            "html_url": "https://github.com/testuser/new-repo",
            "private": False,
        }

        mock_post.return_value.json.return_value = mock_response
        mock_post.return_value.status_code = 201

        repo_data = {
            "name": "new-repo",
            "description": "A new repository for testing",
            "private": False,
        }

        url = reverse("create_github_repository")
        response = self.client.post(url, repo_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "new-repo")


class TestPublishingWorkflow(TestCase):
    """Test assurance case publishing workflow."""

    def setUp(self):
        """Set up test client, user, case, and repository."""
        self.client = APIClient()
        self.user = EAPUserFactory(auth_provider="github", auth_username="testuser")
        self.case = AssuranceCaseFactory(owner=self.user)

        self.repo = GitHubRepositoryFactory(owner=self.user)

    @patch("requests.put")
    @patch("requests.get")
    def test_publish_case_to_github(self, mock_get, mock_put):
        """Test publishing assurance case to GitHub repository."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API responses
        mock_get.return_value.status_code = 404  # File doesn't exist
        mock_put.return_value.status_code = 201  # File created
        mock_put.return_value.json.return_value = {
            "commit": {"sha": "abc123"},
            "content": {"sha": "def456"},
        }

        publish_data = {
            "case_id": self.case.id,
            "repository_id": self.repo.id,
            "branch": "main",
            "file_path": "assurance-case.json",
            "commit_message": "Publish assurance case",
        }

        url = reverse("publish_case_to_github")
        response = self.client.post(url, publish_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("commit_sha", data)

    def test_publish_case_invalid_repository(self):
        """Test publishing case to invalid repository."""
        self.client.force_authenticate(user=self.user)

        publish_data = {
            "case_id": self.case.id,
            "repository_id": 99999,  # Non-existent repository
            "branch": "main",
            "file_path": "assurance-case.json",
        }

        url = reverse("publish_case_to_github")
        response = self.client.post(url, publish_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_publish_case_no_repository_permission(self):
        """Test publishing case to repository without permission."""
        other_user = EAPUserFactory()
        other_repo = GitHubRepositoryFactory(owner=other_user)

        self.client.force_authenticate(user=self.user)

        publish_data = {
            "case_id": self.case.id,
            "repository_id": other_repo.id,
            "branch": "main",
            "file_path": "assurance-case.json",
        }

        url = reverse("publish_case_to_github")
        response = self.client.post(url, publish_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch("requests.get")
    def test_get_repository_branches(self, mock_get):
        """Test retrieving repository branches."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API response
        mock_branches = [
            {"name": "main", "commit": {"sha": "abc123"}},
            {"name": "develop", "commit": {"sha": "def456"}},
            {"name": "feature/new-goals", "commit": {"sha": "ghi789"}},
        ]

        mock_get.return_value.json.return_value = mock_branches
        mock_get.return_value.status_code = 200

        url = reverse("repository_branches", kwargs={"pk": self.repo.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data["branches"]), 3)
        self.assertEqual(data["branches"][0]["name"], "main")

    @patch("requests.get")
    def test_get_repository_commits(self, mock_get):
        """Test retrieving repository commits."""
        self.client.force_authenticate(user=self.user)

        # Mock GitHub API response
        mock_commits = [
            {
                "sha": "abc123",
                "commit": {"message": "Initial commit", "author": {"date": "2024-01-01T00:00:00Z"}},
            },
            {
                "sha": "def456",
                "commit": {"message": "Add new goals", "author": {"date": "2024-01-02T00:00:00Z"}},
            },
        ]

        mock_get.return_value.json.return_value = mock_commits
        mock_get.return_value.status_code = 200

        url = reverse("repository_commits", kwargs={"pk": self.repo.pk})
        response = self.client.get(url, {"branch": "main"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data["commits"]), 2)


class TestPublishedAssuranceCaseViews(TestCase):
    """Test published assurance case management."""

    def setUp(self):
        """Set up test client, user, and published case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_list_published_cases(self):
        """Test listing published assurance cases."""
        self.client.force_authenticate(user=self.user)

        # Create published cases
        PublishedAssuranceCaseFactory.create_batch(3)

        url = reverse("published_case_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_published_case(self):
        """Test creating a published assurance case."""
        self.client.force_authenticate(user=self.user)

        repo = GitHubRepositoryFactory(owner=self.user)

        published_data = {
            "assurance_case": self.case.id,
            "repository": repo.id,
            "branch": "main",
            "file_path": "published-case.json",
            "commit_sha": "abc123def456",
            "description": "Published version of the assurance case",
        }

        url = reverse("published_case_list")
        response = self.client.post(url, published_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["assurance_case"], self.case.id)

    def test_get_published_case_detail(self):
        """Test retrieving published case details."""
        self.client.force_authenticate(user=self.user)

        published_case = PublishedAssuranceCaseFactory(assurance_case=self.case)

        url = reverse("published_case_detail", kwargs={"pk": published_case.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], published_case.id)

    def test_update_published_case(self):
        """Test updating published case."""
        self.client.force_authenticate(user=self.user)

        published_case = PublishedAssuranceCaseFactory(assurance_case=self.case)

        update_data = {"description": "Updated description", "commit_sha": "new123sha456"}

        url = reverse("published_case_detail", kwargs={"pk": published_case.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify published case was updated
        published_case.refresh_from_db()
        self.assertEqual(published_case.description, "Updated description")

    def test_delete_published_case(self):
        """Test deleting published case."""
        self.client.force_authenticate(user=self.user)

        published_case = PublishedAssuranceCaseFactory(assurance_case=self.case)

        url = reverse("published_case_detail", kwargs={"pk": published_case.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify published case was deleted
        self.assertFalse(PublishedAssuranceCase.objects.filter(id=published_case.id).exists())


class TestGitHubTokenValidation(TestCase):
    """Test GitHub token validation and management."""

    def setUp(self):
        """Set up test client and user."""
        self.client = APIClient()
        self.user = EAPUserFactory(auth_provider="github")

    @patch("requests.get")
    def test_validate_github_token_success(self, mock_get):
        """Test successful GitHub token validation."""
        self.client.force_authenticate(user=self.user)

        # Mock successful GitHub API response
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = {"login": "testuser", "id": 12345}

        url = reverse("validate_github_token")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data["valid"])

    @patch("requests.get")
    def test_validate_github_token_invalid(self, mock_get):
        """Test invalid GitHub token validation."""
        self.client.force_authenticate(user=self.user)

        # Mock failed GitHub API response
        mock_get.return_value.status_code = 401
        mock_get.return_value.json.return_value = {"message": "Bad credentials"}

        url = reverse("validate_github_token")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data["valid"])

    def test_validate_token_non_github_user(self):
        """Test token validation for non-GitHub user."""
        local_user = EAPUserFactory(auth_provider="local")
        self.client.force_authenticate(user=local_user)

        url = reverse("validate_github_token")
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestGitHubWebhooks(TestCase):
    """Test GitHub webhook handling."""

    def setUp(self):
        """Set up test client."""
        self.client = APIClient()

    @patch("api.views.verify_github_signature")
    def test_github_webhook_push_event(self, mock_verify):
        """Test handling GitHub push webhook event."""
        # Mock signature verification
        mock_verify.return_value = True

        webhook_data = {
            "ref": "refs/heads/main",
            "repository": {
                "full_name": "testuser/test-repo",
                "html_url": "https://github.com/testuser/test-repo",
            },
            "commits": [
                {
                    "id": "abc123",
                    "message": "Update assurance case",
                    "author": {"name": "Test User"},
                }
            ],
        }

        headers = {
            "HTTP_X_GITHUB_EVENT": "push",
            "HTTP_X_HUB_SIGNATURE_256": "sha256=test_signature",
        }

        url = reverse("github_webhook")
        response = self.client.post(
            url, data=json.dumps(webhook_data), content_type="application/json", **headers
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_github_webhook_invalid_signature(self):
        """Test handling webhook with invalid signature."""
        webhook_data = {"test": "data"}

        headers = {"HTTP_X_GITHUB_EVENT": "push", "HTTP_X_HUB_SIGNATURE_256": "invalid_signature"}

        url = reverse("github_webhook")
        response = self.client.post(
            url, data=json.dumps(webhook_data), content_type="application/json", **headers
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_github_webhook_unsupported_event(self):
        """Test handling unsupported webhook event."""
        webhook_data = {"test": "data"}

        headers = {
            "HTTP_X_GITHUB_EVENT": "issues",  # Unsupported event
            "HTTP_X_HUB_SIGNATURE_256": "sha256=test_signature",
        }

        with patch("api.views.verify_github_signature", return_value=True):
            url = reverse("github_webhook")
            response = self.client.post(
                url, data=json.dumps(webhook_data), content_type="application/json", **headers
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("ignored", data["message"])
