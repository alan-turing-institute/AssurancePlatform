from collections.abc import Callable

from django.db.models import Q
from django.db.models.query import QuerySet

from .models import (
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
)


def get_property_claims_by_case_id(case_id: int | None) -> tuple[list[int], list[int]]:
    if case_id is None:
        error_message: str = "Please provide an assurance case id."
        raise ValueError(error_message)

    current_case_goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.get(
        assurance_case_id=case_id
    )

    current_case_strategies: QuerySet = Strategy.objects.filter(
        goal_id=current_case_goal.pk
    )

    (
        top_level_claim_ids,
        child_claim_ids,
    ) = get_case_property_claims(current_case_goal, current_case_strategies)

    return top_level_claim_ids, child_claim_ids


def get_case_property_claims(
    goal: TopLevelNormativeGoal, strategies: QuerySet
) -> tuple[list[int], list[int]]:
    """Retrieves all the property claims associated to a goal and a list of strategies.

    Args:
        goal: Goal whose property claims we will extract.
        strategies: Strategies whose property claims we will extract.

    Returns:
        A tuple containing parent property claims and child property claims, all sorted
        by primary key.
    """
    strategy_ids: list[int] = [strategy.pk for strategy in strategies]
    top_level_claims: QuerySet = PropertyClaim.objects.filter(
        Q(goal_id=goal.pk) | Q(strategy__id__in=strategy_ids)
    )

    top_level_claim_ids: list[int] = [claim.pk for claim in top_level_claims]

    child_claim_ids: list[int] = []
    for parent_claim_id in top_level_claim_ids:
        traverse_child_property_claims(
            lambda _, child, parent: child_claim_ids.append(child.pk),  # noqa: ARG005
            parent_claim_id,
        )

    return top_level_claim_ids, sorted(child_claim_ids)


def traverse_child_property_claims(
    on_child_claim: Callable[[int, PropertyClaim, PropertyClaim], None],
    parent_claim_id: int,
):
    """Applies a function to all the children of a Property Claim.

    Args:
        on_child_claim: The function to call on each child claim.
        parent_claim_id: The id of the claim we will traverse.
    """
    child_property_claims = PropertyClaim.objects.filter(
        property_claim_id=parent_claim_id
    ).order_by("id")

    if len(child_property_claims) == 0:
        return
    else:
        for index, child_property_claim in enumerate(child_property_claims):
            on_child_claim(
                index,
                child_property_claim,
                PropertyClaim.objects.get(pk=parent_claim_id),
            )
            traverse_child_property_claims(on_child_claim, child_property_claim.pk)
