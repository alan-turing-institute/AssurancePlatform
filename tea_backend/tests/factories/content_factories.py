"""
FactoryBoy factories for content models.

This module provides factories for creating test data for:
- Context (contextual information)
- Strategy (strategy definitions)
- PropertyClaim (claims and sub-claims)
- Evidence (evidence management)
"""

import factory

from api.models import Context, Evidence, PropertyClaim, Strategy
from tests.factories.base import BaseFactory
from tests.factories.case_factories import AssuranceCaseFactory, TopLevelNormativeGoalFactory


class ContextFactory(BaseFactory):
    """Factory for creating Context instances."""

    class Meta:
        model = Context

    name = factory.Sequence(lambda n: f"Context {n}")
    short_description = factory.Faker("sentence")
    long_description = factory.Faker("text", max_nb_chars=1000)
    goal = factory.SubFactory(TopLevelNormativeGoalFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.goal.assurance_case if obj.goal else None
    )
    in_sandbox = False


class SandboxContextFactory(ContextFactory):
    """Factory for creating Context instances in sandbox."""

    in_sandbox = True


class ContextWithoutGoalFactory(ContextFactory):
    """Factory for creating Context instances without a goal but with case."""

    goal = None
    assurance_case = factory.SubFactory(AssuranceCaseFactory)


class StrategyFactory(BaseFactory):
    """Factory for creating Strategy instances."""

    class Meta:
        model = Strategy

    name = factory.Sequence(lambda n: f"Strategy {n}")
    short_description = factory.Faker("sentence")
    long_description = factory.Faker("text", max_nb_chars=1000)
    assumption = factory.Faker("text", max_nb_chars=500)
    justification = factory.Faker("text", max_nb_chars=500)
    goal = factory.SubFactory(TopLevelNormativeGoalFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.goal.assurance_case if obj.goal else None
    )
    in_sandbox = False


class SandboxStrategyFactory(StrategyFactory):
    """Factory for creating Strategy instances in sandbox."""

    in_sandbox = True


class StrategyWithoutGoalFactory(StrategyFactory):
    """Factory for creating Strategy instances without a goal but with case."""

    goal = None
    assurance_case = factory.SubFactory(AssuranceCaseFactory)


class StrategyWithAssumptionFactory(StrategyFactory):
    """Factory for creating Strategy with detailed assumption and justification."""

    assumption = factory.Faker("paragraph", nb_sentences=3)
    justification = factory.Faker("paragraph", nb_sentences=3)


class EmptyStrategyFactory(StrategyFactory):
    """Factory for creating minimal Strategy instances."""

    assumption = ""
    justification = ""


class PropertyClaimFactory(BaseFactory):
    """Factory for creating PropertyClaim instances."""

    class Meta:
        model = PropertyClaim

    name = factory.Sequence(lambda n: f"Property Claim {n}")
    short_description = factory.Faker("sentence")
    long_description = factory.Faker("text", max_nb_chars=1000)
    assumption = factory.Faker("text", max_nb_chars=500)
    claim_type = PropertyClaim.ClaimType.PROJECT
    goal = factory.SubFactory(TopLevelNormativeGoalFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.goal.assurance_case if obj.goal else None
    )
    level = 1
    in_sandbox = False


class SystemPropertyClaimFactory(PropertyClaimFactory):
    """Factory for creating System type PropertyClaim instances."""

    claim_type = PropertyClaim.ClaimType.SYSTEM


class SubPropertyClaimFactory(PropertyClaimFactory):
    """Factory for creating sub-PropertyClaim instances."""

    goal = None
    property_claim = factory.SubFactory(PropertyClaimFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.property_claim.assurance_case if obj.property_claim else None
    )


class StrategyPropertyClaimFactory(PropertyClaimFactory):
    """Factory for creating PropertyClaim instances connected to Strategy."""

    goal = None
    strategy = factory.SubFactory(StrategyFactory)
    assurance_case = factory.LazyAttribute(
        lambda obj: obj.strategy.assurance_case if obj.strategy else None
    )


class SandboxPropertyClaimFactory(PropertyClaimFactory):
    """Factory for creating PropertyClaim instances in sandbox."""

    in_sandbox = True


class EvidenceFactory(BaseFactory):
    """Factory for creating Evidence instances."""

    class Meta:
        model = Evidence

    name = factory.Sequence(lambda n: f"Evidence {n}")
    short_description = factory.Faker("sentence")
    long_description = factory.Faker("text", max_nb_chars=1000)
    URL = factory.Faker("url")
    assurance_case = factory.SubFactory(AssuranceCaseFactory)
    in_sandbox = False

    @factory.post_generation
    def property_claims(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add property claims after creation."""
        if not create:
            return

        if extracted:
            for claim in extracted:
                self.property_claim.add(claim)


class EvidenceWithClaimsFactory(EvidenceFactory):
    """Factory for creating Evidence with associated property claims."""

    @factory.post_generation
    def setup_claims(self, create, extracted, **kwargs):  # noqa: ARG002
        """Set up default property claims."""
        if not create:
            return

        # Create and associate property claims
        claim1 = PropertyClaimFactory(assurance_case=self.assurance_case)
        claim2 = PropertyClaimFactory(assurance_case=self.assurance_case)

        self.property_claim.add(claim1, claim2)


class SandboxEvidenceFactory(EvidenceFactory):
    """Factory for creating Evidence instances in sandbox."""

    in_sandbox = True


class EvidenceWithoutURLFactory(EvidenceFactory):
    """Factory for creating Evidence instances without URL."""

    URL = None
