from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from typing import Optional

from .models import (
    AssuranceCase,
    Comment,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    GitHubRepository,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
    CaseItem,
)
from .serializers import (
    AssuranceCaseSerializer,
    CommentSerializer,
    ContextSerializer,
    EAPGroupSerializer,
    EAPUserSerializer,
    EvidenceSerializer,
    GitHubRepositorySerializer,
    GithubSocialAuthSerializer,
    PropertyClaimSerializer,
    StrategySerializer,
    TopLevelNormativeGoalSerializer,
)
from .view_utils import (
    TYPE_DICT,
    can_view_group,
    filter_by_case_id,
    get_allowed_cases,
    get_allowed_groups,
    get_case_permissions,
    get_json_tree,
    make_case_summary,
    make_summary,
    save_json_tree,
    get_case_id,
)


@csrf_exempt
def user_list(request) -> Optional[HttpResponse]:
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
    return None


@csrf_exempt
@api_view(["GET"])
def self_detail(request):
    """
    Retrieve, update, or delete a User by primary key
    """
    pk = request.user.id
    try:
        user = EAPUser.objects.get(pk=pk)
    except EAPUser.DoesNotExist:
        return HttpResponse(status=404)
    if request.user != user:
        return HttpResponse(status=403)
    if request.method == "GET":
        serializer = EAPUserSerializer(user)
        user_data = serializer.data
        return JsonResponse(user_data)
    return None


@csrf_exempt
@api_view(["GET", "PUT", "DELETE", "POST"])
def user_detail(request, pk=None):
    """
    Retrieve, update, or delete a User by primary key
    """
    try:
        user = EAPUser.objects.get(pk=pk)
    except EAPUser.DoesNotExist:
        return HttpResponse(status=404)
    if request.user != user:
        return HttpResponse(status=403)
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
    elif request.method == "POST":
        # This block assumes you are receiving GitHub repository data to add to the user
        repo_serializer = GitHubRepositorySerializer(data=request.data)
        if repo_serializer.is_valid():
            repo_serializer.save(owner=user)
            return JsonResponse(repo_serializer.data, status=201)
        return JsonResponse(repo_serializer.errors, status=400)

    return None


@csrf_exempt
@api_view(["GET", "POST"])
def group_list(request):
    """
    List all group, or make a new group
    """
    if request.method == "GET":
        response_dict = {}
        for level in ["owner", "member"]:
            groups = get_allowed_groups(request.user, level)
            serializer = EAPGroupSerializer(groups, many=True)
            response_dict[level] = serializer.data
        return JsonResponse(response_dict, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        data["owner_id"] = request.user.id
        data["members"] = [request.user.id]
        serializer = EAPGroupSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    return None


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
    if not can_view_group(group, request.user, "owner"):
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
    return None


@csrf_exempt
@api_view(["GET", "POST"])
def case_list(request):
    """
    List all cases, or make a new case
    """
    if request.method == "GET":
        cases = get_allowed_cases(request.user)
        serializer = AssuranceCaseSerializer(cases, many=True)
        summaries = make_case_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        data["owner"] = request.user.id
        return save_json_tree(data, "assurance_case")
    return None


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
    permissions = get_case_permissions(case, request.user)
    if not permissions:
        return HttpResponse(status=403)
    if request.method == "GET":
        serializer = AssuranceCaseSerializer(case)
        case_data = serializer.data
        goals = get_json_tree(case_data["goals"], "goals")
        case_data["goals"] = goals
        case_data["permissions"] = permissions
        return JsonResponse(case_data)
    elif request.method == "PUT":
        if permissions not in ["manage", "edit"]:
            return HttpResponse(status=403)
        data = JSONParser().parse(request)
        serializer = AssuranceCaseSerializer(case, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        if permissions not in ["manage", "edit"]:
            return HttpResponse(status=403)
        case.delete()
        return HttpResponse(status=204)

    return None


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
        assurance_case_id = AssuranceCase.objects.get(
            id=data["assurance_case_id"]
        )
        data["assurance_case"] = assurance_case_id
        serializer = TopLevelNormativeGoalSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)
    return None


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
        for key in ["context", "property_claims"]:
            data[key] = get_json_tree(data[key], key)
        data["shape"] = shape
        return JsonResponse(data)
    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = TopLevelNormativeGoalSerializer(
            goal, data=data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            data = serializer.data
            data["shape"] = shape
            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        goal.delete()
        return HttpResponse(status=204)
    return None


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
            update_identifiers(serializer.instance)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)
    return None


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
        update_identifiers(context)
        return HttpResponse(status=204)
    return None


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
            update_identifiers(serializer.instance)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)
    return None


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
        update_identifiers(claim)
        return HttpResponse(status=204)
    return None


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
    return None


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
    return None


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


@csrf_exempt
def strategies_list(request):
    """
    List all strategies, or make a new strategy
    """
    if request.method == "GET":
        strategies = Strategy.objects.all()
        strategies = filter_by_case_id(strategies, request)
        serializer = StrategySerializer(strategies, many=True)
        summaries = make_summary(serializer.data)
        return JsonResponse(summaries, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        serializer = StrategySerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            update_identifiers(serializer.instance)
            return JsonResponse(summary, status=201)
        return JsonResponse(serializer.errors, status=400)
    return None


@csrf_exempt
def strategy_detail(request, pk):
    try:
        strategy = Strategy.objects.get(pk=pk)
    except Strategy.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = StrategySerializer(strategy)
        return JsonResponse(serializer.data)

    elif request.method == "PUT":
        data = JSONParser().parse(request)
        serializer = StrategySerializer(strategy, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            summary = make_summary(serializer.data)
            return JsonResponse(summary)
        return JsonResponse(serializer.errors, status=400)

    elif request.method == "DELETE":
        strategy.delete()
        update_identifiers(strategy)
        return HttpResponse(status=204)
    return None


@permission_classes((AllowAny,))
class GithubSocialAuthView(GenericAPIView):
    serializer_class = GithubSocialAuthSerializer

    def post(self, request):
        """
        POST with "auth_token"
        Send an access token from GitHub to get user information
        """
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = (serializer.validated_data)["auth_token"]
        return Response(data, status=status.HTTP_200_OK)


class CommentEdit(generics.UpdateAPIView):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer


@api_view(["GET", "POST"])
def github_repository_list(request):
    """
    GET: List all GitHub repositories for a user.
    POST: Add a new GitHub repository to a user.
    """
    if request.method == "GET":
        repositories = GitHubRepository.objects.filter(owner=request.user)
        serializer = GitHubRepositorySerializer(repositories, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        # Assume the POST data includes fields for creating a GitHubRepository
        request.data["owner"] = request.user.id
        serializer = GitHubRepositorySerializer(data=request.data)
        if serializer.is_valid():
            # Set the owner to the current user before saving
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "POST"])
def comment_list(request, assurance_case_id):
    """
    List all comments for an assurance case, or create a new comment.
    """
    permissions = get_case_permissions(assurance_case_id, request.user)
    if not permissions:
        return HttpResponse(status=403)

    if request.method == "GET":
        comments = Comment.objects.filter(assurance_case_id=assurance_case_id)
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            # Ensure the author is set to the current user
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def reply_to_comment(request, comment_id):
    """
    Reply to an existing comment.
    """
    try:
        parent_comment = Comment.objects.get(pk=comment_id)
        assurance_case_id = parent_comment.assurance_case_id
    except Comment.DoesNotExist:
        return HttpResponse(status=status.HTTP_404_NOT_FOUND)

    permissions = get_case_permissions(assurance_case_id, request.user)
    if not permissions:
        return HttpResponse(status=403)

    if request.method == "POST":
        data = JSONParser().parse(request)
        data["parent"] = comment_id
        data[
            "author"
        ] = request.user.id  # Ensure the author is set to the current user
        data["assurance_case"] = parent_comment.assurance_case_id
        serializer = CommentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(
                serializer.data, status=status.HTTP_201_CREATED
            )
        return JsonResponse(
            serializer.errors, status=status.HTTP_400_BAD_REQUEST
        )
    return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def update_identifiers(item: CaseItem):

    case_id: Optional[int] = get_case_id(item)
    if case_id is None:
        raise ValueError("Cannot obtain case id!")

    goal_id: int = TopLevelNormativeGoal.objects.get(
        assurance_case_id=case_id
    ).pk

    for context_index, context in enumerate(
        Context.objects.filter(goal_id=goal_id)
    ):
        context.name = f"C{context_index + 1}"
        context.save()

    for strategy_index, strategy in enumerate(
        Strategy.objects.filter(goal_id=goal_id)
    ):
        strategy.name = f"S{strategy_index + 1}"
        strategy.save()

    parent_property_claims = PropertyClaim.objects.filter(
        property_claim_id=None
    )
    current_case_claims = [
        claim
        for claim in parent_property_claims
        if get_case_id(claim) == case_id
    ]
    for property_claim_index, property_claim in enumerate(current_case_claims):
        property_claim.name = f"P{property_claim_index + 1}"
        property_claim.save()
        update_property_claim_identifiers(property_claim)


def update_property_claim_identifiers(parent_property_claim: PropertyClaim):
    child_property_claims = PropertyClaim.objects.filter(
        property_claim_id=parent_property_claim.pk
    )

    if len(child_property_claims) == 0:
        return
    else:
        for index, child_property_claim in enumerate(child_property_claims):
            child_property_claim.name = (
                f"{parent_property_claim.name}.{index + 1}"
            )
            child_property_claim.save()
            update_property_claim_identifiers(child_property_claim)
