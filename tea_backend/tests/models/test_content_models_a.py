"""
Tests for content models (Part A).

This module provides comprehensive tests for:
- Context model (contextual information)
- Strategy model (strategy definitions)
"""

from django.test import TestCase

from api.models import Context, Shape, Strategy
from tests.factories.case_factories import AssuranceCaseFactory, TopLevelNormativeGoalFactory
from tests.factories.content_factories import (
    ContextFactory,
    ContextWithoutGoalFactory,
    EmptyStrategyFactory,
    SandboxContextFactory,
    SandboxStrategyFactory,
    StrategyFactory,
    StrategyWithAssumptionFactory,
    StrategyWithoutGoalFactory,
)


class TestContextModel(TestCase):
    """Test Context model functionality."""

    def test_should_create_context_with_required_fields(self):
        """Test that Context can be created with minimum required fields."""
        context = ContextFactory()

        self.assertIsNotNone(context.id)
        self.assertTrue(context.name.startswith("Context"))
        self.assertIsNotNone(context.short_description)
        self.assertIsNotNone(context.long_description)
        self.assertEqual(context.shape, Shape.ROUNDED_RECTANGLE)
        self.assertIsNotNone(context.goal)
        self.assertIsNotNone(context.assurance_case)
        self.assertIsNotNone(context.created_date)
        self.assertFalse(context.in_sandbox)

    def test_should_have_correct_shape(self):
        """Test Context has correct shape value."""
        context = ContextFactory()

        self.assertEqual(context.shape, Shape.ROUNDED_RECTANGLE)

    def test_should_support_sandbox_mode(self):
        """Test Context can be in sandbox mode."""
        context = SandboxContextFactory()

        self.assertTrue(context.in_sandbox)

    def test_should_belong_to_goal_and_case(self):
        """Test Context belongs to both goal and assurance case."""
        goal = TopLevelNormativeGoalFactory()
        context = ContextFactory(goal=goal)

        self.assertEqual(context.goal, goal)
        self.assertEqual(context.assurance_case, goal.assurance_case)
        self.assertIn(context, goal.context.all())

    def test_should_allow_context_without_goal(self):
        """Test Context can exist without a goal but with case."""
        context = ContextWithoutGoalFactory()

        self.assertIsNone(context.goal)
        self.assertIsNotNone(context.assurance_case)

    def test_should_delete_context_when_goal_deleted(self):
        """Test that Context is deleted when goal is deleted."""
        goal = TopLevelNormativeGoalFactory()
        context = ContextFactory(goal=goal)
        context_id = context.id

        goal.delete()

        self.assertFalse(Context.objects.filter(id=context_id).exists())

    def test_should_delete_context_when_case_deleted(self):
        """Test that Context is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        context = ContextWithoutGoalFactory(assurance_case=case)
        context_id = context.id

        case.delete()

        self.assertFalse(Context.objects.filter(id=context_id).exists())

    def test_should_handle_empty_name(self):
        """Test Context with empty name."""
        context = ContextFactory(name="")

        self.assertEqual(context.name, "")

    def test_should_handle_long_descriptions(self):
        """Test Context with maximum length descriptions."""
        long_short_desc = "a" * 1000  # Max length for short_description
        long_long_desc = "b" * 3000  # Max length for long_description

        context = ContextFactory(short_description=long_short_desc, long_description=long_long_desc)

        self.assertEqual(context.short_description, long_short_desc)
        self.assertEqual(context.long_description, long_long_desc)

    def test_should_inherit_from_case_item(self):
        """Test Context inherits CaseItem properties."""
        context = ContextFactory()

        # Check CaseItem fields are present
        self.assertTrue(hasattr(context, "name"))
        self.assertTrue(hasattr(context, "short_description"))
        self.assertTrue(hasattr(context, "long_description"))
        self.assertTrue(hasattr(context, "created_date"))
        self.assertTrue(hasattr(context, "in_sandbox"))

    def test_should_allow_multiple_contexts_per_goal(self):
        """Test that a goal can have multiple contexts."""
        goal = TopLevelNormativeGoalFactory()
        context1 = ContextFactory(goal=goal)
        context2 = ContextFactory(goal=goal)
        context3 = ContextFactory(goal=goal)

        self.assertEqual(goal.context.count(), 3)
        self.assertIn(context1, goal.context.all())
        self.assertIn(context2, goal.context.all())
        self.assertIn(context3, goal.context.all())


class TestStrategyModel(TestCase):
    """Test Strategy model functionality."""

    def test_should_create_strategy_with_required_fields(self):
        """Test that Strategy can be created with minimum required fields."""
        strategy = StrategyFactory()

        self.assertIsNotNone(strategy.id)
        self.assertTrue(strategy.name.startswith("Strategy"))
        self.assertIsNotNone(strategy.short_description)
        self.assertIsNotNone(strategy.long_description)
        self.assertEqual(strategy.shape, Shape.ROUNDED_RECTANGLE)
        self.assertIsNotNone(strategy.assumption)
        self.assertIsNotNone(strategy.justification)
        self.assertIsNotNone(strategy.goal)
        self.assertIsNotNone(strategy.assurance_case)
        self.assertIsNotNone(strategy.created_date)
        self.assertFalse(strategy.in_sandbox)

    def test_should_have_string_representation(self):
        """Test Strategy string representation."""
        strategy = StrategyFactory(name="Test Strategy")

        self.assertEqual(str(strategy), "Test Strategy")

    def test_should_have_correct_shape(self):
        """Test Strategy has correct shape value."""
        strategy = StrategyFactory()

        self.assertEqual(strategy.shape, Shape.ROUNDED_RECTANGLE)

    def test_should_support_sandbox_mode(self):
        """Test Strategy can be in sandbox mode."""
        strategy = SandboxStrategyFactory()

        self.assertTrue(strategy.in_sandbox)

    def test_should_handle_assumptions_and_justifications(self):
        """Test Strategy assumption and justification fields."""
        strategy = StrategyWithAssumptionFactory()

        self.assertIsNotNone(strategy.assumption)
        self.assertIsNotNone(strategy.justification)
        self.assertTrue(len(strategy.assumption) > 0)
        self.assertTrue(len(strategy.justification) > 0)

    def test_should_handle_empty_assumptions_and_justifications(self):
        """Test Strategy with empty assumptions and justifications."""
        strategy = EmptyStrategyFactory()

        self.assertEqual(strategy.assumption, "")
        self.assertEqual(strategy.justification, "")

    def test_should_belong_to_goal_and_case(self):
        """Test Strategy belongs to both goal and assurance case."""
        goal = TopLevelNormativeGoalFactory()
        strategy = StrategyFactory(goal=goal)

        self.assertEqual(strategy.goal, goal)
        self.assertEqual(strategy.assurance_case, goal.assurance_case)
        self.assertIn(strategy, goal.strategies.all())

    def test_should_allow_strategy_without_goal(self):
        """Test Strategy can exist without a goal but with case."""
        strategy = StrategyWithoutGoalFactory()

        self.assertIsNone(strategy.goal)
        self.assertIsNotNone(strategy.assurance_case)

    def test_should_delete_strategy_when_goal_deleted(self):
        """Test that Strategy is deleted when goal is deleted."""
        goal = TopLevelNormativeGoalFactory()
        strategy = StrategyFactory(goal=goal)
        strategy_id = strategy.id

        goal.delete()

        self.assertFalse(Strategy.objects.filter(id=strategy_id).exists())

    def test_should_delete_strategy_when_case_deleted(self):
        """Test that Strategy is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        strategy = StrategyWithoutGoalFactory(assurance_case=case)
        strategy_id = strategy.id

        case.delete()

        self.assertFalse(Strategy.objects.filter(id=strategy_id).exists())

    def test_should_handle_empty_name(self):
        """Test Strategy with empty name."""
        strategy = StrategyFactory(name="")

        self.assertEqual(strategy.name, "")

    def test_should_handle_long_descriptions_and_text_fields(self):
        """Test Strategy with maximum length fields."""
        long_short_desc = "a" * 1000  # Max length for short_description
        long_long_desc = "b" * 3000  # Max length for long_description
        long_assumption = "c" * 1000  # Max length for assumption field
        long_justification = "d" * 1000  # Max length for justification field

        strategy = StrategyFactory(
            short_description=long_short_desc,
            long_description=long_long_desc,
            assumption=long_assumption,
            justification=long_justification,
        )

        self.assertEqual(strategy.short_description, long_short_desc)
        self.assertEqual(strategy.long_description, long_long_desc)
        self.assertEqual(strategy.assumption, long_assumption)
        self.assertEqual(strategy.justification, long_justification)

    def test_should_inherit_from_case_item(self):
        """Test Strategy inherits CaseItem properties."""
        strategy = StrategyFactory()

        # Check CaseItem fields are present
        self.assertTrue(hasattr(strategy, "name"))
        self.assertTrue(hasattr(strategy, "short_description"))
        self.assertTrue(hasattr(strategy, "long_description"))
        self.assertTrue(hasattr(strategy, "created_date"))
        self.assertTrue(hasattr(strategy, "in_sandbox"))

    def test_should_allow_multiple_strategies_per_goal(self):
        """Test that a goal can have multiple strategies."""
        goal = TopLevelNormativeGoalFactory()
        strategy1 = StrategyFactory(goal=goal)
        strategy2 = StrategyFactory(goal=goal)
        strategy3 = StrategyFactory(goal=goal)

        self.assertEqual(goal.strategies.count(), 3)
        self.assertIn(strategy1, goal.strategies.all())
        self.assertIn(strategy2, goal.strategies.all())
        self.assertIn(strategy3, goal.strategies.all())


class TestContextStrategyRelationships(TestCase):
    """Test relationships between Context, Strategy, and other models."""

    def test_should_handle_goal_with_contexts_and_strategies(self):
        """Test goal can have both contexts and strategies."""
        goal = TopLevelNormativeGoalFactory()
        context1 = ContextFactory(goal=goal)
        context2 = ContextFactory(goal=goal)
        strategy1 = StrategyFactory(goal=goal)
        strategy2 = StrategyFactory(goal=goal)

        self.assertEqual(goal.context.count(), 2)
        self.assertEqual(goal.strategies.count(), 2)
        self.assertIn(context1, goal.context.all())
        self.assertIn(context2, goal.context.all())
        self.assertIn(strategy1, goal.strategies.all())
        self.assertIn(strategy2, goal.strategies.all())

    def test_should_handle_case_with_orphaned_content(self):
        """Test assurance case can have contexts and strategies without goals."""
        case = AssuranceCaseFactory()
        context = ContextWithoutGoalFactory(assurance_case=case)
        strategy = StrategyWithoutGoalFactory(assurance_case=case)

        self.assertEqual(case.contexts.count(), 1)
        self.assertEqual(case.strategies.count(), 1)
        self.assertIn(context, case.contexts.all())
        self.assertIn(strategy, case.strategies.all())

    def test_should_maintain_consistency_across_goal_and_case(self):
        """Test that goal and case relationships are consistent."""
        goal = TopLevelNormativeGoalFactory()
        context = ContextFactory(goal=goal)
        strategy = StrategyFactory(goal=goal)

        # Both should belong to the same case as the goal
        self.assertEqual(context.assurance_case, goal.assurance_case)
        self.assertEqual(strategy.assurance_case, goal.assurance_case)

        # Both should appear in case's content collections
        self.assertIn(context, goal.assurance_case.contexts.all())
        self.assertIn(strategy, goal.assurance_case.strategies.all())

    def test_should_handle_content_transfer_between_goals(self):
        """Test moving content from one goal to another."""
        goal1 = TopLevelNormativeGoalFactory()
        goal2 = TopLevelNormativeGoalFactory()
        context = ContextFactory(goal=goal1)
        strategy = StrategyFactory(goal=goal1)

        # Move content to goal2
        context.goal = goal2
        context.assurance_case = goal2.assurance_case
        context.save()

        strategy.goal = goal2
        strategy.assurance_case = goal2.assurance_case
        strategy.save()

        # Verify transfer
        self.assertEqual(goal1.context.count(), 0)
        self.assertEqual(goal1.strategies.count(), 0)
        self.assertEqual(goal2.context.count(), 1)
        self.assertEqual(goal2.strategies.count(), 1)
        self.assertIn(context, goal2.context.all())
        self.assertIn(strategy, goal2.strategies.all())
