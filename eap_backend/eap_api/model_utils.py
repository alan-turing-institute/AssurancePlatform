from typing import Callable

from django.db.models import Q
from django.db.models.query import QuerySet

from .models import (
    PropertyClaim,
    TopLevelNormativeGoal,
)


def get_case_property_claims(
    goal: TopLevelNormativeGoal, strategies: QuerySet
) -> tuple:
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
