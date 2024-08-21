import functools
from typing import Any, Callable, Optional, Union, cast

from django.db.models.query import QuerySet
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.utils.crypto import get_random_string
from rest_framework.serializers import ReturnDict

from .model_utils import (
    get_case_property_claims,
    traverse_child_property_claims,
)
from .models import (
    AssuranceCase,
    CaseItem,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
)
from .serializers import (
    TYPE_DICT,
    AssuranceCaseSerializer,
    SandboxSerializer,
    get_case_id,
)


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
            ) = get_case_property_claims(current_case_goal, current_case_strategies)

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
                traverse_child_property_claims(
                    lambda index, child, parent: UpdateIdentifierUtils._update_item_name(
                        child, f"{parent.name}.", index + 1
                    ),
                    property_claim.pk,
                )

            if model_instance is not None:
                model_instance.refresh_from_db()

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
    def _update_item_name(case_item: CaseItem, prefix: str, number: int) -> None:
        """Updates the name of a case item, given a prefix and a sequence number."""
        case_item.name = f"{prefix}{number}"
        case_item.save()

    @staticmethod
    def _update_sequential_identifiers(query_set: QuerySet | list, prefix: str):
        """For a list of case items, it updates their name according to its order."""
        for model_index, model in enumerate(query_set):
            UpdateIdentifierUtils._update_item_name(model, prefix, model_index + 1)


class SocialAuthenticationUtils:
    @staticmethod
    def register_social_user(social_user: EAPUser, auth_provider: str) -> EAPUser:

        matching_users: QuerySet = EAPUser.objects.filter(
            auth_provider=auth_provider,
            auth_username=social_user.username,
        )

        if matching_users.count() == 0:
            username_length: int = 15
            password_length: int = 45

            new_github_user: EAPUser = EAPUser.objects.create_user(
                username=get_random_string(username_length),
                email=social_user.email,
                auth_username=social_user.username,
                auth_provider=auth_provider,
            )
            new_github_user.set_password(get_random_string(password_length))
            new_github_user.save()

            return new_github_user

        elif matching_users.count() == 1:
            return cast(EAPUser, matching_users.first())
        else:
            error_message: str = (
                f"{matching_users.count()} accounts for email {social_user.email} and provider {auth_provider}"
            )
            raise Exception(error_message)


class ShareAssuranceCaseUtils:
    @staticmethod
    def get_case_permissions(
        assurance_case: AssuranceCase,
    ) -> dict[str, list[dict[str, Any]]]:

        return {
            "view": ShareAssuranceCaseUtils._get_users_from_group_list(
                assurance_case.view_groups
            ),
            "edit": ShareAssuranceCaseUtils._get_users_from_group_list(
                assurance_case.edit_groups
            ),
        }

    @staticmethod
    def extract_requests(
        request_serializer, permission_key: str
    ) -> tuple[list[EAPUser], list[EAPUser]]:

        additions: list[EAPUser] = []
        removals: list[EAPUser] = []

        for share_request in cast(dict, request_serializer.validated_data):
            user: EAPUser = EAPUser.objects.get(email=share_request["email"])
            if permission_key in share_request and share_request[permission_key]:
                additions.append(user)
            if permission_key in share_request and not share_request[permission_key]:
                removals.append(user)

        return additions, removals

    @staticmethod
    def get_user_cases(
        user: EAPUser, owner: bool = True, view: bool = True, edit: bool = True
    ) -> list[dict]:
        case_catalog: dict[int, dict] = {}
        group_ids: list[int] = [group.pk for group in user.all_groups.all()]

        if view:
            view_cases: QuerySet[AssuranceCase] = AssuranceCase.objects.filter(
                view_groups__in=group_ids
            )
            ShareAssuranceCaseUtils._consolidate_case_list(
                case_catalog, view_cases, "view"
            )

        if edit:
            edit_cases: QuerySet[AssuranceCase] = AssuranceCase.objects.filter(
                edit_groups__in=group_ids
            )
            ShareAssuranceCaseUtils._consolidate_case_list(
                case_catalog, edit_cases, "edit"
            )

        if owner:
            ShareAssuranceCaseUtils._consolidate_case_list(
                case_catalog, user.cases.all(), "owner"
            )

        serialized_cases: list[dict] = []
        for case_entry in case_catalog.values():
            serialized_cases.append(
                ShareAssuranceCaseUtils.make_case_summary(
                    AssuranceCaseSerializer(case_entry["case"]),
                    case_entry["permissions"],
                )
            )

        return serialized_cases

    @staticmethod
    def make_case_summary(serialized_case, permissions: set) -> dict:
        case_summary: dict = cast(dict, make_case_summary(serialized_case.data))
        case_summary["permissions"] = list(permissions)
        return case_summary

    @staticmethod
    def _consolidate_case_list(
        case_catalog: dict[int, dict],
        new_cases: QuerySet[AssuranceCase],
        permission: str,
    ):
        cases_as_list: list[AssuranceCase] = list(new_cases)

        for case in cases_as_list:
            if case.pk not in case_catalog:
                case_catalog[case.pk] = {"case": case, "permissions": {permission}}
            else:
                case_catalog[case.pk]["permissions"].add(permission)

    @staticmethod
    def _get_users_from_group_list(group_manager: QuerySet) -> list[dict[str, Any]]:
        user_dictionary: dict[int, dict[str, Any]] = {}
        for current_group in group_manager.all():
            group_users = {
                user.pk: {"id": user.pk, "email": user.email}
                for user in current_group.member.all()
            }

            user_dictionary = user_dictionary | group_users

        return list(user_dictionary.values())

    @staticmethod
    def get_edit_group(assurance_case: AssuranceCase) -> EAPGroup:
        edit_group: EAPGroup | None = None
        owner_edit_group_name: str = (
            f"{assurance_case.owner.username}-case-{assurance_case.pk}-edit-group"
        )

        group_query_set: QuerySet = assurance_case.edit_groups.filter(
            owner=assurance_case.owner, name=owner_edit_group_name
        )

        (
            edit_group,
            new_group,
        ) = ShareAssuranceCaseUtils._get_or_create_permission_group(
            assurance_case, owner_edit_group_name, group_query_set
        )

        if new_group:
            assurance_case.edit_groups.add(edit_group)
            assurance_case.save()

        return edit_group

    @staticmethod
    def get_review_group(assurance_case: AssuranceCase) -> EAPGroup:

        review_group: EAPGroup | None = None
        owner_review_group_name: str = (
            f"{assurance_case.owner.username}-case-{assurance_case.pk}-review-group"
        )

        group_query_set: QuerySet = assurance_case.review_groups.filter(
            owner=assurance_case.owner, name=owner_review_group_name
        )

        (
            review_group,
            new_group,
        ) = ShareAssuranceCaseUtils._get_or_create_permission_group(
            assurance_case, owner_review_group_name, group_query_set
        )

        if new_group:
            assurance_case.review_groups.add(review_group)
            assurance_case.save()

        return review_group

    @staticmethod
    def get_view_group(assurance_case: AssuranceCase) -> EAPGroup:

        view_group: EAPGroup | None = None
        owner_view_group_name: str = (
            f"{assurance_case.owner.username}-case-{assurance_case.pk}-view-group"
        )

        group_query_set: QuerySet = assurance_case.view_groups.filter(
            owner=assurance_case.owner, name=owner_view_group_name
        )

        (
            view_group,
            new_group,
        ) = ShareAssuranceCaseUtils._get_or_create_permission_group(
            assurance_case, owner_view_group_name, group_query_set
        )

        if new_group:
            assurance_case.view_groups.add(view_group)
            assurance_case.save()

        return view_group

    @staticmethod
    def add_and_remove_permissions(
        permission_key: str,
        assurance_case: AssuranceCase,
        add: list[EAPUser] | None = None,
        remove: list[EAPUser] | None = None,
    ) -> None:

        default_group: EAPGroup
        all_groups: QuerySet
        if permission_key == "view":
            default_group = ShareAssuranceCaseUtils.get_view_group(assurance_case)
            all_groups = assurance_case.view_groups.all()

        elif permission_key == "edit":
            default_group = ShareAssuranceCaseUtils.get_edit_group(assurance_case)
            all_groups = assurance_case.edit_groups.all()

        elif permission_key == "review":
            default_group = ShareAssuranceCaseUtils.get_review_group(assurance_case)
            all_groups = assurance_case.review_groups.all()

        if add is not None:
            default_group.member.add(*add)
            default_group.save()
        if remove is not None:
            for current_group in all_groups:
                current_group.member.remove(*remove)
                current_group.save()

    @staticmethod
    def _get_or_create_permission_group(
        assurance_case: AssuranceCase, group_name: str, group_query_set: QuerySet
    ) -> tuple[EAPGroup, bool]:
        new_group: bool = False
        if group_query_set.count() == 0:
            new_group = True
            return (
                EAPGroup.objects.create(owner=assurance_case.owner, name=group_name),
                new_group,
            )

        elif group_query_set.count() == 1:
            return cast(EAPGroup, group_query_set.first()), new_group
        else:
            error_message: str = (
                f"Found {group_query_set.count()} permission groups for case {assurance_case.pk}"
            )
            raise ValueError(error_message)


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
