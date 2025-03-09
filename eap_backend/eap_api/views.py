from typing import Any, cast

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import HttpRequest
from rest_framework.response import Response
from rest_framework.serializers import ReturnDict
from social_core.exceptions import AuthForbidden
from social_django.utils import psa
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer
import json

from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    AssuranceCase,
    AssuranceCaseImage,
    Comment,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    GitHubRepository,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
    CaseStudy,
    CaseStudyFeatureImage,
    PublishedAssuranceCase,
)
from .serializers import (
    TYPE_DICT,
    AssuranceCaseImageSerializer,
    AssuranceCaseSerializer,
    CommentSerializer,
    ContextSerializer,
    EAPGroupSerializer,
    EAPUserSerializer,
    EvidenceSerializer,
    GitHubRepositorySerializer,
    GithubSocialAuthSerializer,
    PasswordChangeSerializer,
    PropertyClaimSerializer,
    ShareRequestSerializer,
    StrategySerializer,
    TopLevelNormativeGoalSerializer,
    UsernameAwareUserSerializer,
    get_case_id,
    CaseStudySerializer,
    CaseStudyFeatureImageSerializer,
    PublishedAssuranceCaseSerializer,
)
from .view_utils import (
    CommentUtils,
    SandboxUtils,
    ShareAssuranceCaseUtils,
    SocialAuthenticationUtils,
    UpdateIdentifierUtils,
    can_view_group,
    filter_by_case_id,
    get_allowed_groups,
    get_case_permissions,
    get_json_tree,
    make_summary,
    save_json_tree,
)


@csrf_exempt
@permission_classes([IsAuthenticated])
def user_list(request: HttpRequest) -> HttpResponse:
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
@permission_classes([IsAuthenticated])
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
        serializer = UsernameAwareUserSerializer(user)
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
@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def change_user_password(request: HttpRequest, pk: int) -> HttpResponse:
    user_to_update: EAPUser = EAPUser.objects.get(pk=pk)

    if request.user != user_to_update:
        return Response(
            {"error": "You are not authorized to perform this operation"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = PasswordChangeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not user_to_update.check_password(
        raw_password=cast(str, serializer.validated_data.get("password"))
    ):
        return Response(
            {"error": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST
        )

    user_to_update.set_password(serializer.validated_data.get("new_password"))
    user_to_update.save()

    return HttpResponse({"message": "Password updated!"}, status=200)


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
@permission_classes([IsAuthenticated])
def case_list(request):
    """
    List all cases, or make a new case
    """

    permission_list: list[str] = [
        permission
        for permission in ["owner", "view", "edit", "review"]
        if request.query_params.get(permission, "true").lower() == "true"
    ]

    if request.method == "GET":

        serialized_cases = ShareAssuranceCaseUtils.get_user_cases(
            request.user, permission_list
        )
        return JsonResponse(serialized_cases, safe=False)
    elif request.method == "POST":
        data = JSONParser().parse(request)
        data["owner"] = request.user.id
        return save_json_tree(data, "assurance_case")
    return None


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def case_image(request: HttpRequest, pk) -> Response:
    if request.method == "GET":
        try:
            assurance_case: AssuranceCaseImage = AssuranceCaseImage.objects.get(
                assurance_case_id=pk
            )
            image_serializer = AssuranceCaseImageSerializer(assurance_case)
            return Response(image_serializer.data, status=status.HTTP_200_OK)
        except AssuranceCaseImage.DoesNotExist:
            return Response(
                {"message": f"There's no image for assurance case {pk}"},
                status=status.HTTP_404_NOT_FOUND,
            )

    elif request.method == "POST":
        image_serializer = AssuranceCaseImageSerializer(
            data={
                "assurance_case_id": pk,
                "image": request.FILES.get("media"),
            },
            context={"request": request},
        )

        if image_serializer.is_valid():
            image_serializer.save()
            return Response(
                {
                    "message": "Image uploaded successfully.",
                    "data": image_serializer.data,
                },
                status=status.HTTP_200_OK,
            )

    return Response(
        {"message": "Bad request", "data": None}, status=status.HTTP_400_BAD_REQUEST
    )


@csrf_exempt
@api_view(["GET", "POST", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
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
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def case_sandbox(_: HttpRequest, pk: int) -> HttpResponse:
    try:
        assurance_case: AssuranceCase = AssuranceCase.objects.get(pk=pk)
        serialized_sandbox: ReturnDict = SandboxUtils.serialise_sandbox(assurance_case)
        return JsonResponse(serialized_sandbox)
    except AssuranceCase.DoesNotExist:
        return HttpResponse(status=404)


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def share_case_with(request: HttpRequest, pk: int) -> HttpResponse:
    assurance_case: AssuranceCase = AssuranceCase.objects.get(pk=pk)
    if assurance_case.owner != request.user:
        return HttpResponse(status=403)

    if request.method == "GET":
        case_users: dict = ShareAssuranceCaseUtils.get_case_permissions(assurance_case)
        return JsonResponse(case_users)
    elif request.method == "POST":

        serializer = ShareRequestSerializer(data=request.data, many=True)
        if not serializer.is_valid():
            return JsonResponse(
                {"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST
            )

        for permission_key in ["view", "edit", "review"]:
            additions, removals = ShareAssuranceCaseUtils.extract_requests(
                serializer, permission_key
            )

            ShareAssuranceCaseUtils.add_and_remove_permissions(
                permission_key=permission_key,
                assurance_case=assurance_case,
                add=additions,
                remove=removals,
            )

        return HttpResponse(status=200)

    return HttpResponse(status=400)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def case_update_identifiers(_, pk: int):
    try:
        assurance_case: AssuranceCase = AssuranceCase.objects.get(pk=pk)
        UpdateIdentifierUtils.update_identifiers(case_id=assurance_case.pk)

    except AssuranceCase.DoesNotExist:
        return HttpResponse(status=404)

    return HttpResponse(status=200)


@csrf_exempt
@permission_classes([IsAuthenticated])
def goal_list(request: HttpRequest) -> HttpResponse:
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
            model_instance: TopLevelNormativeGoal = cast(
                TopLevelNormativeGoal,
                serializer.save(),
            )

            serialised_model = TopLevelNormativeGoalSerializer(model_instance)
            return JsonResponse(serialised_model.data, status=201)

        return JsonResponse(serializer.errors, status=400)
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def goal_detail(request: HttpRequest, pk: int) -> HttpResponse:
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
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def context_list(request: HttpRequest) -> HttpResponse:
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
            model_instance: Context = cast(Context, serializer.save())

            serialised_model = ContextSerializer(model_instance)
            return JsonResponse(serialised_model.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def context_detail(request: HttpRequest, pk: int) -> HttpResponse:
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
    return HttpResponse(status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def detach_context(_: HttpRequest, pk: int) -> HttpResponse:

    try:
        SandboxUtils.detach_context(context_id=pk)

        return HttpResponse(status=200)
    except (Context.DoesNotExist, AssuranceCase.DoesNotExist):
        return HttpResponse(status=404)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attach_context(request: HttpRequest, pk: int) -> HttpResponse:

    try:
        SandboxUtils.attach_context(context_id=pk, goal_id=request.data["goal_id"])  # type: ignore[attr-defined]

    except (Context.DoesNotExist, TopLevelNormativeGoal.DoesNotExist):
        return HttpResponse(status=400)

    return HttpResponse(status=200)


@csrf_exempt
@permission_classes([IsAuthenticated])
def property_claim_list(request: HttpRequest) -> HttpResponse:
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
            model_instance: PropertyClaim = cast(PropertyClaim, serializer.save())

            serialised_model = PropertyClaimSerializer(model_instance)
            return JsonResponse(serialised_model.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def property_claim_detail(request: HttpRequest, pk: int) -> HttpResponse:
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
            model_instance: PropertyClaim = cast(PropertyClaim, serializer.save())

            data: dict = cast(
                dict,
                PropertyClaimSerializer(model_instance).data,
            )
            data["shape"] = shape

            return JsonResponse(data)
        return JsonResponse(serializer.errors, status=400)
    elif request.method == "DELETE":
        claim.delete()
        return HttpResponse(status=204)
    return HttpResponse(status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def detach_property_claim(request: HttpRequest, pk: int) -> HttpResponse:

    try:
        incoming_json: dict[str, Any] = request.data  # type: ignore[attr-defined]
        SandboxUtils.detach_property_claim(
            property_claim_id=pk, parent_info=incoming_json
        )
        return HttpResponse(status=200)
    except (
        PropertyClaim.DoesNotExist,
        TopLevelNormativeGoal.DoesNotExist,
        Strategy.DoesNotExist,
    ):
        return JsonResponse(
            {"error_message": "Could not locate case element."}, status=404
        )
    except ValueError as value_error:
        return JsonResponse({"error_message": str(value_error)}, status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attach_property_claim(request: HttpRequest, pk: int) -> HttpResponse:
    try:
        incoming_json: dict[str, Any] = request.data  # type: ignore[attr-defined]
        SandboxUtils.attach_property_claim(property_claim_id=pk, parent_info=incoming_json)  # type: ignore[attr-defined]

    except (
        PropertyClaim.DoesNotExist,
        TopLevelNormativeGoal.DoesNotExist,
        Strategy.DoesNotExist,
    ):
        return JsonResponse(
            {"error_message": "Could not locate case element."}, status=404
        )
    except ValueError as value_error:
        return JsonResponse({"error_message": str(value_error)}, status=400)

    return HttpResponse(status=200)


@csrf_exempt
@permission_classes([IsAuthenticated])
def evidence_list(request: HttpRequest) -> HttpResponse:
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
            model_instance: Evidence = cast(Evidence, serializer.save())

            serialised_model = EvidenceSerializer(model_instance)
            return JsonResponse(serialised_model.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def evidence_detail(request: HttpRequest, pk: int) -> HttpResponse:
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
    return HttpResponse(status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def detach_evidence(request: HttpRequest, pk: int) -> HttpResponse:
    try:
        SandboxUtils.detach_evidence(evidence_id=pk, property_claim_id=request.data["property_claim_id"])  # type: ignore[attr-defined]
        return HttpResponse(status=200)
    except (Evidence.DoesNotExist, AssuranceCase.DoesNotExist):
        return HttpResponse(status=404)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attach_evidence(request: HttpRequest, pk: int) -> HttpResponse:
    try:
        SandboxUtils.attach_evidence(evidence_id=pk, property_claim_id=request.data["property_claim_id"])  # type: ignore[attr-defined]

    except (Evidence.DoesNotExist, PropertyClaim.DoesNotExist):
        return HttpResponse(status=400)

    return HttpResponse(status=200)


@csrf_exempt
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
def strategies_list(request: HttpRequest) -> HttpResponse:
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
            model_instance: Strategy = cast(Strategy, serializer.save())

            serialised_model = StrategySerializer(model_instance)
            return JsonResponse(serialised_model.data, status=201)
        return JsonResponse(serializer.errors, status=400)
    return HttpResponse(status=400)


@csrf_exempt
@permission_classes([IsAuthenticated])
def strategy_detail(request: HttpRequest, pk: int) -> HttpResponse:
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
        return HttpResponse(status=204)
    return HttpResponse(status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def detach_strategy(_: HttpRequest, pk: int) -> HttpResponse:
    try:
        SandboxUtils.detach_strategy(strategy_id=pk)
        return HttpResponse(status=200)
    except (
        Strategy.DoesNotExist,
        TopLevelNormativeGoal.DoesNotExist,
    ):
        return JsonResponse(
            {"error_message": "Could not locate case element."}, status=404
        )
    except ValueError as value_error:
        return JsonResponse({"error_message": str(value_error)}, status=400)


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def attach_strategy(request: HttpRequest, pk: int):
    try:
        incoming_json: dict[str, Any] = request.data  # type: ignore[attr-defined]
        SandboxUtils.attach_strategy(strategy_id=pk, parent_info=incoming_json)  # type: ignore[attr-defined]

    except (
        TopLevelNormativeGoal.DoesNotExist,
        Strategy.DoesNotExist,
    ):
        return JsonResponse(
            {"error_message": "Could not locate case element."}, status=404
        )
    except ValueError as value_error:
        return JsonResponse({"error_message": str(value_error)}, status=400)

    return HttpResponse(status=200)


@api_view(["POST"])
@permission_classes([AllowAny])
@psa("")
def register_by_access_token(request: HttpRequest, backend: str):  # noqa: ARG001

    access_token: str = request.data.get("access_token")
    user_email: str = request.data.get("email")

    try:
        social_user: EAPUser = request.backend.do_auth(access_token)
        if not social_user.email:
            social_user.email = user_email

        eap_user: EAPUser = SocialAuthenticationUtils.register_social_user(
            social_user, backend
        )

        token, _ = Token.objects.get_or_create(user=eap_user)
        return JsonResponse({"key": token.key}, status=200)

    except AuthForbidden:
        return JsonResponse(
            {"error_message": "The provided access token is not valid."}, status=404
        )


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
@permission_classes([IsAuthenticated])
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
@permission_classes([IsAuthenticated])
def comment_list(request: HttpRequest, element_name: str, element_id: int):
    """
    List all comments for an case element, or create a new comment.
    """
    model_instance = CommentUtils.get_model_instance(element_name, element_id)
    assurance_case_id: int | None = None
    if isinstance(model_instance, AssuranceCase):
        assurance_case_id = model_instance.pk
    else:
        assurance_case_id = get_case_id(model_instance)

    permissions: str | None = get_case_permissions(
        cast(int, assurance_case_id), cast(EAPUser, request.user)
    )

    if permissions is None:
        return HttpResponse(status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        serializer = CommentSerializer(model_instance.comments, many=True)
        return Response(serializer.data)

    elif request.method == "POST":
        if permissions not in ["manage", "edit", "review"]:
            return HttpResponse(status=status.HTTP_403_FORBIDDEN)
        data = request.data.copy()
        serializer = CommentSerializer(data=data)
        if serializer.is_valid():
            # Ensure the author is set to the current user
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def comment_detail(request, pk):
    """
    Retrieve, update or delete a specific comment.
    """

    try:
        comment = Comment.objects.get(id=pk, author=request.user)
    except Comment.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = CommentSerializer(comment)
        return Response(serializer.data)

    elif request.method == "PUT":
        serializer = CommentSerializer(comment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == "DELETE":
        comment.delete()
        return HttpResponse(status=204)

    return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
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
        data["author"] = request.user.id  # Ensure the author is set to the current user
        data["assurance_case"] = parent_comment.assurance_case_id
        serializer = CommentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=status.HTTP_201_CREATED)
        return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return JsonResponse(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# class CaseStudyViewSet(viewsets.ModelViewSet):
#     queryset = CaseStudy.objects.all()
#     serializer_class = CaseStudySerializer
#     renderer_classes = [JSONRenderer]  # Ensures JSON output

# # class CaseStudyViewSet(viewsets.ModelViewSet):
# #     queryset = CaseStudy.objects.all()
# #     serializer_class = CaseStudySerializer
# #     renderer_classes = [JSONRenderer]  # Ensures JSON output
# #     # permission_classes = [AllowAny]  # Allow access to everyone

# #     def get_queryset(self):
# #         """
# #         Optionally restricts the returned case studies to those that are published
# #         by filtering against a `published` query parameter in the URL.
# #         """
# #         queryset = CaseStudy.objects.all()  # Default queryset
# #         published = self.request.query_params.get('published', None)  # Get the published query param

# #         if published is not None:
# #             # Convert to boolean (if passed as 'true' or 'false' in the query string)
# #             published = published.lower() in ['true', '1', 't', 'y', 'yes']
# #             queryset = queryset.filter(published=published)

# #         return queryset

# @csrf_exempt
# @api_view(["GET", "POST"])
# @permission_classes([IsAuthenticated])
# def case_study_list(request):
#     """
#     List all case studies, or create a new case study
#     """
#     if request.method == "GET":
#         case_studies = CaseStudy.objects.filter(owner=request.user)  # Ensure only user-owned case studies are returned
#         serializer = CaseStudySerializer(case_studies, many=True)
#         return JsonResponse(serializer.data, safe=False)
    
#     elif request.method == "POST":
#         data = JSONParser().parse(request)
#         serializer = CaseStudySerializer(data=data)
#         if serializer.is_valid():
#             serializer.save(owner=request.user)  # Assign the authenticated user as the owner
#             serializer.save()
#             return JsonResponse(serializer.data, status=201)
#         return JsonResponse(serializer.errors, status=400)

@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def case_study_list(request):
    """
    List all case studies, or create a new case study
    """
    if request.method == "GET":
        case_studies = CaseStudy.objects.filter(owner=request.user)  # Ensure only user-owned case studies are returned
        serializer = CaseStudySerializer(case_studies, many=True)
        return JsonResponse(serializer.data, safe=False)
    
    elif request.method == "POST":
        # Use multipart/form-data parsers
        if request.content_type == 'multipart/form-data':
            request.parsers = [MultiPartParser(), FormParser()]
        
        # `request.data` already handles both form fields and files
        serializer = CaseStudySerializer(data=request.data)
        
        if serializer.is_valid():
            # Save the instance and assign the authenticated user as the owner
            serializer.save(owner=request.user)
            return JsonResponse(serializer.data, status=201)
        
        return JsonResponse(serializer.errors, status=400)



# @csrf_exempt
# @api_view(["GET", "PUT", "DELETE"])
# @permission_classes([IsAuthenticated])
# def case_study_detail(request, pk):
#     """
#     Retrieve, update, or delete a CaseStudy instance by primary key
#     """
#     try:
#         case_study = CaseStudy.objects.get(pk=pk)
#     except CaseStudy.DoesNotExist:
#         return HttpResponse(status=404)

#     if request.method == "GET":
#         serializer = CaseStudySerializer(case_study)
#         return JsonResponse(serializer.data)

#     elif request.method == "PUT":
#         data = JSONParser().parse(request)
#         serializer = CaseStudySerializer(case_study, data=data, partial=True)
#         if serializer.is_valid():
#             serializer.save()
#             return JsonResponse(serializer.data)
#         return JsonResponse(serializer.errors, status=400)

#     elif request.method == "DELETE":
#         case_study.delete()
#         return HttpResponse(status=204)


@csrf_exempt
@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def case_study_detail(request, pk):
    """
    Retrieve, update, or delete a CaseStudy instance by primary key
    """
    try:
        case_study = CaseStudy.objects.get(pk=pk)
    except CaseStudy.DoesNotExist:
        return HttpResponse(status=404)

    if request.method == "GET":
        serializer = CaseStudySerializer(case_study)
        return JsonResponse(serializer.data)

    elif request.method == "PUT":
        # Use MultiPartParser and FormParser to handle multipart/form-data
        if request.content_type == 'multipart/form-data':
            request.parsers = [MultiPartParser(), FormParser()]  # No need for JSONParser here

        # Create a mutable copy of request.data
        data = request.data.copy()  # This makes request.data mutable

        published = data.get('published')

        # Add logic here for saving a published version of the linked assurance cases

        assurance_cases_raw = data.get('assurance_cases', '[]')  # Default to '[]' if missing

        # Ensure it is parsed correctly
        try:
            assurance_cases_list = json.loads(assurance_cases_raw)
            print("JSON parsed assurance_cases_list:", assurance_cases_list)
        except json.JSONDecodeError as e:
            print("JSON parsing error:", e)
            return JsonResponse({"error": "Invalid JSON format for assurance_cases"}, status=400)

        if not isinstance(assurance_cases_list, list):
            print('Error: Should be a list of ids, but got:', type(assurance_cases_list))
            return JsonResponse({"error": "assurance_cases should be a list of IDs"}, status=400)

        if not all(isinstance(item, int) for item in assurance_cases_list):
            print('Error: Should be a list of integers, but got:', assurance_cases_list)
            return JsonResponse({"error": "assurance_cases should only contain integers (IDs)"}, status=400)

        # Set assurance_cases to the parsed list directly
        data.setlist('assurance_cases', assurance_cases_list)  # Ensure it's treated as a list in QueryDict

        # Pass the updated data to the serializer
        serializer = CaseStudySerializer(case_study, data=data, partial=True)

        if serializer.is_valid():

            if published:
                for assurance_case_id in assurance_cases_list:
                    try:
                        assurance_case = AssuranceCase.objects.get(id=assurance_case_id)
                    except AssuranceCase.DoesNotExist:
                        continue  # Skip if the assurance case doesn't exist

                    # Get full assurance case details using the same logic as `case_detail()`
                    assurance_case_serializer = AssuranceCaseSerializer(assurance_case)
                    case_data = assurance_case_serializer.data
                    case_data["goals"] = get_json_tree(case_data["goals"], "goals")  # Apply your existing goal tree logic

                    # Create a snapshot
                    PublishedAssuranceCase.objects.create(
                        assurance_case=assurance_case,
                        case_study=case_study,
                        title=assurance_case.name,
                        content=case_data  # Store full assurance case details as JSON
                    )

            serializer.save()
            return JsonResponse(serializer.data)
        else:
            # If the serializer is not valid, print and return the errors
            print(f"Serializer errors: {serializer.errors}")
            return JsonResponse(serializer.errors, status=400)

    elif request.method == "DELETE":
        case_study.delete()
        return HttpResponse(status=204)

# @csrf_exempt
# @api_view(["GET", "PUT", "DELETE"])
# @permission_classes([IsAuthenticated])
# def case_study_detail(request, pk):
#     """
#     Retrieve, update, or delete a CaseStudy instance by primary key
#     """
#     try:
#         case_study = CaseStudy.objects.get(pk=pk)
#     except CaseStudy.DoesNotExist:
#         return HttpResponse(status=404)

#     if request.method == "GET":
#         serializer = CaseStudySerializer(case_study)
#         return JsonResponse(serializer.data)

#     elif request.method == "PUT":
#         if request.content_type == "multipart/form-data":
#             request.parsers = [MultiPartParser(), FormParser()]

#         data = request.data.copy()

#         published = data.get("published")
#         if published is not None:
#             published = published.lower() == "true"  # Convert to boolean
#             case_study.published = published

#         # Handle assurance cases
#         assurance_cases_raw = data.get("assurance_cases", "[]")

#         try:
#             assurance_cases_list = json.loads(assurance_cases_raw)
#         except json.JSONDecodeError:
#             return JsonResponse({"error": "Invalid JSON format for assurance_cases"}, status=400)

#         if not isinstance(assurance_cases_list, list) or not all(isinstance(i, int) for i in assurance_cases_list):
#             return JsonResponse({"error": "assurance_cases should be a list of integer IDs"}, status=400)

#         # If publishing, fetch full assurance case details and store a snapshot
#         if published:
#             for assurance_case_id in assurance_cases_list:
#                 try:
#                     assurance_case = AssuranceCase.objects.get(id=assurance_case_id)
#                 except AssuranceCase.DoesNotExist:
#                     continue  # Skip if the assurance case doesn't exist

#                 # Get full assurance case details using the same logic as `case_detail()`
#                 assurance_case_serializer = AssuranceCaseSerializer(assurance_case)
#                 case_data = assurance_case_serializer.data
#                 case_data["goals"] = get_json_tree(case_data["goals"], "goals")  # Apply your existing goal tree logic

#                 # Create a snapshot
#                 PublishedAssuranceCase.objects.create(
#                     assurance_case=assurance_case,
#                     case_study=case_study,
#                     title=assurance_case.name,
#                     content=case_data  # Store full assurance case details as JSON
#                 )

#         case_study.save()
#         return JsonResponse({"message": "Updated successfully", "published": case_study.published}, status=200)

#     elif request.method == "DELETE":
#         case_study.delete()
#         return HttpResponse(status=204)

 
@csrf_exempt
@api_view(["GET"])
def public_case_study_list(request):
    """
    List all publicly available case studies (published = True)
    """
    case_studies = CaseStudy.objects.filter(published=True)
    # serializer = CaseStudySerializer(case_studies, many=True)
    serializer = CaseStudySerializer(case_studies, many=True, context={"request": request})  # Pass request context
    return JsonResponse(serializer.data, safe=False)


@csrf_exempt
@api_view(["GET"])
def public_case_study_detail(request, pk):
    """
    Retrieve a publicly available CaseStudy instance by primary key if it's published.
    """
    try:
        case_study = CaseStudy.objects.get(pk=pk, published=True)
    except CaseStudy.DoesNotExist:
        return HttpResponse(status=404)

    # serializer = CaseStudySerializer(case_study)
    serializer = CaseStudySerializer(case_study, context={"request": request})
    return JsonResponse(serializer.data)


@csrf_exempt
@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def case_study_feature_image(request: HttpRequest, pk) -> Response:
    if request.method == "GET":
        try:
            feature_image = CaseStudyFeatureImage.objects.get(case_study_id=pk)
            image_serializer = CaseStudyFeatureImageSerializer(feature_image)
            return Response(image_serializer.data, status=status.HTTP_200_OK)
        except CaseStudyFeatureImage.DoesNotExist:
            return Response(
                {"message": f"No feature image found for case study {pk}"},
                status=status.HTTP_404_NOT_FOUND,
            )

    elif request.method == "POST":
        image_serializer = CaseStudyFeatureImageSerializer(
            data={
                "case_study_id": pk,
                "image": request.FILES.get("media"),
            },
            context={"request": request},
        )

        if image_serializer.is_valid():
            image_serializer.save()
            return Response(
                {
                    "message": "Feature image uploaded successfully.",
                    "data": image_serializer.data,
                },
                status=status.HTTP_200_OK,
            )

    elif request.method == "DELETE":
        try:
            feature_image = CaseStudyFeatureImage.objects.get(case_study_id=pk)
            feature_image.delete()
            return Response(
                {"message": f"Feature image for case study {pk} deleted successfully."},
                status=status.HTTP_204_NO_CONTENT,
            )
        except CaseStudyFeatureImage.DoesNotExist:
            return Response(
                {"message": f"No feature image found for case study {pk}"},
                status=status.HTTP_404_NOT_FOUND,
            )

    return Response(
        {"message": "Bad request", "data": None}, status=status.HTTP_400_BAD_REQUEST
    )


@csrf_exempt
@api_view(["GET"])
def published_assurance_case_detail(request, id):
    """
    Retrieve all PublishedAssuranceCases linked to a specific AssuranceCase ID.
    """
    published_assurance_cases = PublishedAssuranceCase.objects.filter(assurance_case=id)

    if not published_assurance_cases.exists():
        return HttpResponse(status=404)

    serializer = PublishedAssuranceCaseSerializer(published_assurance_cases, many=True)  # Use many=True for multiple results
    return JsonResponse(serializer.data, safe=False)  # Allow lists in JSON response
