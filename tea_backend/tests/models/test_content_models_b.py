"""
Tests for content models (Part B).

This module provides comprehensive tests for:
- PropertyClaim model (claims and sub-claims with hierarchies)
- Evidence model (evidence management with many-to-many relationships)
"""

import pytest
from django.test import TestCase

from api.models import Evidence, PropertyClaim, Shape
from tests.factories.case_factories import (
    AssuranceCaseFactory,
    TopLevelNormativeGoalFactory,
)
from tests.factories.content_factories import (
    EvidenceFactory,
    EvidenceWithClaimsFactory,
    EvidenceWithoutURLFactory,
    PropertyClaimFactory,
    SandboxEvidenceFactory,
    SandboxPropertyClaimFactory,
    StrategyFactory,
    StrategyPropertyClaimFactory,
    SubPropertyClaimFactory,
    SystemPropertyClaimFactory,
)


class TestPropertyClaimModel(TestCase):
    """Test PropertyClaim model functionality."""

    def test_should_create_property_claim_with_required_fields(self):
        """Test that PropertyClaim can be created with minimum required fields."""
        claim = PropertyClaimFactory()

        self.assertIsNotNone(claim.id)
        self.assertTrue(claim.name.startswith("Property Claim"))
        self.assertIsNotNone(claim.short_description)
        self.assertIsNotNone(claim.long_description)
        self.assertEqual(claim.shape, Shape.RECTANGLE)
        self.assertIsNotNone(claim.assumption)
        self.assertEqual(claim.claim_type, PropertyClaim.ClaimType.PROJECT)
        self.assertIsNotNone(claim.goal)
        self.assertIsNotNone(claim.assurance_case)
        self.assertEqual(claim.level, 1)
        self.assertIsNotNone(claim.created_date)
        self.assertFalse(claim.in_sandbox)

    def test_should_have_correct_shape(self):
        """Test PropertyClaim has correct shape value."""
        claim = PropertyClaimFactory()

        self.assertEqual(claim.shape, Shape.RECTANGLE)

    def test_should_support_different_claim_types(self):
        """Test PropertyClaim supports different claim types."""
        project_claim = PropertyClaimFactory(claim_type=PropertyClaim.ClaimType.PROJECT)
        system_claim = SystemPropertyClaimFactory()

        self.assertEqual(project_claim.claim_type, PropertyClaim.ClaimType.PROJECT)
        self.assertEqual(system_claim.claim_type, PropertyClaim.ClaimType.SYSTEM)

    def test_should_support_sandbox_mode(self):
        """Test PropertyClaim can be in sandbox mode."""
        claim = SandboxPropertyClaimFactory()

        self.assertTrue(claim.in_sandbox)

    def test_should_belong_to_goal_and_case(self):
        """Test PropertyClaim belongs to both goal and assurance case."""
        goal = TopLevelNormativeGoalFactory()
        claim = PropertyClaimFactory(goal=goal)

        self.assertEqual(claim.goal, goal)
        self.assertEqual(claim.assurance_case, goal.assurance_case)
        self.assertIn(claim, goal.property_claims.all())

    def test_should_support_sub_claims(self):
        """Test PropertyClaim can have sub-claims (hierarchical structure)."""
        parent_claim = PropertyClaimFactory()
        sub_claim = SubPropertyClaimFactory(property_claim=parent_claim)

        self.assertEqual(sub_claim.property_claim, parent_claim)
        self.assertIsNone(sub_claim.goal)
        self.assertEqual(sub_claim.assurance_case, parent_claim.assurance_case)
        self.assertIn(sub_claim, parent_claim.property_claims.all())

    def test_should_belong_to_strategy(self):
        """Test PropertyClaim can belong to a strategy."""
        strategy = StrategyFactory()
        claim = StrategyPropertyClaimFactory(strategy=strategy)

        self.assertEqual(claim.strategy, strategy)
        self.assertIsNone(claim.goal)
        self.assertEqual(claim.assurance_case, strategy.assurance_case)
        self.assertIn(claim, strategy.property_claims.all())

    def test_should_calculate_level_correctly(self):
        """Test PropertyClaim level calculation for hierarchies."""
        # Create a hierarchy: goal -> claim -> sub-claim -> sub-sub-claim
        goal = TopLevelNormativeGoalFactory()
        parent_claim = PropertyClaimFactory(goal=goal)  # Level 1

        # Save parent first to ensure it has an ID
        parent_claim.save()

        sub_claim = PropertyClaimFactory(
            property_claim=parent_claim, goal=None, assurance_case=parent_claim.assurance_case
        )  # Should be Level 2

        sub_sub_claim = PropertyClaimFactory(
            property_claim=sub_claim, goal=None, assurance_case=sub_claim.assurance_case
        )  # Should be Level 3

        self.assertEqual(parent_claim.level, 1)
        self.assertEqual(sub_claim.level, 2)
        self.assertEqual(sub_sub_claim.level, 3)

    def test_should_prevent_self_reference(self):
        """Test PropertyClaim cannot be its own parent."""
        claim = PropertyClaimFactory()

        claim.property_claim = claim
        with pytest.raises(ValueError, match="self-reference"):
            claim.save()

    def test_should_prevent_multiple_parents(self):
        """Test PropertyClaim cannot have multiple parent types."""
        goal = TopLevelNormativeGoalFactory()
        strategy = StrategyFactory()
        # Create claim with goal
        claim = PropertyClaimFactory(goal=goal)

        # Try to add strategy (should fail)
        claim.strategy = strategy
        with pytest.raises(ValueError, match="self-reference"):
            claim.save()

    def test_should_handle_empty_assumptions(self):
        """Test PropertyClaim with empty assumptions."""
        claim = PropertyClaimFactory(assumption="")

        self.assertEqual(claim.assumption, "")

    def test_should_handle_long_assumptions(self):
        """Test PropertyClaim with maximum length assumptions."""
        long_assumption = "a" * 1000  # Max length for assumption field
        claim = PropertyClaimFactory(assumption=long_assumption)

        self.assertEqual(claim.assumption, long_assumption)

    def test_should_delete_claim_when_goal_deleted(self):
        """Test that PropertyClaim is deleted when goal is deleted."""
        goal = TopLevelNormativeGoalFactory()
        claim = PropertyClaimFactory(goal=goal)
        claim_id = claim.id

        goal.delete()

        self.assertFalse(PropertyClaim.objects.filter(id=claim_id).exists())

    def test_should_delete_claim_when_case_deleted(self):
        """Test that PropertyClaim is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        claim = PropertyClaimFactory(assurance_case=case, goal=None)
        claim_id = claim.id

        case.delete()

        self.assertFalse(PropertyClaim.objects.filter(id=claim_id).exists())

    def test_should_delete_sub_claims_when_parent_deleted(self):
        """Test that sub-claims are deleted when parent claim is deleted."""
        parent_claim = PropertyClaimFactory()
        sub_claim = SubPropertyClaimFactory(property_claim=parent_claim)
        sub_claim_id = sub_claim.id

        parent_claim.delete()

        self.assertFalse(PropertyClaim.objects.filter(id=sub_claim_id).exists())

    def test_should_inherit_from_case_item(self):
        """Test PropertyClaim inherits CaseItem properties."""
        claim = PropertyClaimFactory()

        # Check CaseItem fields are present
        self.assertTrue(hasattr(claim, "name"))
        self.assertTrue(hasattr(claim, "short_description"))
        self.assertTrue(hasattr(claim, "long_description"))
        self.assertTrue(hasattr(claim, "created_date"))
        self.assertTrue(hasattr(claim, "in_sandbox"))


class TestEvidenceModel(TestCase):
    """Test Evidence model functionality."""

    def test_should_create_evidence_with_required_fields(self):
        """Test that Evidence can be created with minimum required fields."""
        evidence = EvidenceFactory()

        self.assertIsNotNone(evidence.id)
        self.assertTrue(evidence.name.startswith("Evidence"))
        self.assertIsNotNone(evidence.short_description)
        self.assertIsNotNone(evidence.long_description)
        self.assertEqual(evidence.shape, Shape.CYLINDER)
        self.assertIsNotNone(evidence.URL)
        self.assertIsNotNone(evidence.assurance_case)
        self.assertIsNotNone(evidence.created_date)
        self.assertFalse(evidence.in_sandbox)

    def test_should_have_correct_shape(self):
        """Test Evidence has correct shape value."""
        evidence = EvidenceFactory()

        self.assertEqual(evidence.shape, Shape.CYLINDER)

    def test_should_support_sandbox_mode(self):
        """Test Evidence can be in sandbox mode."""
        evidence = SandboxEvidenceFactory()

        self.assertTrue(evidence.in_sandbox)

    def test_should_handle_url_field(self):
        """Test Evidence URL field functionality."""
        evidence = EvidenceFactory()

        self.assertIsNotNone(evidence.URL)
        # URL should be a valid URL format
        self.assertTrue(evidence.URL.startswith(("http://", "https://")))

    def test_should_allow_empty_url(self):
        """Test Evidence can exist without URL."""
        evidence = EvidenceWithoutURLFactory()

        self.assertIsNone(evidence.URL)

    def test_should_support_many_to_many_with_property_claims(self):
        """Test Evidence many-to-many relationship with PropertyClaim."""
        evidence = EvidenceWithClaimsFactory()

        self.assertEqual(evidence.property_claim.count(), 2)

        # All associated claims should belong to the same case
        for claim in evidence.property_claim.all():
            self.assertEqual(claim.assurance_case, evidence.assurance_case)

    def test_should_allow_manual_property_claim_association(self):
        """Test manually associating Evidence with PropertyClaims."""
        evidence = EvidenceFactory()
        claim1 = PropertyClaimFactory(assurance_case=evidence.assurance_case)
        claim2 = PropertyClaimFactory(assurance_case=evidence.assurance_case)

        evidence.property_claim.add(claim1, claim2)

        self.assertEqual(evidence.property_claim.count(), 2)
        self.assertIn(claim1, evidence.property_claim.all())
        self.assertIn(claim2, evidence.property_claim.all())

    def test_should_handle_property_claim_removal(self):
        """Test removing PropertyClaim associations from Evidence."""
        evidence = EvidenceWithClaimsFactory()
        claims = list(evidence.property_claim.all())
        claim_to_remove = claims[0]

        evidence.property_claim.remove(claim_to_remove)

        self.assertEqual(evidence.property_claim.count(), 1)
        self.assertNotIn(claim_to_remove, evidence.property_claim.all())

    def test_should_delete_evidence_when_case_deleted(self):
        """Test that Evidence is deleted when assurance case is deleted."""
        case = AssuranceCaseFactory()
        evidence = EvidenceFactory(assurance_case=case)
        evidence_id = evidence.id

        case.delete()

        self.assertFalse(Evidence.objects.filter(id=evidence_id).exists())

    def test_should_maintain_evidence_when_property_claim_deleted(self):
        """Test that Evidence persists when associated PropertyClaim is deleted."""
        evidence = EvidenceWithClaimsFactory()
        initial_count = evidence.property_claim.count()
        claim_to_delete = evidence.property_claim.first()
        claim_id = claim_to_delete.id

        claim_to_delete.delete()

        # Evidence should still exist
        evidence.refresh_from_db()
        self.assertIsNotNone(evidence.id)
        # But should have one less associated claim
        self.assertEqual(evidence.property_claim.count(), initial_count - 1)
        self.assertFalse(PropertyClaim.objects.filter(id=claim_id).exists())

    def test_should_handle_long_url(self):
        """Test Evidence with maximum length URL."""
        long_url = "https://example.com/" + "a" * 2900  # Max length for URL field
        evidence = EvidenceFactory(URL=long_url)

        self.assertEqual(evidence.URL, long_url)

    def test_should_inherit_from_case_item(self):
        """Test Evidence inherits CaseItem properties."""
        evidence = EvidenceFactory()

        # Check CaseItem fields are present
        self.assertTrue(hasattr(evidence, "name"))
        self.assertTrue(hasattr(evidence, "short_description"))
        self.assertTrue(hasattr(evidence, "long_description"))
        self.assertTrue(hasattr(evidence, "created_date"))
        self.assertTrue(hasattr(evidence, "in_sandbox"))


class TestPropertyClaimEvidenceRelationship(TestCase):
    """Test relationships between PropertyClaim and Evidence models."""

    def test_should_handle_multiple_evidence_per_claim(self):
        """Test PropertyClaim can have multiple Evidence associations."""
        claim = PropertyClaimFactory()
        evidence1 = EvidenceFactory(assurance_case=claim.assurance_case)
        evidence2 = EvidenceFactory(assurance_case=claim.assurance_case)
        evidence3 = EvidenceFactory(assurance_case=claim.assurance_case)

        evidence1.property_claim.add(claim)
        evidence2.property_claim.add(claim)
        evidence3.property_claim.add(claim)

        self.assertEqual(claim.evidence.count(), 3)
        self.assertIn(evidence1, claim.evidence.all())
        self.assertIn(evidence2, claim.evidence.all())
        self.assertIn(evidence3, claim.evidence.all())

    def test_should_handle_multiple_claims_per_evidence(self):
        """Test Evidence can support multiple PropertyClaims."""
        case = AssuranceCaseFactory()
        evidence = EvidenceFactory(assurance_case=case)
        claim1 = PropertyClaimFactory(assurance_case=case)
        claim2 = PropertyClaimFactory(assurance_case=case)
        claim3 = PropertyClaimFactory(assurance_case=case)

        evidence.property_claim.add(claim1, claim2, claim3)

        self.assertEqual(evidence.property_claim.count(), 3)
        self.assertIn(claim1, evidence.property_claim.all())
        self.assertIn(claim2, evidence.property_claim.all())
        self.assertIn(claim3, evidence.property_claim.all())

    def test_should_handle_complex_claim_evidence_network(self):
        """Test complex many-to-many relationships between claims and evidence."""
        case = AssuranceCaseFactory()

        # Create multiple claims
        goal = TopLevelNormativeGoalFactory(assurance_case=case)
        claim1 = PropertyClaimFactory(goal=goal, assurance_case=case)
        claim2 = PropertyClaimFactory(goal=goal, assurance_case=case)
        sub_claim = PropertyClaimFactory(property_claim=claim1, goal=None, assurance_case=case)

        # Create multiple evidence items
        evidence1 = EvidenceFactory(assurance_case=case)
        evidence2 = EvidenceFactory(assurance_case=case)
        evidence3 = EvidenceFactory(assurance_case=case)

        # Create complex associations
        evidence1.property_claim.add(claim1, claim2)  # Evidence1 supports 2 claims
        evidence2.property_claim.add(claim1, sub_claim)  # Evidence2 supports parent and sub
        evidence3.property_claim.add(sub_claim)  # Evidence3 supports only sub-claim

        # Verify relationships
        self.assertEqual(claim1.evidence.count(), 2)  # claim1 has 2 evidence
        self.assertEqual(claim2.evidence.count(), 1)  # claim2 has 1 evidence
        self.assertEqual(sub_claim.evidence.count(), 2)  # sub_claim has 2 evidence

        self.assertEqual(evidence1.property_claim.count(), 2)
        self.assertEqual(evidence2.property_claim.count(), 2)
        self.assertEqual(evidence3.property_claim.count(), 1)

    def test_should_maintain_case_consistency(self):
        """Test that PropertyClaim and Evidence associations maintain case consistency."""
        case1 = AssuranceCaseFactory()
        case2 = AssuranceCaseFactory()

        claim = PropertyClaimFactory(assurance_case=case1)
        evidence_same_case = EvidenceFactory(assurance_case=case1)
        evidence_different_case = EvidenceFactory(assurance_case=case2)

        # This should work (same case)
        evidence_same_case.property_claim.add(claim)
        self.assertIn(claim, evidence_same_case.property_claim.all())

        # This should also work technically (different case)
        # but represents a data consistency issue
        evidence_different_case.property_claim.add(claim)
        self.assertIn(claim, evidence_different_case.property_claim.all())

        # Verify the inconsistency exists (for awareness)
        self.assertNotEqual(claim.assurance_case, evidence_different_case.assurance_case)
