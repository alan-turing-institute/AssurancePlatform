import warnings

from django.http import JsonResponse

from . import models
from .models import (
    AssuranceCase,
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
    StrategySerializer,
    TopLevelNormativeGoalSerializer,
)

TYPE_DICT = {
    "assurance_case": {
        "serializer": AssuranceCaseSerializer,
        "model": AssuranceCase,
        "children": ["goals"],
        "fields": ("name", "description", "lock_uuid", "owner", "color_profile"),
    },
    "goal": {
        "serializer": TopLevelNormativeGoalSerializer,
        "model": TopLevelNormativeGoal,
        "children": ["context", "property_claims", "strategies"],
        "fields": ("name", "short_description", "long_description", "keywords"),
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


def get_case_id(item):
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


def make_summary(serialized_data):
    """
    Take in a full serialized object, and return dict containing just
    the id and the name

    Parameter: serialized_data, dict, or list of dicts
    Returns: dict, or list of dicts, containing just "name" and "id" key/values.
    """

    def summarize_one(data):
        if not (isinstance(data, dict) and "id" in data and "name" in data):
            msg = "Expected dictionary containing name and id"
            raise RuntimeError(msg)
        return {"name": data["name"], "id": data["id"]}

    if isinstance(serialized_data, list):
        return [summarize_one(sd) for sd in serialized_data]
    else:
        return summarize_one(serialized_data)


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


def get_json_tree(id_list, obj_type):
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
