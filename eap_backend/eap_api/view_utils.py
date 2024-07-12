import functools
import warnings
from typing import Any, Callable, Optional, Union, cast

from django.db.models import Q
from django.db.models.query import QuerySet
from django.forms.models import model_to_dict
from django.http import JsonResponse
from rest_framework.serializers import ReturnDict

from . import models
from .models import (
    AssuranceCase,
    CaseItem,
    Context,
    EAPGroup,
    Evidence,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
)
from .serializers import (
    AssuranceCaseSerializer,
    ContextSerializer,
    EvidenceSerializer,
    PropertyClaimSerializer,
    SandboxSerializer,
    StrategySerializer,
    TopLevelNormativeGoalSerializer,
)

TYPE_DICT = {
    "assurance_case": {
        "serializer": AssuranceCaseSerializer,
        "model": AssuranceCase,
        "children": ["goals"],
        "fields": (
            "name",
            "description",
            "lock_uuid",
            "owner",
            "color_profile",
        ),
    },
    "goal": {
        "serializer": TopLevelNormativeGoalSerializer,
        "model": TopLevelNormativeGoal,
        "children": ["context", "property_claims", "strategies"],
        "fields": (
            "name",
            "short_description",
            "long_description",
            "keywords",
        ),
        "parent_types": [("assurance_case", False)],
    },
    "context": {
        "serializer": ContextSerializer,
        "model": Context,
        "children": [],
        "fields": ("name", "short_description", "long_description"),
        "parent_types": [("goal", False)],
    },
    "property_claim": {
        "serializer": PropertyClaimSerializer,
        "model": PropertyClaim,
        "children": ["property_claims", "evidence"],
        "fields": ("name", "short_description", "long_description"),
        "parent_types": [
            ("goal", False),
            ("property_claim", False),
            ("strategy", False),
        ],
    },
    "strategy": {
        "serializer": StrategySerializer,
        "model": Strategy,
        "children": ["property_claims"],
        "fields": ("name", "short_description", "long_description"),
        "parent_types": [
            ("goal", False),
        ],
    },
    "evidence": {
        "serializer": EvidenceSerializer,
        "model": Evidence,
        "children": [],
        "fields": ("name", "short_description", "long_description", "URL"),
        "parent_types": [("property_claim", True)],
    },
}
# Pluralising the name of the type should be irrelevant.
for k, v in tuple(TYPE_DICT.items()):
    TYPE_DICT[k + "s" if not k.endswith("y") else k[:-1] + "ies"] = v


class SandboxUtils:
    @staticmethod
    def detach_context(context_id: int) -> None:
        context: Context = Context.objects.get(pk=context_id)
        assurance_case_id: Optional[int] = get_case_id(context)

        context.goal = None
        SandboxUtils._move_to_sandbox(context, assurance_case_id)

    @staticmethod
    def attach_context(context_id: int, goal_id: int) -> None:
        context: Context = Context.objects.get(pk=context_id)
        new_goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.get(pk=goal_id)

        context.goal = new_goal
        SandboxUtils._remove_from_sandbox(context)

    @staticmethod
    def detach_evidence(evidence_id: int, property_claim_id: int) -> None:
        evidence: Evidence = Evidence.objects.get(pk=evidence_id)
        assurance_case_id: Optional[int] = get_case_id(evidence)

        if evidence.property_claim.filter(pk=property_claim_id).count() == 0:
            error_message: str = (
                f"Property claim with id {property_claim_id} is not the parent of Evidence with id {evidence_id}"
            )
            raise ValueError(error_message)

        evidence.property_claim.set(
            evidence.property_claim.exclude(pk=property_claim_id)
        )

        SandboxUtils._move_to_sandbox(
            evidence,
            assurance_case_id,
            lambda evidence: evidence.property_claim.count()  # type:ignore[attr-defined]
            == 0,
        )

    @staticmethod
    def attach_evidence(evidence_id: int, property_claim_id: int) -> None:
        evidence: Evidence = Evidence.objects.get(pk=evidence_id)
        new_property_claim: PropertyClaim = PropertyClaim.objects.get(
            pk=property_claim_id
        )

        evidence.property_claim.add(new_property_claim)
        SandboxUtils._remove_from_sandbox(evidence)

    @staticmethod
    def _can_detach_property_claim(case_item: CaseItem) -> bool:

        property_claim: PropertyClaim = cast(PropertyClaim, case_item)

        return (
            property_claim.goal is None
            and property_claim.property_claim is None
            and property_claim.strategy is None
        )

    @staticmethod
    def detach_property_claim(property_claim_id: int, parent_info: dict[str, Any]):
        property_claim: PropertyClaim = PropertyClaim.objects.get(pk=property_claim_id)
        assurance_case_id: Optional[int] = get_case_id(property_claim)

        goal_id: Optional[int] = parent_info.get("goal_id")
        parent_property_claim_id: Optional[int] = parent_info.get("property_claim_id")
        strategy_id: Optional[int] = parent_info.get("strategy_id")

        error_message: str = ""
        if goal_id is not None:
            goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.get(pk=goal_id)

            if goal.property_claims.filter(pk=property_claim_id).count() == 0:  # type: ignore[attr-defined]
                error_message = f"Property claim {property_claim_id} is not attached to Goal {goal_id}"
                raise ValueError(error_message)

            property_claim.goal = None
            SandboxUtils._move_to_sandbox(
                property_claim,
                assurance_case_id,
                SandboxUtils._can_detach_property_claim,
            )
        elif parent_property_claim_id is not None:
            parent_property_claim: PropertyClaim = PropertyClaim.objects.get(
                pk=parent_property_claim_id
            )

            if property_claim.property_claim != parent_property_claim:
                error_message = f"Property claim {parent_property_claim.pk} is not the parent of Property Claim {property_claim.pk}"
                raise ValueError(error_message)

            property_claim.property_claim = None
            SandboxUtils._move_to_sandbox(
                property_claim,
                assurance_case_id,
                SandboxUtils._can_detach_property_claim,
            )
        elif strategy_id is not None:
            strategy: Strategy = Strategy.objects.get(pk=strategy_id)

            if property_claim.strategy != strategy:
                error_message = f"Strategy {strategy.pk} is not the parent of Property Claim {property_claim.pk}"
                raise ValueError(error_message)

            property_claim.strategy = None
            SandboxUtils._move_to_sandbox(
                property_claim,
                assurance_case_id,
                SandboxUtils._can_detach_property_claim,
            )
        else:
            error_message = f"Cannot detach property claim {property_claim_id} to parent {parent_info}"
            raise ValueError(error_message)

    @staticmethod
    def attach_property_claim(
        property_claim_id: int, parent_info: dict[str, Any]
    ) -> None:
        property_claim: PropertyClaim = PropertyClaim.objects.get(pk=property_claim_id)

        goal_id: Optional[int] = parent_info.get("goal_id")
        parent_property_claim_id: Optional[int] = parent_info.get("property_claim_id")
        strategy_id: Optional[int] = parent_info.get("strategy_id")

        if goal_id is not None:
            goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.get(pk=goal_id)
            property_claim.goal = goal
            SandboxUtils._remove_from_sandbox(property_claim)
        elif parent_property_claim_id is not None:
            parent_property_claim: PropertyClaim = PropertyClaim.objects.get(
                pk=parent_property_claim_id
            )
            property_claim.property_claim = parent_property_claim  # type: ignore[attr-defined]
            SandboxUtils._remove_from_sandbox(property_claim)
        elif strategy_id is not None:
            strategy: Strategy = Strategy.objects.get(pk=strategy_id)
            property_claim.strategy = strategy
            SandboxUtils._remove_from_sandbox(property_claim)
        else:
            error_message = f"Cannot attach property claim {property_claim_id} to parent {parent_info}"
            raise ValueError(error_message)

    @staticmethod
    def detach_strategy(strategy_id: int) -> None:
        strategy: Strategy = Strategy.objects.get(pk=strategy_id)
        assurance_case_id: Optional[int] = get_case_id(strategy)

        strategy.goal = None
        SandboxUtils._move_to_sandbox(
            strategy,
            assurance_case_id,
        )

    @staticmethod
    def attach_strategy(strategy_id: int, parent_info: dict[str, Any]) -> None:

        strategy: Strategy = Strategy.objects.get(pk=strategy_id)
        goal_id: Optional[int] = parent_info.get("goal_id")

        if goal_id is not None:
            goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.get(pk=goal_id)
            strategy.goal = goal
            SandboxUtils._remove_from_sandbox(strategy)
        else:
            error_message = f"Cannot attach strategy {strategy} to parent {parent_info}"
            raise ValueError(error_message)

    @staticmethod
    def serialise_sandbox(assurance_case: AssuranceCase) -> ReturnDict:
        serializer = SandboxSerializer(assurance_case)
        serialized_sandbox: ReturnDict = cast(ReturnDict, serializer.data)

        for property_claim in serialized_sandbox["property_claims"]:
            property_claim["property_claims"] = get_json_tree(
                property_claim["property_claims"], "property_claims"
            )

            property_claim["evidence"] = get_json_tree(
                property_claim["evidence"], "evidence"
            )

        for strategy in serialized_sandbox["strategies"]:
            strategy["property_claims"] = get_json_tree(
                strategy["property_claims"], "property_claims"
            )

        return serialized_sandbox

    @staticmethod
    def _remove_from_sandbox(case_item: CaseItem) -> None:
        case_item.assurance_case = None  # type: ignore[attr-defined]
        case_item.in_sandbox = False
        case_item.save()

    @staticmethod
    def _move_to_sandbox(
        case_item: CaseItem,
        assurance_case_id: Optional[int],
        is_ready: Optional[Callable[[CaseItem], bool]] = None,
    ):
        if assurance_case_id is None:
            error_message: str = (
                f"Cannot find assurance case id for element with id {case_item.pk}"
            )
            raise ValueError(error_message)

        if is_ready is None or is_ready(case_item):
            case_item.in_sandbox = True
            case_item.assurance_case = AssuranceCase.objects.get(  # type: ignore[attr-defined]
                pk=assurance_case_id
            )
            case_item.save()


class UpdateIdentifierUtils:
    @staticmethod
    def update_identifiers(
        case_id: Optional[int] = None, model_instance: Optional[CaseItem] = None
    ):
        """Traverses the case and ensures the identifiers follow a sequence

        Args:
            case_id: Identifier of the case where we perform the update.
            model_instance: The case element that triggered this method.
        """

        error_message: str = "Assurance Case ID not provided."
        if case_id is None and model_instance is not None:
            case_id = get_case_id(model_instance)

        if case_id is None:
            raise ValueError(error_message)

        if TopLevelNormativeGoal.objects.filter(assurance_case_id=case_id).exists():

            current_case_goal: TopLevelNormativeGoal = (
                TopLevelNormativeGoal.objects.get(assurance_case_id=case_id)
            )
            goal_id: int = current_case_goal.pk

            UpdateIdentifierUtils._update_sequential_identifiers(
                TopLevelNormativeGoal.objects.filter(id=goal_id).order_by("id"),
                "G",
            )

            UpdateIdentifierUtils._update_sequential_identifiers(
                Context.objects.filter(goal_id=goal_id).order_by("id"), "C"
            )

            current_case_strategies: QuerySet = Strategy.objects.filter(
                goal_id=goal_id
            ).order_by("id")
            UpdateIdentifierUtils._update_sequential_identifiers(
                current_case_strategies, "S"
            )

            (
                top_level_claim_ids,
                child_claim_ids,
            ) = UpdateIdentifierUtils._get_case_property_claims(
                current_case_goal, current_case_strategies
            )

            UpdateIdentifierUtils._update_sequential_identifiers(
                Evidence.objects.filter(
                    property_claim__id__in=top_level_claim_ids + child_claim_ids
                ).order_by("id"),
                "E",
            )

            parent_property_claims: list = sorted(
                PropertyClaim.objects.filter(pk__in=top_level_claim_ids),
                key=functools.cmp_to_key(
                    UpdateIdentifierUtils._compare_property_claims
                ),
            )

            UpdateIdentifierUtils._update_sequential_identifiers(
                parent_property_claims, "P"
            )

            for _, property_claim in enumerate(parent_property_claims):
                UpdateIdentifierUtils._traverse_child_property_claims(
                    lambda index, child, parent: UpdateIdentifierUtils._update_item_name(
                        child, f"{parent.name}.", index + 1
                    ),
                    property_claim.pk,
                )

            if model_instance is not None:
                model_instance.refresh_from_db()

    @staticmethod
    def _traverse_child_property_claims(
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
                UpdateIdentifierUtils._traverse_child_property_claims(
                    on_child_claim, child_property_claim.pk
                )

    @staticmethod
    def _compare_property_claims(
        one_claim: PropertyClaim, another_claim: PropertyClaim
    ) -> int:
        ONE_CLAIM_LEFT: int = -1
        ONE_CLAIM_RIGHT: int = 1
        result: int = 0

        if one_claim.strategy is None and another_claim.strategy is not None:
            result = ONE_CLAIM_LEFT
        elif one_claim.strategy is None and another_claim.strategy is None:
            result = one_claim.pk - another_claim.pk
        elif one_claim.strategy is not None and another_claim.strategy is None:
            result = ONE_CLAIM_RIGHT
        elif one_claim.strategy is not None and another_claim.strategy is not None:
            if one_claim.strategy != another_claim.strategy:
                result = one_claim.strategy.pk - another_claim.strategy.pk
            else:
                result = one_claim.pk - another_claim.pk

        return result

    @staticmethod
    def _get_case_property_claims(
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
            UpdateIdentifierUtils._traverse_child_property_claims(
                lambda _, child, parent: child_claim_ids.append(  # noqa: ARG005
                    child.pk
                ),
                parent_claim_id,
            )

        return top_level_claim_ids, sorted(child_claim_ids)

    @staticmethod
    def _update_item_name(case_item: CaseItem, prefix: str, number: int) -> None:
        """Updates the name of a case item, given a prefix and a sequence number."""
        case_item.name = f"{prefix}{number}"
        case_item.save()

    @staticmethod
    def _update_sequential_identifiers(query_set: QuerySet | list, prefix: str):
        """For a list of case items, it updates their name according to its order."""
        for model_index, model in enumerate(query_set):
            UpdateIdentifierUtils._update_item_name(model, prefix, model_index + 1)


def get_case_id(item) -> Optional[int]:
    """Return the id of the case in which this item is. Works for all item types."""
    # In some cases, when there's a ManyToManyField, instead of the parent item, we get
    # an iterable that can potentially list all the parents. In that case, just pick the
    # first.
    if hasattr(item, "first"):
        item = item.first()

    if isinstance(item, models.AssuranceCase):
        return item.id
    for _k, v in TYPE_DICT.items():
        if isinstance(item, v["model"]):
            for parent_type, _ in v["parent_types"]:
                parent = getattr(item, parent_type)
                if parent is not None:
                    return get_case_id(parent)
    # TODO This should probably be an error raise rather than a warning, but currently
    # there are dead items in the database without parents which hit this branch.
    msg = f"Can't figure out the case ID of {item}."
    warnings.warn(msg)
    return None


def filter_by_case_id(items, request):
    """Filter an iterable of case items, based on whether they are in the case specified
    in the request query string.
    """
    if "case_id" in request.GET:
        case_id = int(request.GET["case_id"])
        items = [g for g in items if get_case_id(g) == case_id]
    return items


def make_summary(model_data: Union[dict, list, CaseItem]):
    """
    Take in a full serialized object, and return dict containing just
    the id and the name

    Parameter: serialized_data, dict, or list of dicts
    Returns: dict, or list of dicts, containing just "name" and "id"
    key/values.
    """

    def summarize_one(data: Union[dict, CaseItem]):
        if isinstance(data, CaseItem):
            data = model_to_dict(data)

        if not (isinstance(data, dict) and "id" in data and "name" in data):
            msg = "Expected dictionary containing name and id"
            raise RuntimeError(msg)
        return {"name": data["name"], "id": data["id"]}

    if isinstance(model_data, list):
        return [summarize_one(sd) for sd in model_data]
    else:
        return summarize_one(model_data)


def make_case_summary(serialized_data):
    """
    Take in a full serialized object, and return dict containing just
    the specified values

    Parameter: serialized_data, dict, or list of dicts
    Returns: dict, or list of dicts, containing only specified key/values.
    """

    keys = ["id", "name", "description", "created_date"]

    def summarize_one(data):
        result = {}
        for key in keys:
            if not (isinstance(data, dict) and key in data):
                msg = f"Expected dictionary containing {key}"
                raise RuntimeError(msg)
            result[key] = data[key]
        return result

    if isinstance(serialized_data, list):
        return [summarize_one(sd) for sd in serialized_data]
    else:
        return summarize_one(serialized_data)


def get_json_tree(id_list: list, obj_type: str) -> list:
    """
    Recursive function for populating the full JSON data for goals, used
    in the case_detail view (i.e. one API call returns the full case data).

    Params
    ======
    id_list: list of object_ids from the parent serializer
    obj_type: key of the json object (also a key of 'TYPE_DICT')

    Returns
    =======
    objs: list of json objects
    """
    objs = []

    for obj_id in id_list:

        obj = TYPE_DICT[obj_type]["model"].objects.get(pk=obj_id)
        obj_serializer = TYPE_DICT[obj_type]["serializer"](obj)
        obj_data = obj_serializer.data
        for child_type in TYPE_DICT[obj_type]["children"]:
            child_list = sorted(obj_data[child_type])
            obj_data[child_type] = get_json_tree(child_list, child_type)
        objs.append(obj_data)

    return objs


def save_json_tree(data, obj_type, parent_id=None, parent_type=None):
    """Recursively write items in an assurance case tree.

    Create a new assurance case like the one described by data, including all
    its items.

    Params
    ======
    data: JSON for the assurance case and all its items. At the top level
        includes the whole item tree, subtrees when recursing.
    obj_type: Key of the json object (also a key of 'TYPE_DICT'). At the top
        level this should be "assurance_case".
    parent_id: None at the top level, id of the caller when recursing.

    Returns
    =======
    objs: JsonResponse describing failure/success.
    """
    # Create the top object in data. Only include some of the fields from data,
    # so that e.g. the new object gets a unique ID even if `data` specifies an
    # ID.
    this_data = {k: data[k] for k in TYPE_DICT[obj_type]["fields"]}
    if parent_id is not None and parent_type is not None:
        for parent_type_tmp, plural in TYPE_DICT[obj_type]["parent_types"]:
            # TODO This is silly. It's all because some parent_type names are written
            # with a plural s in the end while others are not.
            if (
                parent_type[:-1] not in parent_type_tmp[:-1]
                and parent_type_tmp[:-1] not in parent_type[:-1]
            ):
                continue
            if plural:
                parent_id = [parent_id]
            this_data[parent_type_tmp + "_id"] = parent_id
    serializer_class = TYPE_DICT[obj_type]["serializer"]
    serializer = serializer_class(data=this_data)
    if serializer.is_valid():
        serializer.save()
    else:
        return JsonResponse(serializer.errors, status=400)

    # Recurse into child types.
    name = serializer.data["name"]
    id = serializer.data["id"]
    success_http_code = 201
    child_types = TYPE_DICT[obj_type]["children"]
    for child_type in child_types:
        if child_type not in data:
            continue
        for child_data in data[child_type]:
            retval = save_json_tree(
                child_data, child_type, parent_id=id, parent_type=obj_type
            )
            # If one of the subcalls returns an error, return.
            if retval.status_code != success_http_code:
                return retval

    summary = {"name": name, "id": id}
    return JsonResponse(summary, status=success_http_code)


def get_case_permissions(case, user):
    """
    See if the user is allowed to view or edit the case.

    Params:
    =======
    case: AssuranceCase instance, as obtained from AssuranceCase.objects.get(pk)
    user: EAPUser instance, as returned from request.user

    Returns:
    =======
    string
       "manage": if case has no owner or if user is owner
       "edit": if user is a member of a group that has edit rights on the case
       "view": if user is a member of a group that has view rights on the case
    None otherwise.
    """
    if isinstance(case, (int, str)):
        case = AssuranceCase.objects.get(pk=int(case))

    if (not case.owner) or (case.owner == user):
        # case has no owner - anyone can view it, or user is owner
        return "manage"

    # now check groups
    try:
        user_groups = user.all_groups.get_queryset()
        edit_groups = case.edit_groups.get_queryset()
        # check intersection of two lists
        if set(edit_groups) & set(user_groups):
            return "edit"
        view_groups = case.view_groups.get_queryset()
        if set(view_groups) & set(user_groups):
            return "view"
    except EAPGroup.DoesNotExist:
        # no group found for user or for case
        pass
    except AttributeError:
        # probably AnonymousUser
        pass
    return None


def get_allowed_cases(user):
    """
    get a list of AssuranceCases that the user is allowed to view or edit.

    Parameters:
    ===========
    user: EAPUser instance, as returned by request.user

    Returns:
    ========
    list of AssuranceCase instances.
    """
    all_cases = AssuranceCase.objects.all()
    # if get_case_permissions returns anything other than None, include in allowed_cases
    return [case for case in all_cases if get_case_permissions(case, user)]


def can_view_group(group, user, level="member"):
    """
    See if the user is allowed to view the group, or if they own it

    Params:
    =======
    group: EAPGroup instance, as obtained from EAPGroup.objects.get(pk)
    user: EAPUser instance, as returned from request.user
    level: str, either "member" or "owner", to select level of permission to view

    Returns:
    =======
    True if user is member / owner of the group.
    False otherwise.
    """
    if level not in ["owner", "member"]:
        msg = "'level' parameter should be 'owner' or 'member'"
        raise RuntimeError(msg)
    if not hasattr(user, "all_groups"):
        # probably AnonymousUser
        return False
    if level == "owner" and group.owner and group.owner == user:
        return True
    elif level == "member" and group in user.all_groups.get_queryset():
        return True
    return False


def get_allowed_groups(user, level="member"):
    """
    get a list of Groups that the user is allowed to view or that they own.

    Parameters:
    ===========
    user: EAPUser instance, as returned by request.user
    level: str, either "member" or "owner", to select level of permission to view

    Returns:
    ========
    list of EAPGroup instances in which the user is a member, or the owner
    """
    all_groups = EAPGroup.objects.all()
    return [group for group in all_groups if can_view_group(group, user, level)]
