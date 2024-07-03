import json
from datetime import datetime

from django.http import HttpResponse
from django.test import Client, TestCase
from django.urls import reverse
from eap_api.models import (
    AssuranceCase,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    PropertyClaim,
    Strategy,
    TopLevelNormativeGoal,
)
from eap_api.serializers import (
    AssuranceCaseSerializer,
    ContextSerializer,
    EAPGroupSerializer,
    EAPUserSerializer,
    EvidenceSerializer,
    PropertyClaimSerializer,
    TopLevelNormativeGoalSerializer,
)
from eap_api.view_utils import SandboxUtils
from eap_api.views import make_case_summary, make_summary
from rest_framework.authtoken.models import Token

from .constants_tests import (
    CASE1_INFO,
    CONTEXT_INFO,
    # for many-to-many relations, need to NOT have
    EVIDENCE1_INFO_NO_ID,
    EVIDENCE2_INFO_NO_ID,
    GOAL_INFO,
    GROUP1_INFO,
    PROPERTYCLAIM1_INFO,
    PROPERTYCLAIM2_INFO,
    STRATEGY_INFO,
    USER1_INFO,
)


class CaseViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.assurance_case: AssuranceCase = AssuranceCase.objects.create(**CASE1_INFO)
        self.update = {
            "name": "TestAC_updated",
            "description": "description is updated",
        }
        # get data from DB
        self.data = AssuranceCase.objects.all()
        # convert it to JSON
        self.serializer = AssuranceCaseSerializer(self.data, many=True)

    def test_case_list_view_post(self):
        post_data = {
            "name": "newCASE",
            "description": "new description",
            "lock_uuid": None,
            "color_profile": "default",
        }
        response_post = self.client.post(
            reverse("case_list"),
            data=json.dumps(post_data),
            content_type="application/json",
        )
        assert response_post.status_code == 201
        assert response_post.json()["name"] == post_data["name"]
        # check we now have two cases in the db
        response_get = self.client.get(reverse("case_list"))
        assert len(response_get.json()) == 2

    def test_case_list_view_get(self):
        response_get = self.client.get(reverse("case_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_case_summary(self.serializer.data)

    def test_case_detail_view_get(self):
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.assurance_case.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()

        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]

    def test_view_case_sandbox(self):
        TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        context: Context = Context.objects.create(**CONTEXT_INFO)
        response_get: HttpResponse = self.client.get(
            reverse("case_sandbox", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()
        assert response_data == {"contexts": []}

        SandboxUtils.detach_context(context.pk)

        response_get: HttpResponse = self.client.get(
            reverse("case_sandbox", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()

        assert len(response_data["contexts"]) == 1
        assert response_data["contexts"][0]["id"] == context.pk
        assert response_data["contexts"][0]["in_sandbox"]

    def test_view_case_without_detached_items(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        context: Context = Context.objects.create(
            goal=None, assurance_case=self.assurance_case, name="C1"
        )

        SandboxUtils.attach_context(context_id=context.pk, goal_id=goal.pk)

        # Testing with attachment response
        response_get: HttpResponse = self.client.get(
            reverse("case_detail", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()

        goals_from_response: list = response_data["goals"]
        assert len(goals_from_response) == 1
        assert goals_from_response[0]["id"] == goal.pk

        contexts_from_response: list = goals_from_response[0]["context"]
        assert len(contexts_from_response) == 1
        assert contexts_from_response[0]["id"] == context.pk

        # Testing after detachment

        SandboxUtils.detach_context(context.pk)

        response_get: HttpResponse = self.client.get(
            reverse("case_detail", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()
        goals_from_response: list = response_data["goals"]
        assert len(goals_from_response) == 1
        assert goals_from_response[0]["id"] == goal.pk

        contexts_from_response: list = goals_from_response[0]["context"]
        assert len(contexts_from_response) == 0

    def test_case_detail_view_put(self):
        response_put = self.client.put(
            reverse("case_detail", kwargs={"pk": self.assurance_case.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_case_delete_with_standard_permission(self):
        url = reverse("case_detail", kwargs={"pk": self.assurance_case.pk})
        self.client.delete(url)

        response_get = self.client.get(reverse("case_list"))
        assert len(response_get.json()) == 0

    def test_identifier_update_follows_order(self):
        number_of_strategies: int = 3

        top_level_goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(
            **GOAL_INFO
        )

        strategies_in_order: list[Strategy] = []
        for _ in range(number_of_strategies):
            strategies_in_order.append(
                Strategy.objects.create(
                    name="",
                    short_description="Strategy for The Goal",
                    long_description="A longer description of the strategy",
                    goal_id=top_level_goal.pk,
                )
            )

        response_post: HttpResponse = self.client.post(
            reverse("update_identifiers", kwargs={"pk": self.assurance_case.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        for index, strategy in enumerate(strategies_in_order):
            strategy.refresh_from_db()
            assert strategy.name == f"S{index + 1}"

    def test_identifier_update_on_subclaims(self):

        TopLevelNormativeGoal.objects.create(**GOAL_INFO)

        parent_property_claim: PropertyClaim = PropertyClaim.objects.create(
            **PROPERTYCLAIM1_INFO
        )
        child_property_claim: PropertyClaim = PropertyClaim.objects.create(
            **PROPERTYCLAIM2_INFO
        )
        child_property_claim.goal = None
        child_property_claim.property_claim = parent_property_claim
        child_property_claim.save()

        post_response: HttpResponse = self.client.post(
            reverse("update_identifiers", kwargs={"pk": self.assurance_case.pk}),
            content_type="application/json",
        )

        assert post_response.status_code == 200

        parent_property_claim.refresh_from_db()
        assert parent_property_claim.name == "P1"

        child_property_claim.refresh_from_db()
        assert child_property_claim.name == "P1.1"

    def test_goal_identifier_after_update(self):

        goal_created: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(
            **GOAL_INFO
        )

        response_post: HttpResponse = self.client.post(
            reverse("update_identifiers", kwargs={"pk": self.assurance_case.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        goal_created.refresh_from_db()

        assert goal_created.name == "G1"


class GoalViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.update = {
            "name": "TestGoal_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = TopLevelNormativeGoal.objects.all()
        # convert it to JSON
        self.serializer = TopLevelNormativeGoalSerializer(self.data, many=True)

    def test_create_goal_with_post(self):

        self.goal.delete()

        response_post: HttpResponse = self.client.post(
            reverse("goal_list"),
            data=json.dumps(GOAL_INFO),
            content_type="application/json",
        )

        goals_created: list[TopLevelNormativeGoal] = list(
            TopLevelNormativeGoal.objects.all()
        )
        assert len(goals_created) == 1
        current_goal: TopLevelNormativeGoal = goals_created[0]

        json_response: dict = response_post.json()

        assert current_goal.pk == json_response["id"]
        assert json_response["type"] == "TopLevelNormativeGoal"
        assert current_goal.name == json_response["name"]
        assert current_goal.short_description == json_response["short_description"]
        assert current_goal.long_description == json_response["long_description"]
        assert current_goal.keywords == json_response["keywords"]
        assert current_goal.assurance_case.pk == json_response["assurance_case_id"]

        assert json_response["context"] == []
        assert json_response["property_claims"] == []
        assert json_response["strategies"] == []

    def test_goal_list_view_get(self):
        response_get = self.client.get(reverse("goal_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_summary(self.serializer.data)

    def test_goal_detail_view_get(self):
        response_get = self.client.get(
            reverse("goal_detail", kwargs={"pk": self.goal.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]

    def test_goal_detail_view_put(self):
        response_put = self.client.put(
            reverse("goal_detail", kwargs={"pk": self.goal.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_goal_delete_with_standard_permission(self):
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("goal_list"))
        assert len(response_get.json()) == 0


class StrategyViewTest(TestCase):
    def setUp(self):
        self.assurance_case: AssuranceCase = AssuranceCase.objects.create(**CASE1_INFO)

        self.goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(
            **GOAL_INFO
        )

    def test_create_strategy_with_post(self):

        response_post: HttpResponse = self.client.post(
            reverse("strategies_list"),
            data=json.dumps(STRATEGY_INFO),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        strategies_created: list[Strategy] = list(Strategy.objects.all())
        assert len(strategies_created) == 1

        current_strategy: Strategy = strategies_created[0]
        json_response: dict = response_post.json()

        assert json_response["id"] == current_strategy.pk
        assert json_response["type"] == "Strategy"

        assert json_response["name"] == STRATEGY_INFO["name"]
        assert json_response["short_description"] == STRATEGY_INFO["short_description"]
        assert json_response["long_description"] == STRATEGY_INFO["long_description"]
        assert json_response["goal_id"] == self.goal.pk
        assert json_response["property_claims"] == []

    def test_retrieve_strategy_with_get(self):

        strategy: Strategy = Strategy.objects.create(**STRATEGY_INFO)

        response_get: HttpResponse = self.client.get(
            reverse("strategy_detail", kwargs={"pk": strategy.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()

        assert response_data["id"] == strategy.pk
        assert response_data["type"] == "Strategy"

        assert response_data["name"] == STRATEGY_INFO["name"]
        assert response_data["short_description"] == STRATEGY_INFO["short_description"]
        assert response_data["long_description"] == STRATEGY_INFO["long_description"]
        assert response_data["goal_id"] == self.goal.pk
        assert response_data["property_claims"] == []


class ContextViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.context = Context.objects.create(**CONTEXT_INFO)
        self.update = {
            "name": "TestContext_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = Context.objects.all()
        # convert it to JSON
        self.serializer = ContextSerializer(self.data, many=True)

    def test_detach_context(self):
        path: str = reverse("detach_context", kwargs={"pk": self.context.pk})
        response_get: HttpResponse = self.client.get(
            path,
            content_type="application/json",
        )

        assert response_get.status_code == 405

        response_post: HttpResponse = self.client.post(
            path,
            content_type="application/json",
        )

        assert response_post.status_code == 200

        self.context.refresh_from_db()

        assert self.context.in_sandbox
        assert self.context.assurance_case == self.case
        assert self.context.goal is None

    def test_attach_context(self):
        detached_context: Context = Context.objects.create(
            goal=None,
            assurance_case=self.case,
        )

        response_post: HttpResponse = self.client.post(
            reverse("attach_context", kwargs={"pk": detached_context.pk}),
            data=json.dumps({"goal_id": self.goal.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        detached_context.refresh_from_db()

        assert detached_context.goal == TopLevelNormativeGoal.objects.get(
            pk=self.goal.pk
        )

        assert detached_context.assurance_case is None
        assert not detached_context.in_sandbox

    def test_create_context_with_post(self):
        self.context.delete()

        response_post: HttpResponse = self.client.post(
            reverse("context_list"),
            data=json.dumps(CONTEXT_INFO),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        context_created: Context = Context.objects.get(name=CONTEXT_INFO["name"])
        json_response = response_post.json()

        assert json_response["id"] == context_created.pk
        assert json_response["type"] == "Context"
        assert json_response["name"] == CONTEXT_INFO["name"]
        assert json_response["short_description"] == CONTEXT_INFO["short_description"]
        assert json_response["long_description"] == CONTEXT_INFO["long_description"]
        assert (
            datetime.strptime(json_response["created_date"], "%Y-%m-%dT%H:%M:%S.%f%z")
            == context_created.created_date
        )
        assert json_response["goal_id"] == CONTEXT_INFO["goal_id"]

    def test_context_list_view_get(self):
        response_get = self.client.get(reverse("context_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_summary(self.serializer.data)

    def test_context_detail_view_get(self):
        response_get = self.client.get(
            reverse("context_detail", kwargs={"pk": self.context.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]

    def test_context_detail_view_put(self):
        response_put = self.client.put(
            reverse("context_detail", kwargs={"pk": self.context.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_context_delete_with_standard_permission(self):
        url = reverse("context_detail", kwargs={"pk": self.context.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("context_list"))
        assert len(response_get.json()) == 0


class PropertyClaimViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.pclaim1 = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        self.pclaim2 = PropertyClaim.objects.create(**PROPERTYCLAIM2_INFO)
        self.update = {
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = PropertyClaim.objects.all()
        # convert it to JSON
        self.serializer = PropertyClaimSerializer(self.data, many=True)

    def test_property_claim_list_view_get(self):
        response_get = self.client.get(reverse("property_claim_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_summary(self.serializer.data)
        assert len(response_get.json()) == 2

    def test_property_claim_detail_view_get(self):
        response_get = self.client.get(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]
        response_get = self.client.get(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim2.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[1]
        assert response_data["name"] == serializer_data["name"]

    def test_property_claim_detail_view_put(self):
        response_put = self.client.put(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert (
            response_put.json()["short_description"] == self.update["short_description"]
        )

    def test_create_property_claim_with_post(self):

        self.pclaim1.delete()

        response_post: HttpResponse = self.client.post(
            reverse("property_claim_list"),
            data=json.dumps(PROPERTYCLAIM1_INFO),
            content_type="application/json",
        )

        property_claim_created: list[PropertyClaim] = list(
            PropertyClaim.objects.filter(name=PROPERTYCLAIM1_INFO["name"])
        )

        assert len(property_claim_created) == 1
        current_property_claim: PropertyClaim = property_claim_created[0]

        json_response = response_post.json()

        assert json_response["id"] == current_property_claim.pk
        assert json_response["type"] == "PropertyClaim"
        assert json_response["name"] == PROPERTYCLAIM1_INFO["name"]
        assert (
            json_response["short_description"]
            == PROPERTYCLAIM1_INFO["short_description"]
        )
        assert (
            json_response["long_description"] == PROPERTYCLAIM1_INFO["long_description"]
        )

        assert json_response["goal_id"] == PROPERTYCLAIM1_INFO["goal_id"]
        assert json_response["property_claim_id"] is None
        assert json_response["level"] == 1
        assert json_response["claim_type"] == "Project claim"
        assert json_response["property_claims"] == []
        assert json_response["evidence"] == []
        assert json_response["strategy_id"] is None

    def test_property_claim_delete_with_standard_permission(self):
        url = reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("property_claim_list"))
        assert len(response_get.json()) == 1


class EvidenceViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)

        self.evidence1 = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        self.evidence1.save()
        self.evidence1.property_claim.set([self.pclaim])
        self.evidence2 = Evidence.objects.create(**EVIDENCE2_INFO_NO_ID)
        self.evidence2.save()
        self.evidence2.property_claim.set([self.pclaim])

        self.update = {
            "name": "Evidence_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = Evidence.objects.all()
        # convert it to JSON
        self.serializer = EvidenceSerializer(self.data, many=True)

    def test_create_evidence_with_post(self):

        self.evidence1.delete()

        response_post: HttpResponse = self.client.post(
            reverse("evidence_list"),
            data=json.dumps(
                EVIDENCE1_INFO_NO_ID | {"property_claim_id": [self.pclaim.pk]}
            ),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        evidence_created: Evidence = Evidence.objects.get(
            name=EVIDENCE1_INFO_NO_ID["name"]
        )
        json_response = response_post.json()

        assert json_response["id"] == evidence_created.pk
        assert json_response["type"] == "Evidence"
        assert json_response["name"] == EVIDENCE1_INFO_NO_ID["name"]
        assert (
            json_response["short_description"]
            == EVIDENCE1_INFO_NO_ID["short_description"]
        )
        assert (
            json_response["long_description"]
            == EVIDENCE1_INFO_NO_ID["long_description"]
        )

        assert json_response["URL"] == EVIDENCE1_INFO_NO_ID["URL"]
        assert json_response["property_claim_id"] == [self.pclaim.pk]

    def test_evidence_list_view_get(self):
        response_get = self.client.get(reverse("evidence_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_summary(self.serializer.data)
        assert len(response_get.json()) == 2

    def test_evidence_detail_view_get(self):
        response_get = self.client.get(
            reverse("evidence_detail", kwargs={"pk": self.evidence1.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]
        response_get = self.client.get(
            reverse("evidence_detail", kwargs={"pk": self.evidence2.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[1]
        assert response_data["name"] == serializer_data["name"]

    def test_evidence_detail_view_put(self):
        response_put = self.client.put(
            reverse("evidence_detail", kwargs={"pk": self.evidence1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_evidence_delete_with_standard_permission(self):
        url = reverse("evidence_detail", kwargs={"pk": self.evidence1.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("evidence_list"))
        assert len(response_get.json()) == 1


class FullCaseDetailViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.context = Context.objects.create(**CONTEXT_INFO)
        self.pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)

        self.evidence1 = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        self.evidence1.save()
        self.evidence2 = Evidence.objects.create(**EVIDENCE2_INFO_NO_ID)
        self.evidence2.save()

        # get data from DB
        self.data = AssuranceCase.objects.all()
        # convert it to JSON
        self.serializer = AssuranceCaseSerializer(self.data, many=True)

    def test_full_case_detail_view_get(self):
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.case.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.case.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]
        # check we can go down the whole tree
        assert len(response_data["goals"]) == 1
        assert len(response_data["goals"][0]["context"]) == 1
        assert len(response_data["goals"][0]["property_claims"]) == 1


class UserViewNoAuthTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.user = EAPUser.objects.create(**USER1_INFO)
        self.update = {
            "username": "user1_updated",
            "password": "password is updated",
        }
        # get data from DB
        self.data = EAPUser.objects.all()
        # convert it to JSON
        self.serializer = EAPUserSerializer(self.data, many=True)

    def test_user_list_view_post(self):
        post_data = {
            "username": "newUser",
            "email": "user@new.com",
            "password": "paS5w0rd",
        }
        response_post = self.client.post(
            reverse("user_list"),
            data=json.dumps(post_data),
            content_type="application/json",
        )
        assert response_post.status_code == 201
        assert response_post.json()["username"] == post_data["username"]
        # check we now have two cases in the db
        response_get = self.client.get(reverse("user_list"))
        assert len(response_get.json()) == 2

    def test_user_list_view_get(self):
        response_get = self.client.get(reverse("user_list"))
        assert response_get.status_code == 200
        assert response_get.json() == self.serializer.data
        assert len(response_get.json()) == 1

    def test_user_detail_view_get(self):
        # Shouldn't be able to do this without being logged in!
        response_get = self.client.get(
            reverse("user_detail", kwargs={"pk": self.user.pk})
        )
        assert response_get.status_code == 403

    def test_user_detail_view_put(self):
        # Shouldn't be able to do this without being logged in!
        response_get = self.client.put(
            reverse("user_detail", kwargs={"pk": self.user.pk})
        )
        assert response_get.status_code == 403

    def test_user_detail_view_delete(self):
        # Shouldn't be able to do this without being logged in!
        response_get = self.client.delete(
            reverse("user_detail", kwargs={"pk": self.user.pk})
        )
        assert response_get.status_code == 403


class UserDetailViewWithAuthTest(TestCase):
    def setUp(self):
        # login
        user = EAPUser.objects.create(**USER1_INFO)
        token, created = Token.objects.get_or_create(user=user)
        key = token.key
        self.headers = {"HTTP_AUTHORIZATION": f"Token {key}"}
        self.update = {
            "username": "user1_updated",
            "password": "password is updated",
        }

    def test_user_detail_view_get(self):
        client = Client(**self.headers)
        response_get = client.get(
            reverse("user_detail", kwargs={"pk": 1}), headers=self.headers
        )
        assert response_get.status_code == 200
        response_json = response_get.json()
        assert response_json["username"] == USER1_INFO["username"]

    def test_user_detail_view_put(self):
        client = Client(**self.headers)
        response_put = client.put(
            reverse("user_detail", kwargs={"pk": 1}),
            headers=self.headers,
            data=json.dumps(self.update),
        )
        assert response_put.status_code == 200
        response_json = response_put.json()
        assert response_json["username"] == self.update["username"]

    def test_user_detail_view_delete(self):
        client = Client(**self.headers)
        response_delete = client.delete(
            reverse("user_detail", kwargs={"pk": 1}),
            headers=self.headers,
        )
        assert response_delete.status_code == 204
        assert len(EAPUser.objects.all()) == 0


class GroupViewNoAuthTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        user = EAPUser.objects.create(**USER1_INFO)
        user.save()
        self.group = EAPGroup.objects.create(**GROUP1_INFO, owner_id=user.id)
        self.update = {
            "name": "group1_updated",
        }
        # get data from DB
        self.data = EAPGroup.objects.all()
        # convert it to JSON
        self.serializer = EAPGroupSerializer(self.data, many=True)

    def test_group_list_view_post(self):
        post_data = {
            "name": "newGroup",
        }
        response_post = self.client.post(
            reverse("group_list"),
            data=json.dumps(post_data),
            content_type="application/json",
        )
        # shouldn't be possible - no logged in user to assign as owner
        assert response_post.status_code == 400

    def test_group_list_view_get(self):
        response_get = self.client.get(
            reverse("group_list"),
            content_type="application/json",
        )
        # should get a status code 200, and dict with 2 empty lists
        assert response_get.status_code == 200
        response_json = response_get.json()
        assert isinstance(response_json, dict)
        assert {"owner", "member"} == set(response_json.keys())
        assert len(response_json["owner"]) == 0
        assert len(response_json["member"]) == 0

    def test_group_detail_view_get(self):
        response_get = self.client.get(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
        )
        # shouldn't be allowed
        assert response_get.status_code == 403

    def test_group_detail_view_put(self):
        response_put = self.client.put(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
            data=json.dumps(self.update),
        )
        # shouldn't be allowed
        assert response_put.status_code == 403

    def test_group_detail_view_delete(self):
        response_delete = self.client.delete(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
        )
        # shouldn't be allowed
        assert response_delete.status_code == 403


class GroupViewWithAuthTest(TestCase):
    def setUp(self):
        # login user1
        user = EAPUser.objects.create(**USER1_INFO)
        user.save()
        self.group = EAPGroup.objects.create(**GROUP1_INFO, owner_id=user.id)
        self.group.member.set([user.id])
        token, created = Token.objects.get_or_create(user=user)
        key = token.key
        headers = {"HTTP_AUTHORIZATION": f"Token {key}"}
        # replace the client with the logged-in one.
        self.client = Client(**headers)
        self.post_data = {"name": "AnotherNewGroup"}
        self.update = {
            "name": "group1_updated",
        }

    def test_group_list_view_get(self):
        response_get = self.client.get(
            reverse("group_list"),
            content_type="application/json",
        )
        # should get a status code 200, and dict with 2 NON-empty lists
        assert response_get.status_code == 200
        response_json = response_get.json()
        assert isinstance(response_json, dict)
        assert {"owner", "member"} == set(response_json.keys())
        assert len(response_json["owner"]) == 1
        assert len(response_json["member"]) == 1

    def test_group_list_view_post(self):
        response_post = self.client.post(
            reverse("group_list"),
            data=json.dumps(self.post_data),
            content_type="application/json",
        )
        assert response_post.status_code == 201
        response_json = response_post.json()
        assert response_json["name"] == self.post_data["name"]

    def test_group_detail_view_get(self):
        response_get = self.client.get(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
        )
        assert response_get.status_code == 200
        response_json = response_get.json()
        assert response_json["name"] == GROUP1_INFO["name"]
        assert response_json["members"], list
        assert len(response_json["members"]) == 1
        assert response_json["members"][0] == 1

    def test_group_detail_view_put(self):
        response_put = self.client.put(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
            data=json.dumps(self.update),
        )
        assert response_put.status_code == 200
        response_json = response_put.json()
        assert response_json["name"] == self.update["name"]

    def test_group_detail_view_delete(self):
        response_delete = self.client.delete(
            reverse("group_detail", kwargs={"pk": 1}),
            content_type="application/json",
        )
        assert response_delete.status_code == 204
        assert len(EAPGroup.objects.all()) == 0
