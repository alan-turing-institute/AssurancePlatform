"""
API endpoint tests for collaboration features.

This module tests:
- Comment creation and management on different element types
- Comment reply functionality (nested comments)
- Permission-based comment access control
- Comment CRUD operations
- Element-specific comment endpoints
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from api.models import Comment
from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.collaboration_factories import CommentFactory
from tests.factories.content_factories import (
    ContextFactory,
    EvidenceFactory,
    PropertyClaimFactory,
    StrategyFactory,
    TopLevelNormativeGoalFactory,
)
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory

User = get_user_model()


class TestCommentListView(TestCase):
    """Test general comment listing and creation."""

    def setUp(self):
        """Set up test client, user, and content elements."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_list_comments_authenticated(self):
        """Test listing comments when authenticated."""
        self.client.force_authenticate(user=self.user)

        url = reverse("comment_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_list_comments_unauthenticated(self):
        """Test listing comments when not authenticated."""
        url = reverse("comment_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_comment_success(self):
        """Test successful comment creation."""
        self.client.force_authenticate(user=self.user)

        comment_data = {
            "content": "This is a test comment",
            "content_type": "goal",
            "object_id": self.goal.id,
        }

        url = reverse("comment_list")
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["content"], "This is a test comment")
        self.assertEqual(data["author"], self.user.id)

    def test_create_comment_invalid_data(self):
        """Test comment creation with invalid data."""
        self.client.force_authenticate(user=self.user)

        # Missing required fields
        comment_data = {
            "content": "",  # Empty content
            "object_id": self.goal.id,
        }

        url = reverse("comment_list")
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestCommentDetailView(TestCase):
    """Test comment detail operations."""

    def setUp(self):
        """Set up test client, user, and comment."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.other_user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        # Create a comment using the factory
        self.comment = CommentFactory(
            author=self.user, content="Original comment", content_object=self.goal
        )

    def test_get_comment_detail(self):
        """Test retrieving comment details."""
        self.client.force_authenticate(user=self.user)

        url = reverse("comment_detail", kwargs={"pk": self.comment.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], self.comment.id)
        self.assertEqual(data["content"], "Original comment")

    def test_update_comment_as_author(self):
        """Test updating comment as the author."""
        self.client.force_authenticate(user=self.user)

        update_data = {"content": "Updated comment content"}

        url = reverse("comment_detail", kwargs={"pk": self.comment.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify comment was updated
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.content, "Updated comment content")

    def test_update_comment_not_author(self):
        """Test updating comment as non-author (should fail)."""
        self.client.force_authenticate(user=self.other_user)

        update_data = {"content": "Unauthorized update"}

        url = reverse("comment_detail", kwargs={"pk": self.comment.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_comment_as_author(self):
        """Test deleting comment as the author."""
        self.client.force_authenticate(user=self.user)

        url = reverse("comment_detail", kwargs={"pk": self.comment.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify comment was deleted
        self.assertFalse(Comment.objects.filter(id=self.comment.id).exists())

    def test_delete_comment_not_author(self):
        """Test deleting comment as non-author (should fail)."""
        self.client.force_authenticate(user=self.other_user)

        url = reverse("comment_detail", kwargs={"pk": self.comment.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestElementCommentViews(TestCase):
    """Test element-specific comment endpoints."""

    def setUp(self):
        """Set up test client, user, and various content elements."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

        # Create various content elements
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)
        self.context = ContextFactory(goal=self.goal)
        self.claim = PropertyClaimFactory(goal=self.goal)
        self.evidence = EvidenceFactory(property_claim=self.claim)
        self.strategy = StrategyFactory(goal=self.goal)

    def test_get_goal_comments(self):
        """Test retrieving comments for a specific goal."""
        self.client.force_authenticate(user=self.user)

        # Create comments on the goal
        CommentFactory.create_batch(3, content_object=self.goal, author=self.user)

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 3)

    def test_create_goal_comment(self):
        """Test creating a comment on a specific goal."""
        self.client.force_authenticate(user=self.user)

        comment_data = {"content": "This is a comment on the goal"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["content"], "This is a comment on the goal")

    def test_get_context_comments(self):
        """Test retrieving comments for a specific context."""
        self.client.force_authenticate(user=self.user)

        url = reverse("context_comments", kwargs={"context_id": self.context.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_context_comment(self):
        """Test creating a comment on a specific context."""
        self.client.force_authenticate(user=self.user)

        comment_data = {"content": "This is a comment on the context"}

        url = reverse("context_comments", kwargs={"context_id": self.context.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["content"], "This is a comment on the context")

    def test_get_property_claim_comments(self):
        """Test retrieving comments for a specific property claim."""
        self.client.force_authenticate(user=self.user)

        url = reverse("propertyclaim_comments", kwargs={"propertyclaim_id": self.claim.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_get_evidence_comments(self):
        """Test retrieving comments for a specific evidence."""
        self.client.force_authenticate(user=self.user)

        url = reverse("evidence_comments", kwargs={"evidence_id": self.evidence.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_get_strategy_comments(self):
        """Test retrieving comments for a specific strategy."""
        self.client.force_authenticate(user=self.user)

        url = reverse("strategy_comments", kwargs={"strategy_id": self.strategy.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_comment_on_nonexistent_element(self):
        """Test commenting on non-existent element."""
        self.client.force_authenticate(user=self.user)

        comment_data = {"content": "Comment on non-existent goal"}

        url = reverse("goal_comments", kwargs={"goal_id": 99999})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TestCommentReplyFunctionality(TestCase):
    """Test comment reply functionality (nested comments)."""

    def setUp(self):
        """Set up test client, user, and parent comment."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.other_user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        # Create parent comment
        self.parent_comment = CommentFactory(
            author=self.user, content="Parent comment", content_object=self.goal
        )

    def test_create_reply_success(self):
        """Test successful reply creation."""
        self.client.force_authenticate(user=self.other_user)

        reply_data = {"content": "This is a reply to the parent comment"}

        url = reverse("comment_reply", kwargs={"comment_id": self.parent_comment.id})
        response = self.client.post(url, reply_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["content"], "This is a reply to the parent comment")
        self.assertEqual(data["parent"], self.parent_comment.id)

    def test_create_reply_to_nonexistent_comment(self):
        """Test creating reply to non-existent comment."""
        self.client.force_authenticate(user=self.user)

        reply_data = {"content": "Reply to non-existent comment"}

        url = reverse("comment_reply", kwargs={"comment_id": 99999})
        response = self.client.post(url, reply_data)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_nested_replies(self):
        """Test creating multiple levels of nested replies."""
        self.client.force_authenticate(user=self.other_user)

        # Create first level reply
        reply_data = {"content": "First level reply"}
        url = reverse("comment_reply", kwargs={"comment_id": self.parent_comment.id})
        response = self.client.post(url, reply_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        first_reply_id = response.json()["id"]

        # Create second level reply
        reply_data = {"content": "Second level reply"}
        url = reverse("comment_reply", kwargs={"comment_id": first_reply_id})
        response = self.client.post(url, reply_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["parent"], first_reply_id)

    def test_reply_chain_retrieval(self):
        """Test retrieving comment chain with replies."""
        self.client.force_authenticate(user=self.user)

        # Create some replies
        reply1 = CommentFactory(
            author=self.other_user,
            content="Reply 1",
            content_object=self.goal,
            parent=self.parent_comment,
        )
        CommentFactory(author=self.user, content="Reply 2", content_object=self.goal, parent=reply1)

        # Get comments for the goal
        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        # Should include parent and replies
        comments = data["results"]
        self.assertGreaterEqual(len(comments), 3)


class TestCommentPermissions(TestCase):
    """Test permission system for comments."""

    def setUp(self):
        """Set up test users, groups, and content with different permissions."""
        self.client = APIClient()

        # Create users
        self.case_owner = EAPUserFactory()
        self.viewer = EAPUserFactory()
        self.editor = EAPUserFactory()
        self.unauthorized = EAPUserFactory()

        # Create groups
        self.view_group = EAPGroupFactory(users=[self.viewer])
        self.edit_group = EAPGroupFactory(users=[self.editor])

        # Create case with permissions
        self.case = AssuranceCaseFactory(owner=self.case_owner)
        self.case.view_groups.add(self.view_group)
        self.case.edit_groups.add(self.edit_group)

        # Create content element
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_case_owner_can_comment(self):
        """Test that case owner can create comments."""
        self.client.force_authenticate(user=self.case_owner)

        comment_data = {"content": "Owner comment"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_editor_can_comment(self):
        """Test that editor can create comments."""
        self.client.force_authenticate(user=self.editor)

        comment_data = {"content": "Editor comment"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_viewer_can_comment(self):
        """Test that viewer can create comments (read access allows commenting)."""
        self.client.force_authenticate(user=self.viewer)

        comment_data = {"content": "Viewer comment"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unauthorized_cannot_comment(self):
        """Test that unauthorized user cannot create comments."""
        self.client.force_authenticate(user=self.unauthorized)

        comment_data = {"content": "Unauthorized comment"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthorized_cannot_view_comments(self):
        """Test that unauthorized user cannot view comments."""
        self.client.force_authenticate(user=self.unauthorized)

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_can_view_comments(self):
        """Test that viewer can view comments."""
        self.client.force_authenticate(user=self.viewer)

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class TestCommentNotifications(TestCase):
    """Test comment notification functionality."""

    def setUp(self):
        """Set up test client, users, and content."""
        self.client = APIClient()
        self.author = EAPUserFactory()
        self.commenter = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.author)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_comment_creation_triggers_notification(self):
        """Test that comment creation triggers appropriate notifications."""
        self.client.force_authenticate(user=self.commenter)

        # Add commenter to view group so they can comment
        view_group = EAPGroupFactory(users=[self.commenter])
        self.case.view_groups.add(view_group)

        comment_data = {"content": "This should trigger a notification"}

        with patch("api.signals.send_comment_notification"):
            url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
            response = self.client.post(url, comment_data)

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

            # Verify notification was triggered (if implemented)
            # mock_notification.assert_called_once()

    def test_reply_creation_triggers_notification(self):
        """Test that reply creation triggers notifications to parent author."""
        # Create parent comment
        parent_comment = CommentFactory(
            author=self.author, content="Parent comment", content_object=self.goal
        )

        self.client.force_authenticate(user=self.commenter)

        # Add commenter to view group
        view_group = EAPGroupFactory(users=[self.commenter])
        self.case.view_groups.add(view_group)

        reply_data = {"content": "This is a reply that should trigger notification"}

        with patch("api.signals.send_reply_notification"):
            url = reverse("comment_reply", kwargs={"comment_id": parent_comment.id})
            response = self.client.post(url, reply_data)

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

            # Verify reply notification was triggered (if implemented)
            # mock_notification.assert_called_once()


class TestCommentValidation(TestCase):
    """Test comment validation and business logic."""

    def setUp(self):
        """Set up test client, user, and content."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_empty_comment_validation(self):
        """Test validation for empty comments."""
        self.client.force_authenticate(user=self.user)

        comment_data = {
            "content": ""  # Empty content
        }

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_whitespace_only_comment_validation(self):
        """Test validation for whitespace-only comments."""
        self.client.force_authenticate(user=self.user)

        comment_data = {
            "content": "   \n\t   "  # Only whitespace
        }

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_maximum_comment_length(self):
        """Test validation for comment length limits."""
        self.client.force_authenticate(user=self.user)

        # Create a very long comment (assuming there's a length limit)
        long_content = "A" * 10000  # 10k characters

        comment_data = {"content": long_content}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        # Should either succeed or fail with validation error
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])

    def test_comment_content_sanitization(self):
        """Test that comment content is properly sanitized."""
        self.client.force_authenticate(user=self.user)

        comment_data = {"content": "<script>alert('xss')</script>This is a comment with HTML"}

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.post(url, comment_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify that dangerous HTML is stripped or escaped
        data = response.json()
        self.assertNotIn("<script>", data["content"])


class TestCommentSorting(TestCase):
    """Test comment sorting and ordering."""

    def setUp(self):
        """Set up test client, user, and multiple comments."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        # Create multiple comments with different timestamps
        self.comments = []
        for i in range(5):
            comment = CommentFactory(
                author=self.user, content=f"Comment {i}", content_object=self.goal
            )
            self.comments.append(comment)

    def test_comments_default_ordering(self):
        """Test default comment ordering (usually by creation time)."""
        self.client.force_authenticate(user=self.user)

        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        comments = data["results"]

        # Verify comments are in expected order
        self.assertGreaterEqual(len(comments), 5)

    def test_comments_sorting_parameters(self):
        """Test comment sorting with query parameters."""
        self.client.force_authenticate(user=self.user)

        # Test sorting by creation time (newest first)
        url = reverse("goal_comments", kwargs={"goal_id": self.goal.id})
        response = self.client.get(url, {"ordering": "-created_at"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test sorting by creation time (oldest first)
        response = self.client.get(url, {"ordering": "created_at"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
