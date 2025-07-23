"""
Tests for integration and collaboration models.

This module provides comprehensive tests for:
- GitHubRepository model (GitHub integration)
- Comment model (commenting system)
- AssuranceCaseImage model (image uploads)
"""

import pytest
from django.db import IntegrityError
from django.test import TestCase

from api.models import AssuranceCaseImage, Comment, GitHubRepository
from tests.factories.case_factories import AssuranceCaseFactory, TopLevelNormativeGoalFactory
from tests.factories.content_factories import (
    ContextFactory,
    EvidenceFactory,
    PropertyClaimFactory,
    StrategyFactory,
)
from tests.factories.integration_factories import (
    AssuranceCaseCommentFactory,
    AssuranceCaseImageFactory,
    CommentFactory,
    ContextCommentFactory,
    EvidenceCommentFactory,
    GitHubRepositoryFactory,
    GitHubRepositoryWithoutDescriptionFactory,
    GoalCommentFactory,
    PropertyClaimCommentFactory,
    StrategyCommentFactory,
)
from tests.factories.user_factories import EAPUserFactory


class TestGitHubRepositoryModel(TestCase):
    """Test GitHubRepository model functionality."""

    def test_should_create_github_repository_with_required_fields(self):
        """Test that GitHubRepository can be created with minimum required fields."""
        repo = GitHubRepositoryFactory()

        self.assertIsNotNone(repo.id)
        self.assertTrue(repo.name.startswith("test-repo-"))
        self.assertTrue(repo.url.startswith("https://github.com/"))
        self.assertIsNotNone(repo.description)
        self.assertIsNotNone(repo.owner)
        self.assertIsNotNone(repo.created_date)

    def test_should_have_string_representation(self):
        """Test GitHubRepository string representation."""
        repo = GitHubRepositoryFactory(name="my-awesome-repo")

        self.assertEqual(str(repo), "my-awesome-repo")

    def test_should_handle_url_validation(self):
        """Test GitHubRepository URL field validation."""
        repo = GitHubRepositoryFactory()

        # URL should be a valid URL format
        self.assertTrue(repo.url.startswith("https://"))
        self.assertIn("github.com", repo.url)

    def test_should_allow_empty_description(self):
        """Test GitHubRepository can exist without description."""
        repo = GitHubRepositoryWithoutDescriptionFactory()

        self.assertIsNone(repo.description)

    def test_should_handle_long_description(self):
        """Test GitHubRepository with maximum length description."""
        long_description = "a" * 500  # Test with long description
        repo = GitHubRepositoryFactory(description=long_description)

        self.assertEqual(repo.description, long_description)

    def test_should_delete_repository_when_owner_deleted(self):
        """Test that GitHubRepository is deleted when owner is deleted."""
        owner = EAPUserFactory()
        repo = GitHubRepositoryFactory(owner=owner)
        repo_id = repo.id

        owner.delete()

        self.assertFalse(GitHubRepository.objects.filter(id=repo_id).exists())

    def test_should_allow_multiple_repositories_per_owner(self):
        """Test that a user can own multiple repositories."""
        owner = EAPUserFactory()
        repo1 = GitHubRepositoryFactory(owner=owner, name="repo-1")
        repo2 = GitHubRepositoryFactory(owner=owner, name="repo-2")
        repo3 = GitHubRepositoryFactory(owner=owner, name="repo-3")

        self.assertEqual(owner.github_repositories.count(), 3)
        self.assertIn(repo1, owner.github_repositories.all())
        self.assertIn(repo2, owner.github_repositories.all())
        self.assertIn(repo3, owner.github_repositories.all())

    def test_should_handle_long_repository_name(self):
        """Test GitHubRepository with maximum length name."""
        long_name = "a" * 200  # Max length for name field
        repo = GitHubRepositoryFactory(name=long_name)

        self.assertEqual(repo.name, long_name)

    def test_should_handle_github_url_formats(self):
        """Test GitHubRepository with various GitHub URL formats."""
        # HTTPS format
        repo1 = GitHubRepositoryFactory(url="https://github.com/user/repo")
        self.assertEqual(repo1.url, "https://github.com/user/repo")

        # SSH format (if supported)
        repo2 = GitHubRepositoryFactory(url="git@github.com:user/repo.git")
        self.assertEqual(repo2.url, "git@github.com:user/repo.git")


class TestCommentModel(TestCase):
    """Test Comment model functionality."""

    def test_should_create_comment_with_required_fields(self):
        """Test that Comment can be created with minimum required fields."""
        comment = CommentFactory()

        self.assertIsNotNone(comment.id)
        self.assertIsNotNone(comment.author)
        self.assertIsNotNone(comment.content)
        self.assertIsNotNone(comment.assurance_case)
        self.assertIsNotNone(comment.created_at)

    def test_should_have_string_representation(self):
        """Test Comment string representation."""
        author = EAPUserFactory(username="testuser")
        case = AssuranceCaseFactory(name="Test Case")
        comment = AssuranceCaseCommentFactory(author=author, assurance_case=case)

        expected_str = "Comment by testuser on Test Case"
        self.assertEqual(str(comment), expected_str)

    def test_should_order_comments_by_creation_time(self):
        """Test Comment ordering by created_at field."""
        case = AssuranceCaseFactory()
        comment1 = AssuranceCaseCommentFactory(assurance_case=case, content="First comment")
        comment2 = AssuranceCaseCommentFactory(assurance_case=case, content="Second comment")
        comment3 = AssuranceCaseCommentFactory(assurance_case=case, content="Third comment")

        # Comments should be ordered by created_at
        comments = list(Comment.objects.filter(assurance_case=case).order_by("created_at"))
        self.assertEqual(comments[0], comment1)
        self.assertEqual(comments[1], comment2)
        self.assertEqual(comments[2], comment3)

    def test_should_support_assurance_case_comments(self):
        """Test comments on AssuranceCase."""
        case = AssuranceCaseFactory()
        comment = AssuranceCaseCommentFactory(assurance_case=case)

        self.assertEqual(comment.assurance_case, case)
        self.assertIsNone(comment.goal)
        self.assertIsNone(comment.strategy)
        self.assertIsNone(comment.property_claim)
        self.assertIsNone(comment.evidence)
        self.assertIsNone(comment.context)
        self.assertIn(comment, case.comments.all())

    def test_should_support_goal_comments(self):
        """Test comments on TopLevelNormativeGoal."""
        goal = TopLevelNormativeGoalFactory()
        comment = GoalCommentFactory(goal=goal)

        self.assertEqual(comment.goal, goal)
        self.assertEqual(comment.assurance_case, goal.assurance_case)
        self.assertIn(comment, goal.comments.all())

    def test_should_support_context_comments(self):
        """Test comments on Context."""
        context = ContextFactory()
        comment = ContextCommentFactory(context=context)

        self.assertEqual(comment.context, context)
        self.assertEqual(comment.assurance_case, context.assurance_case)
        self.assertIn(comment, context.comments.all())

    def test_should_support_strategy_comments(self):
        """Test comments on Strategy."""
        strategy = StrategyFactory()
        comment = StrategyCommentFactory(strategy=strategy)

        self.assertEqual(comment.strategy, strategy)
        self.assertEqual(comment.assurance_case, strategy.assurance_case)
        self.assertIn(comment, strategy.comments.all())

    def test_should_support_property_claim_comments(self):
        """Test comments on PropertyClaim."""
        claim = PropertyClaimFactory()
        comment = PropertyClaimCommentFactory(property_claim=claim)

        self.assertEqual(comment.property_claim, claim)
        self.assertEqual(comment.assurance_case, claim.assurance_case)
        self.assertIn(comment, claim.comments.all())

    def test_should_support_evidence_comments(self):
        """Test comments on Evidence."""
        evidence = EvidenceFactory()
        comment = EvidenceCommentFactory(evidence=evidence)

        self.assertEqual(comment.evidence, evidence)
        self.assertEqual(comment.assurance_case, evidence.assurance_case)
        self.assertIn(comment, evidence.comments.all())

    def test_should_delete_comment_when_author_deleted(self):
        """Test that Comment is deleted when author is deleted."""
        author = EAPUserFactory()
        comment = CommentFactory(author=author)
        comment_id = comment.id

        author.delete()

        self.assertFalse(Comment.objects.filter(id=comment_id).exists())

    def test_should_delete_comment_when_assurance_case_deleted(self):
        """Test that Comment is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        comment = AssuranceCaseCommentFactory(assurance_case=case)
        comment_id = comment.id

        case.delete()

        self.assertFalse(Comment.objects.filter(id=comment_id).exists())

    def test_should_delete_comment_when_target_element_deleted(self):
        """Test that Comment is deleted when target element is deleted."""
        goal = TopLevelNormativeGoalFactory()
        comment = GoalCommentFactory(goal=goal)
        comment_id = comment.id

        goal.delete()

        self.assertFalse(Comment.objects.filter(id=comment_id).exists())

    def test_should_handle_long_content(self):
        """Test Comment with long content."""
        long_content = "a" * 1000  # Test with long content
        comment = CommentFactory(content=long_content)

        self.assertEqual(comment.content, long_content)

    def test_should_allow_multiple_comments_per_element(self):
        """Test that an element can have multiple comments."""
        goal = TopLevelNormativeGoalFactory()
        comment1 = GoalCommentFactory(goal=goal, content="First comment")
        comment2 = GoalCommentFactory(goal=goal, content="Second comment")
        comment3 = GoalCommentFactory(goal=goal, content="Third comment")

        self.assertEqual(goal.comments.count(), 3)
        self.assertIn(comment1, goal.comments.all())
        self.assertIn(comment2, goal.comments.all())
        self.assertIn(comment3, goal.comments.all())

    def test_should_allow_multiple_comments_per_author(self):
        """Test that an author can create multiple comments."""
        author = EAPUserFactory()
        comment1 = CommentFactory(author=author, content="First comment")
        comment2 = CommentFactory(author=author, content="Second comment")
        comment3 = CommentFactory(author=author, content="Third comment")

        self.assertEqual(author.comments.count(), 3)
        self.assertIn(comment1, author.comments.all())
        self.assertIn(comment2, author.comments.all())
        self.assertIn(comment3, author.comments.all())


class TestAssuranceCaseImageModel(TestCase):
    """Test AssuranceCaseImage model functionality."""

    def test_should_create_assurance_case_image_with_required_fields(self):
        """Test that AssuranceCaseImage can be created with minimum required fields."""
        case_image = AssuranceCaseImageFactory()

        self.assertIsNotNone(case_image.id)
        self.assertIsNotNone(case_image.assurance_case)
        self.assertIsNotNone(case_image.image)

    def test_should_enforce_unique_constraint(self):
        """Test that AssuranceCaseImage enforces one image per case."""
        case = AssuranceCaseFactory()
        AssuranceCaseImageFactory(assurance_case=case)

        # Try to create another image for the same case
        with pytest.raises(IntegrityError):
            AssuranceCaseImageFactory(assurance_case=case)

    def test_should_delete_image_when_case_deleted(self):
        """Test that AssuranceCaseImage is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        case_image = AssuranceCaseImageFactory(assurance_case=case)
        image_id = case_image.id

        case.delete()

        self.assertFalse(AssuranceCaseImage.objects.filter(id=image_id).exists())

    def test_should_handle_image_file_properly(self):
        """Test AssuranceCaseImage handles image file properly."""
        case_image = AssuranceCaseImageFactory()

        # Image should have a name
        self.assertTrue(case_image.image.name.endswith(".png"))

        # Image should have content
        self.assertTrue(len(case_image.image.read()) > 0)

    def test_should_provide_access_through_case(self):
        """Test that AssuranceCase provides access to its image."""
        case = AssuranceCaseFactory()
        case_image = AssuranceCaseImageFactory(assurance_case=case)

        # Should be accessible through the case
        self.assertEqual(case.case_image.get(), case_image)

    def test_should_handle_image_replacement(self):
        """Test replacing an image for a case."""
        case = AssuranceCaseFactory()
        original_image = AssuranceCaseImageFactory(assurance_case=case)
        original_id = original_image.id

        # Delete the original and create a new one
        original_image.delete()
        new_image = AssuranceCaseImageFactory(assurance_case=case)

        # Original should be gone, new one should exist
        self.assertFalse(AssuranceCaseImage.objects.filter(id=original_id).exists())
        self.assertTrue(AssuranceCaseImage.objects.filter(id=new_image.id).exists())
        self.assertEqual(case.case_image.get(), new_image)


class TestIntegrationModelRelationships(TestCase):
    """Test relationships between integration models and other models."""

    def test_should_handle_complex_comment_scenario(self):
        """Test complex commenting scenario across multiple elements."""
        # Create a case with various elements
        case = AssuranceCaseFactory()
        goal = TopLevelNormativeGoalFactory(assurance_case=case)
        context = ContextFactory(goal=goal, assurance_case=case)
        strategy = StrategyFactory(goal=goal, assurance_case=case)
        claim = PropertyClaimFactory(goal=goal, assurance_case=case)
        evidence = EvidenceFactory(assurance_case=case)

        # Create comments on each element
        case_comment = AssuranceCaseCommentFactory(assurance_case=case)
        goal_comment = GoalCommentFactory(goal=goal)
        context_comment = ContextCommentFactory(context=context)
        strategy_comment = StrategyCommentFactory(strategy=strategy)
        claim_comment = PropertyClaimCommentFactory(property_claim=claim)
        evidence_comment = EvidenceCommentFactory(evidence=evidence)

        # Verify all comments belong to the same case
        self.assertEqual(case_comment.assurance_case, case)
        self.assertEqual(goal_comment.assurance_case, case)
        self.assertEqual(context_comment.assurance_case, case)
        self.assertEqual(strategy_comment.assurance_case, case)
        self.assertEqual(claim_comment.assurance_case, case)
        self.assertEqual(evidence_comment.assurance_case, case)

        # Verify case has all comments
        all_case_comments = case.comments.all()
        self.assertEqual(len(all_case_comments), 6)

    def test_should_handle_github_integration_with_users(self):
        """Test GitHub repository integration with user ownership."""
        owner = EAPUserFactory()
        repo1 = GitHubRepositoryFactory(owner=owner, name="project-1")
        repo2 = GitHubRepositoryFactory(owner=owner, name="project-2")

        # User should have access to their repositories
        self.assertEqual(owner.github_repositories.count(), 2)
        self.assertIn(repo1, owner.github_repositories.all())
        self.assertIn(repo2, owner.github_repositories.all())

    def test_should_handle_case_with_image_and_comments(self):
        """Test assurance case with both image and comments."""
        case = AssuranceCaseFactory()
        case_image = AssuranceCaseImageFactory(assurance_case=case)
        comment1 = AssuranceCaseCommentFactory(assurance_case=case)
        comment2 = AssuranceCaseCommentFactory(assurance_case=case)

        # Case should have one image and multiple comments
        self.assertEqual(case.case_image.count(), 1)
        self.assertEqual(case.comments.count(), 2)
        self.assertEqual(case.case_image.get(), case_image)
        self.assertIn(comment1, case.comments.all())
        self.assertIn(comment2, case.comments.all())
