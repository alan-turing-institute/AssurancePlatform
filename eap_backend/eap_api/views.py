from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from rest_framework import generics
from .models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    Argument,
    EvidentialClaim,
    Evidence,
)
from .serializers import (
    AssuranceCaseSerializer,
    TopLevelNormativeGoalSerializer,
    ContextSerializer,
    SystemDescriptionSerializer,
    PropertyClaimSerializer,
    ArgumentSerializer,
    EvidentialClaimSerializer,
    EvidenceSerializer,
)

TYPE_DICT = {
    "assurance_case": {
        "serializer": AssuranceCaseSerializer,
        "model": AssuranceCase,
        "children": ["goals"],
        "fields": ("name", "description"),
    },
    "goals": {
        "serializer": TopLevelNormativeGoalSerializer,
        "model": TopLevelNormativeGoal,
        "children": ["context", "system_description", "property_claims"],
        "fields": ("name", "short_description", "long_description", "keywords"),
        "parent_type": ("assurance_case", False),
    },
    "context": {
        "serializer": ContextSerializer,
        "model": Context,
        "children": [],
        "fields": ("name", "short_description", "long_description"),
        "parent_type": ("goal", False),
    },
    "system_description": {
        "serializer": SystemDescriptionSerializer,
        "model": SystemDescription,
        "children": [],
        "fields": ("name", "short_description", "long_description"),
        "parent_type": ("goal", False),
    },
    "property_claims": {
        "serializer": PropertyClaimSerializer,
        "model": PropertyClaim,
        "children": ["arguments"],
        "fields": ("name", "short_description", "long_description"),
        "parent_type": ("parent", False),
    },
    "arguments": {
        "serializer": ArgumentSerializer,
        "model": Argument,
        "children": ["evidential_claims"],
        "fields": ("name", "short_description", "long_description"),
        "parent_type": ("property_claim", True),
    },
    "evidential_claims": {
        "serializer": EvidentialClaimSerializer,
        "model": EvidentialClaim,
        "children": ["evidence"],
        "fields": ("name", "short_description", "long_description"),
        "parent_type": ("argument", False),
    },
    "evidence": {
        "serializer": EvidenceSerializer,
        "model": Evidence,
        "children": [],
        "fields": ("name", "short_description", "long_description", "URL"),
        "parent_type": ("evidential_claim", True),
    },
}


class AssuranceView(generics.ListCreateAPIView):
    queryset = AssuranceCase.objects.all()
    serializer_class = AssuranceCaseSerializer


class GoalsView(generics.ListCreateAPIView):
    queryset = TopLevelNormativeGoal.objects.all()
    serializer_class = TopLevelNormativeGoalSerializer


class DetailAssuranceView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AssuranceCase.objects.all()
    serializer_class = AssuranceCaseSerializer


def make_summary(serialized_data):
    """
    Take in a full serialized object, and return dict containing just
    the id and the name

    parameter: serialized_data, dict, or list of dicts
    returns: dict, or list of dicts, containing just "name" and "id" key/values.
    """

    def summarize_one(data):
        if not (
            isinstance(data, dict) and "id" in data.keys() and "name" in data.keys()
        ):
            raise RuntimeError("Expected dictionary containing name and id")
        return {"name": data["name"], "id": data["id"]}

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
            child_list = obj_data[child_type]
            obj_data[child_type] = get_json_tree(child_list, child_type)
        objs.append(obj_data)
    return objs


def save_json_tree(data, obj_type, parent_id=None):
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
    if parent_id is not None:
        parent_type, plural = TYPE_DICT[obj_type]["parent_type"]
        if plural:
            parent_id = [parent_id]
        this_data[parent_type + "_id"] = parent_id
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
            retval = save_json_tree(child_data, child_type, parent_id=id)
            # If one of the subcalls returns an error, return.
            if retval.status_code != success_http_code:
                return retval

    summary = {"name": name, "id": id}
    return JsonResponse(summary, status=success_http_code)


@csrf_exempt
def case_list(request):
    """
    List all cases, or make a new case
    """
    if request.method == "GET":
        cases = AssuranceCase.objects.all()
        serializer = AssuranceCaseSerializer(cases, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        return save_json_tree(data, "assurance_case")


@csrf_exempt
def case_detail(request, pk):
    """
    Retrieve, update, or delete an AssuranceCase, by primary key
    """
    try:
        case = AssuranceCase.objects.get(pk=pk)
    except AssuranceCase.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = AssuranceCaseSerializer(case)
        case_data = serializer.data
        goals = get_json_tree(case_data["goals"], "goals")
        case_data["goals"] = goals
        return JsonResponse(case_data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = AssuranceCaseSerializer(case, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        case.delete()
        return HttpResponse(status=204)


@csrf_exempt
def goal_list(request):
    """
    List all goals, or make a new goal
    """
    if request.method == "GET":
        goals = TopLevelNormativeGoal.objects.all()
        serializer = TopLevelNormativeGoalSerializer(goals, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        assurance_case_id = AssuranceCase.objects.get(id=data["assurance_case_id"])
        data["assurance_case"] = assurance_case_id
        serializer = TopLevelNormativeGoalSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def goal_detail(request, pk):
    """
    Retrieve, update, or delete a TopLevelNormativeGoal, by primary key
    """
    try:
        goal = TopLevelNormativeGoal.objects.get(pk=pk)
        shape = goal.shape.name
    except TopLevelNormativeGoal.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = TopLevelNormativeGoalSerializer(goal)
        data = serializer.data
        # replace IDs for children with full JSON objects
        for key in ["context", "system_description", "property_claims"]:
            data[key] = get_json_tree(data[key], key)
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = TopLevelNormativeGoalSerializer(goal, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        goal.delete()
        return HttpResponse(status=204)


@csrf_exempt
def context_list(request):
    """
    List all contexts, or make a new context
    """
    if request.method == "GET":
        contexts = Context.objects.all()
        serializer = ContextSerializer(contexts, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = ContextSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def context_detail(request, pk):
    """
    Retrieve, update, or delete a Context, by primary key
    """
    try:
        context = Context.objects.get(pk=pk)
        shape = context.shape.name
    except Context.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = ContextSerializer(context)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = ContextSerializer(context, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        context.delete()
        return HttpResponse(status=204)


@csrf_exempt
def description_list(request):
    """
    List all descriptions, or make a new description
    """
    if request.method == "GET":
        descriptions = SystemDescription.objects.all()
        serializer = SystemDescriptionSerializer(descriptions, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = SystemDescriptionSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def description_detail(request, pk):
    """
    Retrieve, update, or delete a SystemDescription, by primary key
    """
    try:
        description = SystemDescription.objects.get(pk=pk)
        shape = description.shape.name
    except SystemDescription.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = SystemDescriptionSerializer(description)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = SystemDescriptionSerializer(description, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        description.delete()
        return HttpResponse(status=204)


@csrf_exempt
def property_claim_list(request):
    """
    List all claims, or make a new claim
    """
    if request.method == "GET":
        claims = PropertyClaim.objects.all()
        serializer = PropertyClaimSerializer(claims, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = PropertyClaimSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def property_claim_detail(request, pk):
    """
    Retrieve, update, or delete a PropertyClaim, by primary key
    """
    try:
        claim = PropertyClaim.objects.get(pk=pk)
        shape = claim.shape.name
    except PropertyClaim.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = PropertyClaimSerializer(claim)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = PropertyClaimSerializer(claim, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        claim.delete()
        return HttpResponse(status=204)


@csrf_exempt
def argument_list(request):
    """
    List all arguments, or make a new argument
    """
    if request.method == "GET":
        arguments = Argument.objects.all()
        serializer = ArgumentSerializer(arguments, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = ArgumentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def argument_detail(request, pk):
    """
    Retrieve, update, or delete a Argument, by primary key
    """
    try:
        argument = Argument.objects.get(pk=pk)
        shape = argument.shape.name
    except Argument.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = ArgumentSerializer(argument)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = ArgumentSerializer(argument, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        argument.delete()
        return HttpResponse(status=204)


@csrf_exempt
def evidential_claim_list(request):
    """
    List all evidential_claims, or make a new evidential_claim
    """
    if request.method == "GET":
        evidential_claims = EvidentialClaim.objects.all()
        serializer = EvidentialClaimSerializer(evidential_claims, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = EvidentialClaimSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def evidential_claim_detail(request, pk):
    """
    Retrieve, update, or delete a EvidentialClaim, by primary key
    """
    try:
        evidential_claim = EvidentialClaim.objects.get(pk=pk)
        shape = evidential_claim.shape.name
    except EvidentialClaim.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = EvidentialClaimSerializer(evidential_claim)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = EvidentialClaimSerializer(
            evidential_claim, data=data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        evidential_claim.delete()
        return HttpResponse(status=204)


@csrf_exempt
def evidence_list(request):
    """
    List all evidences, or make a new evidence
    """
    if request.method == "GET":
        evidences = Evidence.objects.all()
        serializer = EvidenceSerializer(evidences, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = EvidenceSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def evidence_detail(request, pk):
    """
    Retrieve, update, or delete Evidence, by primary key
    """
    try:
        evidence = Evidence.objects.get(pk=pk)
        shape = evidence.shape.name
    except Evidence.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = EvidenceSerializer(evidence)
        data = serializer.data
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = EvidenceSerializer(evidence, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        evidence.delete()
        return HttpResponse(status=204)
