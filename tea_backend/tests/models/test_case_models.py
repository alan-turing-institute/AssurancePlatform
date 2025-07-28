"""
Tests for core assurance case models.

This module provides comprehensive tests for:
- AssuranceCase model (main assurance case entity)
- TopLevelNormativeGoal model (top-level goals with assumptions)
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from api.models import AssuranceCase, TopLevelNormativeGoal
from tests.factories.case_factories import (
    AssuranceCaseFactory,
    AssuranceCaseWithGroupsFactory,
    EmptyGoalFactory,
    GoalWithAssumptionFactory,
    PublishedAssuranceCaseFactory,
    SandboxTopLevelNormativeGoalFactory,
    TopLevelNormativeGoalFactory,
)
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory


class TestAssuranceCaseModel(TestCase):
    """Test AssuranceCase model functionality."""

    def test_should_create_assurance_case_with_required_fields(self):
        """Test that AssuranceCase can be created with minimum required fields."""
        case = AssuranceCaseFactory()

        self.assertIsNotNone(case.id)
        self.assertTrue(case.name.startswith("Test Assurance Case"))
        self.assertIsNotNone(case.description)
        self.assertIsNotNone(case.owner)
        self.assertIsNotNone(case.created_date)
        self.assertEqual(case.color_profile, "default")
        self.assertFalse(case.published)
        self.assertIsNone(case.published_date)

    def test_should_have_string_representation(self):
        """Test AssuranceCase string representation."""
        case = AssuranceCaseFactory(name="Test Case")

        self.assertEqual(str(case), "Test Case")

    def test_should_support_published_cases(self):
        """Test AssuranceCase can be marked as published."""
        case = PublishedAssuranceCaseFactory()

        self.assertTrue(case.published)
        self.assertIsNotNone(case.published_date)

    def test_should_track_recently_published_cases(self):
        """Test was_published_recently method."""
        # Create case published today
        recent_case = AssuranceCaseFactory()
        recent_case.created_date = timezone.now() - timedelta(hours=12)
        recent_case.save()

        # Create case published 2 days ago
        old_case = AssuranceCaseFactory()
        old_case.created_date = timezone.now() - timedelta(days=2)
        old_case.save()

        self.assertTrue(recent_case.was_published_recently())
        self.assertFalse(old_case.was_published_recently())

    def test_should_handle_groups_management(self):
        """Test AssuranceCase group relationships."""
        case = AssuranceCaseWithGroupsFactory()

        self.assertEqual(case.edit_groups.count(), 1)
        self.assertEqual(case.view_groups.count(), 1)
        self.assertEqual(case.review_groups.count(), 1)

    def test_should_allow_multiple_edit_groups(self):
        """Test AssuranceCase can have multiple edit groups."""
        case = AssuranceCaseFactory()
        group1 = EAPGroupFactory()
        group2 = EAPGroupFactory()

        case.edit_groups.add(group1, group2)

        self.assertEqual(case.edit_groups.count(), 2)
        self.assertIn(group1, case.edit_groups.all())
        self.assertIn(group2, case.edit_groups.all())

    def test_should_allow_multiple_view_groups(self):
        """Test AssuranceCase can have multiple view groups."""
        case = AssuranceCaseFactory()
        group1 = EAPGroupFactory()
        group2 = EAPGroupFactory()

        case.view_groups.add(group1, group2)

        self.assertEqual(case.view_groups.count(), 2)
        self.assertIn(group1, case.view_groups.all())
        self.assertIn(group2, case.view_groups.all())

    def test_should_allow_multiple_review_groups(self):
        """Test AssuranceCase can have multiple review groups."""
        case = AssuranceCaseFactory()
        group1 = EAPGroupFactory()
        group2 = EAPGroupFactory()

        case.review_groups.add(group1, group2)

        self.assertEqual(case.review_groups.count(), 2)
        self.assertIn(group1, case.review_groups.all())
        self.assertIn(group2, case.review_groups.all())

    def test_should_handle_lock_uuid(self):
        """Test AssuranceCase lock UUID functionality."""
        case = AssuranceCaseFactory()
        test_uuid = "test-lock-uuid-12345"

        case.lock_uuid = test_uuid
        case.save()
        case.refresh_from_db()

        self.assertEqual(case.lock_uuid, test_uuid)

    def test_should_handle_color_profiles(self):
        """Test AssuranceCase color profile options."""
        # Test default color profile
        case1 = AssuranceCaseFactory()
        self.assertEqual(case1.color_profile, "default")

        # Test custom color profile
        case2 = AssuranceCaseFactory(color_profile="dark")
        self.assertEqual(case2.color_profile, "dark")

    def test_should_delete_case_when_owner_deleted(self):
        """Test that AssuranceCase is deleted when owner is deleted."""
        owner = EAPUserFactory()
        case = AssuranceCaseFactory(owner=owner)
        case_id = case.id

        owner.delete()

        self.assertFalse(AssuranceCase.objects.filter(id=case_id).exists())

    def test_should_handle_empty_published_date(self):
        """Test AssuranceCase with empty published date."""
        case = AssuranceCaseFactory(published=False, published_date=None)

        self.assertFalse(case.published)
        self.assertIsNone(case.published_date)

    def test_should_allow_same_group_in_multiple_permissions(self):
        """Test that same group can have multiple permission types."""
        case = AssuranceCaseFactory()
        group = EAPGroupFactory()

        case.edit_groups.add(group)
        case.view_groups.add(group)
        case.review_groups.add(group)

        self.assertIn(group, case.edit_groups.all())
        self.assertIn(group, case.view_groups.all())
        self.assertIn(group, case.review_groups.all())


class TestTopLevelNormativeGoalModel(TestCase):
    """Test TopLevelNormativeGoal model functionality."""

    def test_should_create_goal_with_required_fields(self):
        """Test that TopLevelNormativeGoal can be created with required fields."""
        goal = TopLevelNormativeGoalFactory()

        self.assertIsNotNone(goal.id)
        self.assertTrue(goal.name.startswith("Goal"))
        self.assertIsNotNone(goal.short_description)
        self.assertIsNotNone(goal.long_description)
        self.assertIsNotNone(goal.keywords)
        self.assertIsNotNone(goal.assurance_case)
        self.assertIsNotNone(goal.created_date)
        self.assertFalse(goal.in_sandbox)

    def test_should_have_string_representation(self):
        """Test TopLevelNormativeGoal string representation."""
        goal = TopLevelNormativeGoalFactory(name="Test Goal")

        self.assertEqual(str(goal), "Test Goal")

    def test_should_support_sandbox_mode(self):
        """Test TopLevelNormativeGoal can be in sandbox mode."""
        goal = SandboxTopLevelNormativeGoalFactory()

        self.assertTrue(goal.in_sandbox)

    def test_should_handle_assumptions(self):
        """Test TopLevelNormativeGoal assumption field."""
        goal = GoalWithAssumptionFactory()

        self.assertIsNotNone(goal.assumption)
        self.assertTrue(len(goal.assumption) > 0)

    def test_should_handle_empty_assumptions(self):
        """Test TopLevelNormativeGoal with empty assumptions."""
        goal = TopLevelNormativeGoalFactory(assumption="")

        self.assertEqual(goal.assumption, "")

    def test_should_handle_keywords_properly(self):
        """Test TopLevelNormativeGoal keywords field."""
        goal = TopLevelNormativeGoalFactory()

        # Keywords should be comma-separated
        self.assertIsNotNone(goal.keywords)
        if goal.keywords:
            self.assertIn(",", goal.keywords)

    def test_should_handle_empty_keywords(self):
        """Test TopLevelNormativeGoal with empty keywords."""
        goal = EmptyGoalFactory()

        self.assertEqual(goal.keywords, "")

    def test_should_belong_to_assurance_case(self):
        """Test TopLevelNormativeGoal belongs to AssuranceCase."""
        case = AssuranceCaseFactory()
        goal = TopLevelNormativeGoalFactory(assurance_case=case)

        self.assertEqual(goal.assurance_case, case)
        self.assertIn(goal, case.goals.all())

    def test_should_delete_goal_when_case_deleted(self):
        """Test that TopLevelNormativeGoal is deleted when AssuranceCase is deleted."""
        case = AssuranceCaseFactory()
        goal = TopLevelNormativeGoalFactory(assurance_case=case)
        goal_id = goal.id

        case.delete()

        self.assertFalse(TopLevelNormativeGoal.objects.filter(id=goal_id).exists())

    def test_should_handle_long_descriptions(self):
        """Test TopLevelNormativeGoal with maximum length descriptions."""
        long_short_desc = "a" * 1000  # Max length for short_description
        long_long_desc = "b" * 3000  # Max length for long_description
        long_keywords = "c" * 3000  # Max length for keywords

        goal = TopLevelNormativeGoalFactory(
            short_description=long_short_desc,
            long_description=long_long_desc,
            keywords=long_keywords,
        )

        self.assertEqual(goal.short_description, long_short_desc)
        self.assertEqual(goal.long_description, long_long_desc)
        self.assertEqual(goal.keywords, long_keywords)

    def test_should_handle_empty_name(self):
        """Test TopLevelNormativeGoal with empty name."""
        goal = EmptyGoalFactory()

        self.assertEqual(goal.name, "")

    def test_should_inherit_from_case_item(self):
        """Test TopLevelNormativeGoal inherits CaseItem properties."""
        goal = TopLevelNormativeGoalFactory()

        # Check CaseItem fields are present
        self.assertTrue(hasattr(goal, "name"))
        self.assertTrue(hasattr(goal, "short_description"))
        self.assertTrue(hasattr(goal, "long_description"))
        self.assertTrue(hasattr(goal, "created_date"))
        self.assertTrue(hasattr(goal, "in_sandbox"))


class TestAssuranceCaseGoalRelationship(TestCase):
    """Test relationships between AssuranceCase and TopLevelNormativeGoal."""

    def test_should_handle_multiple_goals_per_case(self):
        """Test AssuranceCase can have multiple goals."""
        case = AssuranceCaseFactory()
        goal1 = TopLevelNormativeGoalFactory(assurance_case=case)
        goal2 = TopLevelNormativeGoalFactory(assurance_case=case)
        goal3 = TopLevelNormativeGoalFactory(assurance_case=case)

        self.assertEqual(case.goals.count(), 3)
        self.assertIn(goal1, case.goals.all())
        self.assertIn(goal2, case.goals.all())
        self.assertIn(goal3, case.goals.all())

    def test_should_handle_case_without_goals(self):
        """Test AssuranceCase can exist without goals."""
        case = AssuranceCaseFactory()

        self.assertEqual(case.goals.count(), 0)

    def test_should_maintain_goal_order(self):
        """Test that goal creation order is maintained."""
        case = AssuranceCaseFactory()
        goal1 = TopLevelNormativeGoalFactory(assurance_case=case, name="First Goal")
        goal2 = TopLevelNormativeGoalFactory(assurance_case=case, name="Second Goal")
        goal3 = TopLevelNormativeGoalFactory(assurance_case=case, name="Third Goal")

        # Goals should be retrievable in creation order
        goals = list(case.goals.order_by("created_date"))
        self.assertEqual(goals[0], goal1)
        self.assertEqual(goals[1], goal2)
        self.assertEqual(goals[2], goal3)

    def test_should_handle_goal_transfer_between_cases(self):
        """Test moving goal from one case to another."""
        case1 = AssuranceCaseFactory(name="Case 1")
        case2 = AssuranceCaseFactory(name="Case 2")
        goal = TopLevelNormativeGoalFactory(assurance_case=case1)

        # Move goal to case2
        goal.assurance_case = case2
        goal.save()

        self.assertEqual(goal.assurance_case, case2)
        self.assertEqual(case1.goals.count(), 0)
        self.assertEqual(case2.goals.count(), 1)
        self.assertIn(goal, case2.goals.all())
