"""
API endpoint tests for content management.

This module tests:
- Context element CRUD operations and attach/detach functionality
- Property claim CRUD operations and attach/detach functionality
- Evidence element CRUD operations and attach/detach functionality
- Strategy element CRUD operations and attach/detach functionality
- Top-level normative goal operations
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from tests.factories.case_factories import AssuranceCaseFactory
from tests.factories.content_factories import (
    ContextFactory,
    EvidenceFactory,
    PropertyClaimFactory,
    StrategyFactory,
    TopLevelNormativeGoalFactory,
)
from tests.factories.user_factories import EAPGroupFactory, EAPUserFactory

User = get_user_model()


class TestTopLevelNormativeGoalViews(TestCase):
    """Test top-level normative goal API endpoints."""

    def setUp(self):
        """Set up test client, user, and case."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

    def test_list_goals_authenticated(self):
        """Test listing goals when authenticated."""
        self.client.force_authenticate(user=self.user)

        # Create goals in the user's case
        TopLevelNormativeGoalFactory.create_batch(3, assurance_case=self.case)

        url = reverse("goal_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)
        self.assertGreaterEqual(len(data["results"]), 3)

    def test_list_goals_unauthenticated(self):
        """Test listing goals when not authenticated."""
        url = reverse("goal_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_goal_success(self):
        """Test successful goal creation."""
        self.client.force_authenticate(user=self.user)

        goal_data = {
            "name": "Test Goal",
            "short_description": "G1",
            "long_description": "A test goal for API testing",
            "assurance_case": self.case.id,
        }

        url = reverse("goal_list")
        response = self.client.post(url, goal_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Goal")
        self.assertEqual(data["assurance_case"], self.case.id)

    def test_create_goal_without_case_permission(self):
        """Test goal creation without case permission."""
        other_user = EAPUserFactory()
        other_case = AssuranceCaseFactory(owner=other_user)

        self.client.force_authenticate(user=self.user)

        goal_data = {
            "name": "Unauthorized Goal",
            "short_description": "G1",
            "assurance_case": other_case.id,
        }

        url = reverse("goal_list")
        response = self.client.post(url, goal_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_goal_detail(self):
        """Test retrieving goal details."""
        self.client.force_authenticate(user=self.user)

        goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        url = reverse("goal_detail", kwargs={"pk": goal.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["id"], goal.id)
        self.assertEqual(data["name"], goal.name)

    def test_update_goal_success(self):
        """Test successful goal update."""
        self.client.force_authenticate(user=self.user)

        goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        update_data = {"name": "Updated Goal Name", "long_description": "Updated description"}

        url = reverse("goal_detail", kwargs={"pk": goal.pk})
        response = self.client.patch(url, update_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify goal was updated
        goal.refresh_from_db()
        self.assertEqual(goal.name, "Updated Goal Name")
        self.assertEqual(goal.long_description, "Updated description")

    def test_delete_goal_success(self):
        """Test successful goal deletion."""
        self.client.force_authenticate(user=self.user)

        goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

        url = reverse("goal_detail", kwargs={"pk": goal.pk})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify goal was deleted
        from api.models import TopLevelNormativeGoal

        self.assertFalse(TopLevelNormativeGoal.objects.filter(id=goal.id).exists())


class TestContextViews(TestCase):
    """Test context element API endpoints."""

    def setUp(self):
        """Set up test client, user, case, and goal."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_list_contexts(self):
        """Test listing context elements."""
        self.client.force_authenticate(user=self.user)

        ContextFactory.create_batch(3, goal=self.goal)

        url = reverse("context_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_context_success(self):
        """Test successful context creation."""
        self.client.force_authenticate(user=self.user)

        context_data = {
            "name": "Test Context",
            "short_description": "C1",
            "long_description": "A test context element",
            "goal": self.goal.id,
        }

        url = reverse("context_list")
        response = self.client.post(url, context_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Context")
        self.assertEqual(data["goal"], self.goal.id)

    def test_attach_context_to_goal(self):
        """Test attaching context to goal."""
        self.client.force_authenticate(user=self.user)

        context = ContextFactory()

        attach_data = {"context_id": context.id, "goal_id": self.goal.id}

        url = reverse("context_attach")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attachment
        context.refresh_from_db()
        self.assertEqual(context.goal, self.goal)

    def test_detach_context_from_goal(self):
        """Test detaching context from goal."""
        self.client.force_authenticate(user=self.user)

        context = ContextFactory(goal=self.goal)

        detach_data = {"context_id": context.id}

        url = reverse("context_detach")
        response = self.client.post(url, detach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify detachment
        context.refresh_from_db()
        self.assertIsNone(context.goal)

    def test_attach_context_without_permission(self):
        """Test attaching context without goal permission."""
        other_user = EAPUserFactory()
        other_case = AssuranceCaseFactory(owner=other_user)
        other_goal = TopLevelNormativeGoalFactory(assurance_case=other_case)

        self.client.force_authenticate(user=self.user)

        context = ContextFactory()

        attach_data = {"context_id": context.id, "goal_id": other_goal.id}

        url = reverse("context_attach")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestPropertyClaimViews(TestCase):
    """Test property claim API endpoints."""

    def setUp(self):
        """Set up test client, user, case, and goal."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_list_property_claims(self):
        """Test listing property claims."""
        self.client.force_authenticate(user=self.user)

        PropertyClaimFactory.create_batch(3, goal=self.goal)

        url = reverse("propertyclaim_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_property_claim_success(self):
        """Test successful property claim creation."""
        self.client.force_authenticate(user=self.user)

        claim_data = {
            "name": "Test Property Claim",
            "short_description": "P1",
            "long_description": "A test property claim",
            "goal": self.goal.id,
        }

        url = reverse("propertyclaim_list")
        response = self.client.post(url, claim_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Property Claim")
        self.assertEqual(data["goal"], self.goal.id)

    def test_attach_property_claim_to_goal(self):
        """Test attaching property claim to goal."""
        self.client.force_authenticate(user=self.user)

        claim = PropertyClaimFactory()

        attach_data = {"propertyclaim_id": claim.id, "goal_id": self.goal.id}

        url = reverse("propertyclaim_attach")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attachment
        claim.refresh_from_db()
        self.assertEqual(claim.goal, self.goal)

    def test_detach_property_claim_from_goal(self):
        """Test detaching property claim from goal."""
        self.client.force_authenticate(user=self.user)

        claim = PropertyClaimFactory(goal=self.goal)

        detach_data = {"propertyclaim_id": claim.id}

        url = reverse("propertyclaim_detach")
        response = self.client.post(url, detach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify detachment
        claim.refresh_from_db()
        self.assertIsNone(claim.goal)

    def test_attach_property_claim_to_strategy(self):
        """Test attaching property claim to strategy."""
        self.client.force_authenticate(user=self.user)

        strategy = StrategyFactory(goal=self.goal)
        claim = PropertyClaimFactory()

        attach_data = {"propertyclaim_id": claim.id, "strategy_id": strategy.id}

        url = reverse("propertyclaim_attach_strategy")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attachment
        claim.refresh_from_db()
        self.assertEqual(claim.strategy, strategy)

    def test_create_sub_claim(self):
        """Test creating a sub-claim."""
        self.client.force_authenticate(user=self.user)

        parent_claim = PropertyClaimFactory(goal=self.goal)

        sub_claim_data = {
            "name": "Sub Property Claim",
            "short_description": "P1.1",
            "long_description": "A sub-claim",
            "property_claim": parent_claim.id,
        }

        url = reverse("propertyclaim_list")
        response = self.client.post(url, sub_claim_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["property_claim"], parent_claim.id)


class TestEvidenceViews(TestCase):
    """Test evidence element API endpoints."""

    def setUp(self):
        """Set up test client, user, case, and claim."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)
        self.claim = PropertyClaimFactory(goal=self.goal)

    def test_list_evidence(self):
        """Test listing evidence elements."""
        self.client.force_authenticate(user=self.user)

        EvidenceFactory.create_batch(3, property_claim=self.claim)

        url = reverse("evidence_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_evidence_success(self):
        """Test successful evidence creation."""
        self.client.force_authenticate(user=self.user)

        evidence_data = {
            "name": "Test Evidence",
            "short_description": "E1",
            "long_description": "Test evidence description",
            "URL": "https://example.com/evidence",
            "property_claim": self.claim.id,
        }

        url = reverse("evidence_list")
        response = self.client.post(url, evidence_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Evidence")
        self.assertEqual(data["property_claim"], self.claim.id)

    def test_attach_evidence_to_claim(self):
        """Test attaching evidence to property claim."""
        self.client.force_authenticate(user=self.user)

        evidence = EvidenceFactory()

        attach_data = {"evidence_id": evidence.id, "propertyclaim_id": self.claim.id}

        url = reverse("evidence_attach")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attachment
        evidence.refresh_from_db()
        self.assertEqual(evidence.property_claim, self.claim)

    def test_detach_evidence_from_claim(self):
        """Test detaching evidence from property claim."""
        self.client.force_authenticate(user=self.user)

        evidence = EvidenceFactory(property_claim=self.claim)

        detach_data = {"evidence_id": evidence.id}

        url = reverse("evidence_detach")
        response = self.client.post(url, detach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify detachment
        evidence.refresh_from_db()
        self.assertIsNone(evidence.property_claim)

    def test_evidence_url_validation(self):
        """Test evidence URL validation."""
        self.client.force_authenticate(user=self.user)

        evidence_data = {
            "name": "Test Evidence",
            "short_description": "E1",
            "URL": "invalid-url",  # Invalid URL format
            "property_claim": self.claim.id,
        }

        url = reverse("evidence_list")
        response = self.client.post(url, evidence_data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class TestStrategyViews(TestCase):
    """Test strategy element API endpoints."""

    def setUp(self):
        """Set up test client, user, case, and goal."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)

    def test_list_strategies(self):
        """Test listing strategy elements."""
        self.client.force_authenticate(user=self.user)

        StrategyFactory.create_batch(3, goal=self.goal)

        url = reverse("strategy_list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("results", data)

    def test_create_strategy_success(self):
        """Test successful strategy creation."""
        self.client.force_authenticate(user=self.user)

        strategy_data = {
            "name": "Test Strategy",
            "short_description": "S1",
            "long_description": "A test strategy",
            "goal": self.goal.id,
        }

        url = reverse("strategy_list")
        response = self.client.post(url, strategy_data)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "Test Strategy")
        self.assertEqual(data["goal"], self.goal.id)

    def test_attach_strategy_to_goal(self):
        """Test attaching strategy to goal."""
        self.client.force_authenticate(user=self.user)

        strategy = StrategyFactory()

        attach_data = {"strategy_id": strategy.id, "goal_id": self.goal.id}

        url = reverse("strategy_attach")
        response = self.client.post(url, attach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify attachment
        strategy.refresh_from_db()
        self.assertEqual(strategy.goal, self.goal)

    def test_detach_strategy_from_goal(self):
        """Test detaching strategy from goal."""
        self.client.force_authenticate(user=self.user)

        strategy = StrategyFactory(goal=self.goal)

        detach_data = {"strategy_id": strategy.id}

        url = reverse("strategy_detach")
        response = self.client.post(url, detach_data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify detachment
        strategy.refresh_from_db()
        self.assertIsNone(strategy.goal)


class TestContentElementPermissions(TestCase):
    """Test permission system for content elements."""

    def setUp(self):
        """Set up test users, cases, and content elements."""
        self.client = APIClient()

        # Create users
        self.owner = EAPUserFactory()
        self.editor = EAPUserFactory()
        self.viewer = EAPUserFactory()
        self.unauthorized = EAPUserFactory()

        # Create groups
        self.edit_group = EAPGroupFactory(users=[self.editor])
        self.view_group = EAPGroupFactory(users=[self.viewer])

        # Create case with permissions
        self.case = AssuranceCaseFactory(owner=self.owner)
        self.case.edit_groups.add(self.edit_group)
        self.case.view_groups.add(self.view_group)

        # Create content elements
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)
        self.context = ContextFactory(goal=self.goal)
        self.claim = PropertyClaimFactory(goal=self.goal)
        self.evidence = EvidenceFactory(property_claim=self.claim)
        self.strategy = StrategyFactory(goal=self.goal)

    def test_owner_can_modify_content(self):
        """Test that case owner can modify all content elements."""
        self.client.force_authenticate(user=self.owner)

        # Test goal update
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.patch(url, {"name": "Updated by owner"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test context update
        url = reverse("context_detail", kwargs={"pk": self.context.pk})
        response = self.client.patch(url, {"name": "Updated context"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_editor_can_modify_content(self):
        """Test that editor can modify content elements."""
        self.client.force_authenticate(user=self.editor)

        # Test goal update
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.patch(url, {"name": "Updated by editor"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_viewer_cannot_modify_content(self):
        """Test that viewer cannot modify content elements."""
        self.client.force_authenticate(user=self.viewer)

        # Test goal update (should fail)
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.patch(url, {"name": "Unauthorized update"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_can_read_content(self):
        """Test that viewer can read content elements."""
        self.client.force_authenticate(user=self.viewer)

        # Test goal read
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthorized_user_no_access(self):
        """Test that unauthorized user has no access to content."""
        self.client.force_authenticate(user=self.unauthorized)

        # Test goal read (should fail)
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TestContentElementRelationships(TestCase):
    """Test complex relationships between content elements."""

    def setUp(self):
        """Set up test content hierarchy."""
        self.client = APIClient()
        self.user = EAPUserFactory()
        self.case = AssuranceCaseFactory(owner=self.user)

        # Create content hierarchy
        self.goal = TopLevelNormativeGoalFactory(assurance_case=self.case)
        self.strategy = StrategyFactory(goal=self.goal)
        self.claim = PropertyClaimFactory(goal=self.goal)
        self.sub_claim = PropertyClaimFactory(property_claim=self.claim)
        self.evidence = EvidenceFactory(property_claim=self.sub_claim)
        self.context = ContextFactory(goal=self.goal)

    def test_hierarchical_relationships(self):
        """Test that hierarchical relationships work correctly."""
        self.client.force_authenticate(user=self.user)

        # Test goal has strategy
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.get(url)
        data = response.json()

        # Should include related elements
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(data["id"], self.goal.id)

    def test_cascade_delete_behavior(self):
        """Test cascade delete behavior when removing parent elements."""
        self.client.force_authenticate(user=self.user)

        # Delete the goal
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify related elements are handled correctly

        # Context should be detached (set to None), not deleted
        self.context.refresh_from_db()
        self.assertIsNone(self.context.goal)

        # Strategy should be detached
        self.strategy.refresh_from_db()
        self.assertIsNone(self.strategy.goal)

    def test_attach_detach_validation(self):
        """Test validation for attach/detach operations."""
        self.client.force_authenticate(user=self.user)

        # Try to attach context to non-existent goal
        attach_data = {
            "context_id": self.context.id,
            "goal_id": 99999,  # Non-existent goal
        }

        url = reverse("context_attach")
        response = self.client.post(url, attach_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_case_attachment_prevention(self):
        """Test that elements cannot be attached across different cases."""
        self.client.force_authenticate(user=self.user)

        # Create another case and goal
        other_case = AssuranceCaseFactory(owner=self.user)
        other_goal = TopLevelNormativeGoalFactory(assurance_case=other_case)

        # Try to attach context from one case to goal in another case
        attach_data = {"context_id": self.context.id, "goal_id": other_goal.id}

        url = reverse("context_attach")
        response = self.client.post(url, attach_data)

        # Should fail due to cross-case restriction
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
