import warnings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.parsers import JSONParser
from rest_framework.decorators import api_view
from rest_framework import generics
from .models import (
    EAPUser,
    EAPGroup,
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    EvidentialClaim,
    Evidence,
)
from . import models
from .serializers import (
    EAPUserSerializer,
    EAPGroupSerializer,
    AssuranceCaseSerializer,
    TopLevelNormativeGoalSerializer,
    ContextSerializer,
    SystemDescriptionSerializer,
    PropertyClaimSerializer,
    EvidentialClaimSerializer,
    EvidenceSerializer,
)
from .view_utils import (
    filter_by_case_id,
    make_summary,
    get_json_tree,
    save_json_tree,
    can_view_case,
    get_allowed_cases,
    can_view_group,
    get_allowed_groups,
)


@csrf_exempt
def user_list(request):
    """
    List all users, or make a new user
    """
    if request.method == "GET":
        users = EAPUser.objects.all()
        serializer = EAPUserSerializer(users, many=True)
        return JsonResponse(serializer.data, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = EAPUserSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
def user_detail(request, pk):
    """
    Retrieve, update, or delete a User by primary key
    """
    try:
        user = EAPUser.objects.get(pk=pk)
    except EAPUser.DoesNotExist:
        return HttpResponse(status=404)
    if request.method == "GET":
        serializer = EAPUserSerializer(user)
        user_data = serializer.data
        return JsonResponse(user_data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = EAPUserSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        user.delete()
        return HttpResponse(status=204)


@csrf_exempt
@api_view(["GET", "POST"])
def group_list(request):
    """
    List all group, or make a new group
    """

    if request.method == "GET":
        groups = get_allowed_groups(request.user)
        serializer = EAPGroupSerializer(groups, many=True)
        return JsonResponse(serializer.data, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        data["owner_id"] = request.user.id
        data["members"] = [request.user.id]
        serializer = EAPGroupSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=201)
        return JsonResponse(serializer.errors, status=400)


@csrf_exempt
@api_view(["GET", "PUT", "DELETE"])
def group_detail(request, pk):
    """
    Retrieve, update, or delete a Group by primary key
    """
    try:
        group = EAPGroup.objects.get(pk=pk)
    except EAPGroup.DoesNotExist:
        return HttpResponse(status=404)
    if not can_view_group(group, request.user):
        return HttpResponse(status=403)
    if request.method == "GET":
        serializer = EAPGroupSerializer(group)
        group_data = serializer.data
        return JsonResponse(group_data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = EAPGroupSerializer(group, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        group.delete()
        return HttpResponse(status=204)


@csrf_exempt
@api_view(["GET", "POST"])
def case_list(request):
    """
    List all cases, or make a new case
    """
    if request.method == "GET":
        cases = get_allowed_cases(request.user)
        serializer = AssuranceCaseSerializer(cases, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        data["owner"] = request.user.id
        return save_json_tree(data, "assurance_case")


@csrf_exempt
@api_view(["GET", "POST", "PUT", "DELETE"])
def case_detail(request, pk):
    """
    Retrieve, update, or delete an AssuranceCase, by primary key
    """
    try:
        case = AssuranceCase.objects.get(pk=pk)
    except AssuranceCase.DoesNotExist:
        return HttpResponse(status=404)
    if not can_view_case(case, request.user):
        return HttpResponse(status=403)
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
        goals = filter_by_case_id(goals, request)
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
        contexts = filter_by_case_id(contexts, request)
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
        descriptions = filter_by_case_id(descriptions, request)
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
        claims = filter_by_case_id(claims, request)
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
def evidential_claim_list(request):
    """
    List all evidential_claims, or make a new evidential_claim
    """
    if request.method == "GET":
        evidential_claims = EvidentialClaim.objects.all()
        evidential_claims = filter_by_case_id(evidential_claims, request)
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
        evidences = filter_by_case_id(evidences, request)
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


@csrf_exempt
def parents(request, item_type, pk):
    """Return all the parents of an item."""
    if request.method != "GET":
        return HttpResponse(status=404)
    item = TYPE_DICT[item_type]["model"].objects.get(pk=pk)
    parent_types = TYPE_DICT[item_type]["parent_types"]
    parents_data = []
    for parent_type, many in parent_types:
        serializer_class = TYPE_DICT[parent_type]["serializer"]
        parent = getattr(item, parent_type)
        if parent is None:
            continue
        parents_data += serializer_class(parent, many=many).data
    return JsonResponse(parents_data, safe=False)
