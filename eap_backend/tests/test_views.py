import json
from datetime import datetime
from typing import Any

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

    def test_sandbox_with_claim_and_evidence(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        property_claim: PropertyClaim = PropertyClaim.objects.create(
            name="P1", goal=goal
        )

        evidence: Evidence = Evidence.objects.create(name="E1")
        evidence.property_claim.add(property_claim)

        SandboxUtils.detach_property_claim(property_claim.pk, {"goal_id": goal.pk})

        response_get: HttpResponse = self.client.get(
            reverse("case_sandbox", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()

        assert len(response_data["property_claims"]) == 1
        property_claim_json: dict[str, Any] = response_data["property_claims"][0]

        assert len(property_claim_json["evidence"]) == 1
        evidence_json: dict[str, Any] = property_claim_json["evidence"][0]
        assert evidence_json["id"] == evidence.pk
        assert evidence_json["name"] == evidence.name

    def test_view_case_sandbox(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        context: Context = Context.objects.create(**CONTEXT_INFO)
        property_claim: PropertyClaim = PropertyClaim.objects.create(
            **PROPERTYCLAIM1_INFO
        )
        sub_property_claim: PropertyClaim = PropertyClaim.objects.create(
            name="P1.1", property_claim=property_claim
        )

        evidence: Evidence = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        evidence.property_claim.add(property_claim)
        evidence.save()

        strategy: Strategy = Strategy.objects.create(name="S1", goal=goal)
        strategy_property_claim: PropertyClaim = PropertyClaim.objects.create(
            name="P2", strategy=strategy
        )

        response_get: HttpResponse = self.client.get(
            reverse("case_sandbox", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()
        assert response_data == {
            "contexts": [],
            "evidence": [],
            "property_claims": [],
            "strategies": [],
        }

        SandboxUtils.detach_context(context.pk)
        SandboxUtils.detach_evidence(evidence.pk, property_claim_id=property_claim.pk)
        SandboxUtils.detach_property_claim(
            property_claim.pk, parent_info={"goal_id": goal.pk}
        )
        SandboxUtils.detach_strategy(strategy.pk)

        response_get: HttpResponse = self.client.get(
            reverse("case_sandbox", kwargs={"pk": self.assurance_case.pk})
        )

        assert response_get.status_code == 200

        response_data: dict = response_get.json()

        assert len(response_data["contexts"]) == 1
        context_json: dict[str, Any] = response_data["contexts"][0]
        assert context_json["id"] == context.pk
        assert context_json["name"] == context.name
        assert context_json["in_sandbox"]

        assert len(response_data["evidence"]) == 1
        evidence_json: dict[str, Any] = response_data["evidence"][0]
        assert evidence_json["id"] == evidence.pk
        assert evidence_json["name"] == evidence.name
        assert evidence_json["in_sandbox"]

        assert len(response_data["property_claims"]) == 1

        property_claim_json: dict[str, Any] = response_data["property_claims"][0]
        assert property_claim_json["id"] == property_claim.pk
        assert property_claim_json["name"] == property_claim.name
        assert property_claim_json["in_sandbox"]

        assert len(property_claim_json["property_claims"]) == 1
        sub_property_claim_json: dict[str, Any] = property_claim_json[
            "property_claims"
        ][0]
        assert sub_property_claim_json["id"] == sub_property_claim.pk
        assert sub_property_claim_json["name"] == sub_property_claim.name

        assert len(response_data["strategies"]) == 1
        strategy_json: dict[str, Any] = response_data["strategies"][0]
        assert strategy_json["id"] == strategy.pk
        assert strategy_json["name"] == strategy.name
        assert strategy_json["in_sandbox"]

        assert len(strategy_json["property_claims"]) == 1
        strategy_property_claim_json: dict[str, Any] = strategy_json["property_claims"][
            0
        ]
        assert strategy_property_claim_json["id"] == strategy_property_claim.pk
        assert strategy_property_claim_json["name"] == strategy_property_claim.name

    def test_view_case_with_attached_items(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        detached_context: Context = Context.objects.create(
            goal=None, assurance_case=self.assurance_case, name="C1", in_sandbox=True
        )
        property_claim: PropertyClaim = PropertyClaim.objects.create(
            goal=goal, name="P1"
        )
        detached_property_claim: PropertyClaim = PropertyClaim.objects.create(
            assurance_case=self.assurance_case, name="P2", in_sandbox=True
        )
        detached_evidence: Evidence = Evidence.objects.create(
            assurance_case=self.assurance_case,
            name="E1",
            in_sandbox=True,
        )
        detached_strategy: Strategy = Strategy.objects.create(
            assurance_case=self.assurance_case,
            name="S1",
            in_sandbox=True,
        )

        SandboxUtils.attach_context(context_id=detached_context.pk, goal_id=goal.pk)
        SandboxUtils.attach_evidence(
            evidence_id=detached_evidence.pk, property_claim_id=property_claim.pk
        )
        SandboxUtils.attach_property_claim(
            detached_property_claim.pk, {"goal_id": goal.pk}
        )
        SandboxUtils.attach_strategy(detached_strategy.pk, {"goal_id": goal.pk})

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
        assert contexts_from_response[0]["id"] == detached_context.pk

        strategies_from_response: list = goals_from_response[0]["strategies"]
        assert len(strategies_from_response) == 1
        assert strategies_from_response[0]["id"] == detached_strategy.pk

        property_claims_from_response: list = goals_from_response[0]["property_claims"]
        assert len(property_claims_from_response) == 2

        evidence_from_response: list = property_claims_from_response[0]["evidence"]
        assert len(evidence_from_response) == 1
        assert evidence_from_response[0]["id"] == detached_evidence.pk

        assert property_claims_from_response[1]["id"] == detached_property_claim.pk

    def test_view_case_without_detached_items(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        Context.objects.create(
            goal=None, assurance_case=self.assurance_case, name="C1", in_sandbox=True
        )
        PropertyClaim.objects.create(goal=goal, name="P1")
        PropertyClaim.objects.create(
            assurance_case=self.assurance_case, name="P2", in_sandbox=True
        )
        Evidence.objects.create(
            assurance_case=self.assurance_case,
            name="E1",
            in_sandbox=True,
        )

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

        property_claims_from_response: list = goals_from_response[0]["property_claims"]
        assert len(property_claims_from_response) == 1

        evidence_from_response: list = property_claims_from_response[0]["evidence"]
        assert len(evidence_from_response) == 0

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

    def test_identifier_update_left_to_right(self):
        goal: TopLevelNormativeGoal = TopLevelNormativeGoal.objects.create(
            assurance_case=self.assurance_case,
            name="G0",
        )

        first_strategy: Strategy = Strategy.objects.create(goal=goal, name="S01")

        second_strategy: Strategy = Strategy.objects.create(goal=goal, name="S02")

        second_strategy_claim: PropertyClaim = PropertyClaim.objects.create(
            strategy=second_strategy, name="P1_S2"
        )

        top_level_claim: PropertyClaim = PropertyClaim.objects.create(
            goal=goal, name="P01"
        )

        first_strategy_claim: PropertyClaim = PropertyClaim.objects.create(
            strategy=first_strategy, name="P1_S1"
        )

        sub_claim: PropertyClaim = PropertyClaim.objects.create(
            property_claim=top_level_claim, name="P1_P01"
        )

        response_post: HttpResponse = self.client.post(
            reverse("update_identifiers", kwargs={"pk": self.assurance_case.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        top_level_claim.refresh_from_db()
        assert (
            top_level_claim.name == "P1"
        ), f"Claim name should be P1 instead of {top_level_claim.name}"

        sub_claim.refresh_from_db()
        assert (
            sub_claim.name == "P1.1"
        ), f"Sub-claim name should be P1.1 instead of {sub_claim.name}"

        first_strategy_claim.refresh_from_db()
        assert (
            first_strategy_claim.name == "P2"
        ), f"Claim under S1 should be P2 instead of {first_strategy_claim.name}"

        second_strategy_claim.refresh_from_db()
        assert (
            second_strategy_claim.name == "P3"
        ), f"Claim under S2 should be P3 instead of {second_strategy_claim.name}"

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

    def test_identifier_update_on_sub_claims(self):

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

        goal_information: dict[str, Any] = dict(GOAL_INFO)
        goal_information["name"] = "Wrong Name"

        response_post: HttpResponse = self.client.post(
            reverse("goal_list"),
            data=json.dumps(goal_information),
            content_type="application/json",
        )

        goals_created: list[TopLevelNormativeGoal] = list(
            TopLevelNormativeGoal.objects.all()
        )
        assert len(goals_created) == 1
        current_goal: TopLevelNormativeGoal = goals_created[0]

        json_response: dict = response_post.json()

        assert json_response["name"] == "G1"
        assert current_goal.name == json_response["name"]

        assert current_goal.pk == json_response["id"]
        assert json_response["type"] == "TopLevelNormativeGoal"
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

        strategy_information: dict[str, Any] = dict(STRATEGY_INFO)
        strategy_information["name"] = "Wrong name"

        response_post: HttpResponse = self.client.post(
            reverse("strategies_list"),
            data=json.dumps(strategy_information),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        strategies_created: list[Strategy] = list(Strategy.objects.all())
        assert len(strategies_created) == 1

        current_strategy: Strategy = strategies_created[0]
        assert current_strategy.name == "S1"

        json_response: dict = response_post.json()

        assert json_response["id"] == current_strategy.pk
        assert json_response["name"] == current_strategy.name

        assert json_response["type"] == "Strategy"

        assert (
            json_response["short_description"]
            == strategy_information["short_description"]
        )
        assert (
            json_response["long_description"]
            == strategy_information["long_description"]
        )
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

    def test_detach_strategy(self) -> None:

        strategy: Strategy = Strategy.objects.create(**STRATEGY_INFO)

        assert (
            strategy.goal.assurance_case
            == self.assurance_case  # type:ignore[attr-defined]
        )
        assert strategy.goal == self.goal
        assert strategy.assurance_case is None
        assert not strategy.in_sandbox

        response_post: HttpResponse = self.client.post(
            path=reverse("detach_strategy", kwargs={"pk": strategy.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        strategy.refresh_from_db()

        assert strategy.in_sandbox
        assert strategy.goal is None
        assert strategy.assurance_case == self.assurance_case

    def test_attach_strategy(self) -> None:

        detached_strategy: Strategy = Strategy.objects.create(
            name="S1", in_sandbox=True, goal=None, assurance_case=None
        )

        assert self.goal.strategies.count() == 0  # type: ignore [attr-defined]

        response_post: HttpResponse = self.client.post(
            path=reverse("attach_strategy", kwargs={"pk": detached_strategy.pk}),
            data=json.dumps({"goal_id": self.goal.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        detached_strategy.refresh_from_db()

        assert not detached_strategy.in_sandbox
        assert detached_strategy.assurance_case is None
        assert detached_strategy.goal == self.goal


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

        context_information: dict[str, Any] = dict(CONTEXT_INFO)
        context_information["name"] = "Wrong name"

        response_post: HttpResponse = self.client.post(
            reverse("context_list"),
            data=json.dumps(context_information),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        context_created: Context = Context.objects.get(name="C1")

        json_response = response_post.json()

        assert json_response["id"] == context_created.pk
        assert json_response["name"] == context_created.name
        assert json_response["type"] == "Context"
        assert (
            json_response["short_description"]
            == context_information["short_description"]
        )
        assert (
            json_response["long_description"] == context_information["long_description"]
        )
        assert (
            datetime.strptime(json_response["created_date"], "%Y-%m-%dT%H:%M:%S.%f%z")
            == context_created.created_date
        )
        assert json_response["goal_id"] == context_information["goal_id"]

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
        self.first_property_claim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        self.second_property_claim = PropertyClaim.objects.create(**PROPERTYCLAIM2_INFO)
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
            reverse(
                "property_claim_detail", kwargs={"pk": self.first_property_claim.pk}
            )
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]
        response_get = self.client.get(
            reverse(
                "property_claim_detail", kwargs={"pk": self.second_property_claim.pk}
            )
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[1]
        assert response_data["name"] == serializer_data["name"]

    def test_property_claim_detail_view_put(self):
        response_put = self.client.put(
            reverse(
                "property_claim_detail", kwargs={"pk": self.first_property_claim.pk}
            ),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert (
            response_put.json()["short_description"] == self.update["short_description"]
        )

    def test_create_property_claim_with_post(self):

        self.first_property_claim.delete()

        property_claim_info: dict[str, Any] = dict(PROPERTYCLAIM1_INFO)
        property_claim_info["name"] = "Wrong Name"

        response_post: HttpResponse = self.client.post(
            reverse("property_claim_list"),
            data=json.dumps(property_claim_info),
            content_type="application/json",
        )

        property_claim_created: list[PropertyClaim] = list(
            PropertyClaim.objects.filter(name="P2")
        )

        assert (
            len(property_claim_created) == 1
        ), f"Expected 1 property claim created, found {len(property_claim_created)}"
        current_property_claim: PropertyClaim = property_claim_created[0]

        json_response = response_post.json()

        assert json_response["id"] == current_property_claim.pk
        assert json_response["name"] == current_property_claim.name

        assert json_response["type"] == "PropertyClaim"
        assert (
            json_response["short_description"]
            == property_claim_info["short_description"]
        )
        assert (
            json_response["long_description"] == property_claim_info["long_description"]
        )

        assert json_response["goal_id"] == property_claim_info["goal_id"]
        assert json_response["property_claim_id"] is None
        assert json_response["level"] == 1
        assert json_response["claim_type"] == "Project claim"
        assert json_response["property_claims"] == []
        assert json_response["evidence"] == []
        assert json_response["strategy_id"] is None

    def test_create_sub_property_claim_with_post(self):
        self.first_property_claim.delete()
        self.second_property_claim.name = "P.1"
        self.second_property_claim.save()

        property_claim_info: dict[str, Any] = dict(PROPERTYCLAIM1_INFO)
        property_claim_info["name"] = "Wrong Name"
        property_claim_info["property_claim_id"] = self.second_property_claim.pk
        property_claim_info.pop("goal_id", None)

        response_post: HttpResponse = self.client.post(
            reverse("property_claim_list"),
            data=json.dumps(property_claim_info),
            content_type="application/json",
        )

        expected_name: str = f"{self.second_property_claim.name}.1"
        property_claim_created: list[PropertyClaim] = list(
            PropertyClaim.objects.filter(name=expected_name)
        )

        assert (
            len(property_claim_created) == 1
        ), f"Expected 1 property claim with name {expected_name}, found {len(property_claim_created)}"
        current_property_claim: PropertyClaim = property_claim_created[0]
        assert current_property_claim.property_claim == self.second_property_claim
        assert current_property_claim.strategy is None
        assert current_property_claim.goal is None

        json_response = response_post.json()

        assert json_response["id"] == current_property_claim.pk
        assert json_response["name"] == current_property_claim.name
        assert json_response["property_claim_id"] == self.second_property_claim.pk
        assert json_response["strategy_id"] is None
        assert json_response["goal_id"] is None

    def test_property_claim_delete_with_standard_permission(self):
        url = reverse(
            "property_claim_detail", kwargs={"pk": self.first_property_claim.pk}
        )
        self.client.delete(url)
        response_get = self.client.get(reverse("property_claim_list"))
        assert len(response_get.json()) == 1

    def test_detach_property_claim_from_goal(self):

        assert self.first_property_claim in self.goal.property_claims.all()  # type: ignore[attr-ignore]
        assert not self.first_property_claim.in_sandbox
        assert self.first_property_claim.assurance_case is None

        response_post: HttpResponse = self.client.post(
            path=reverse(
                "detach_property_claim", kwargs={"pk": self.first_property_claim.pk}
            ),
            data=json.dumps({"goal_id": self.goal.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        self.goal.refresh_from_db()
        self.first_property_claim.refresh_from_db()

        assert self.first_property_claim not in self.goal.property_claims.all()  # type: ignore[attr-ignore]
        assert self.first_property_claim.assurance_case == self.case
        assert self.first_property_claim.in_sandbox

        response_post = self.client.post(
            path=reverse(
                "attach_property_claim", kwargs={"pk": self.first_property_claim.pk}
            ),
            data=json.dumps({"goal_id": self.goal.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        self.goal.refresh_from_db()
        self.first_property_claim.refresh_from_db()

        assert self.first_property_claim in self.goal.property_claims.all()  # type: ignore[attr-ignore]
        assert self.first_property_claim.assurance_case is None
        assert not self.first_property_claim.in_sandbox

    def test_detach_property_claim_from_property_claim(self):

        new_property_claim: PropertyClaim = PropertyClaim.objects.create(
            name="P.1.1", property_claim=self.first_property_claim
        )

        assert new_property_claim in self.first_property_claim.property_claims.all()  # type: ignore[attr-ignore]
        assert not new_property_claim.in_sandbox
        assert self.first_property_claim.assurance_case is None

        response_post: HttpResponse = self.client.post(
            path=reverse("detach_property_claim", kwargs={"pk": new_property_claim.pk}),
            data=json.dumps({"property_claim_id": self.first_property_claim.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        new_property_claim.refresh_from_db()
        self.first_property_claim.refresh_from_db()

        assert new_property_claim not in self.first_property_claim.property_claims.all()  # type: ignore[attr-ignore]
        assert new_property_claim.assurance_case == self.case
        assert new_property_claim.in_sandbox

        response_post = self.client.post(
            path=reverse("attach_property_claim", kwargs={"pk": new_property_claim.pk}),
            data=json.dumps({"property_claim_id": self.first_property_claim.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        new_property_claim.refresh_from_db()
        self.first_property_claim.refresh_from_db()

        assert new_property_claim in self.first_property_claim.property_claims.all()  # type: ignore[attr-ignore]
        assert new_property_claim.assurance_case is None
        assert not new_property_claim.in_sandbox

    def test_detach_property_claim_from_strategy(self):
        new_strategy: Strategy = Strategy.objects.create(name="S1", goal=self.goal)

        self.first_property_claim.goal = None
        self.first_property_claim.strategy = new_strategy
        self.first_property_claim.save()

        assert self.first_property_claim in new_strategy.property_claims.all()  # type: ignore[attr-ignore]
        assert not self.first_property_claim.in_sandbox
        assert self.first_property_claim.assurance_case is None

        response_post: HttpResponse = self.client.post(
            path=reverse(
                "detach_property_claim", kwargs={"pk": self.first_property_claim.pk}
            ),
            data=json.dumps({"strategy_id": new_strategy.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        new_strategy.refresh_from_db()
        self.first_property_claim.refresh_from_db()

        assert self.first_property_claim not in new_strategy.property_claims.all()  # type: ignore[attr-ignore]
        assert self.first_property_claim.assurance_case == self.case
        assert self.first_property_claim.in_sandbox

        response_post = self.client.post(
            path=reverse(
                "attach_property_claim", kwargs={"pk": self.first_property_claim.pk}
            ),
            data=json.dumps({"strategy_id": new_strategy.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200


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
        evidence_information: dict[str, Any] = dict(EVIDENCE1_INFO_NO_ID)
        evidence_information["name"] = "Wrong name"

        response_post: HttpResponse = self.client.post(
            reverse("evidence_list"),
            data=json.dumps(
                evidence_information | {"property_claim_id": [self.pclaim.pk]}
            ),
            content_type="application/json",
        )

        assert response_post.status_code == 201

        evidence_created: Evidence = Evidence.objects.get(name="E2")
        json_response = response_post.json()

        assert json_response["id"] == evidence_created.pk
        assert json_response["name"] == evidence_created.name

        assert json_response["type"] == "Evidence"
        assert (
            json_response["short_description"]
            == evidence_information["short_description"]
        )
        assert (
            json_response["long_description"]
            == evidence_information["long_description"]
        )

        assert json_response["URL"] == evidence_information["URL"]
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

    def test_detach_evidence(self):

        assert self.evidence1.property_claim.count() == 1
        assert self.evidence1.property_claim.first() == self.pclaim
        assert self.pclaim.goal == self.goal
        assert self.goal.assurance_case == self.case
        assert not self.evidence1.in_sandbox
        assert self.evidence1.assurance_case is None

        response_post: HttpResponse = self.client.post(
            path=reverse("detach_evidence", kwargs={"pk": self.evidence1.pk}),
            data=json.dumps({"property_claim_id": self.pclaim.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        self.evidence1.refresh_from_db()

        assert self.evidence1.property_claim.count() == 0
        assert self.evidence1.in_sandbox
        assert self.evidence1.assurance_case == self.case

    def test_attach_evidence(self):
        detached_evidence: Evidence = Evidence.objects.create(URL="detached.co.uk")
        detached_evidence.in_sandbox = True
        detached_evidence.assurance_case = self.case

        evidence_count: int = self.pclaim.evidence.count()  # type: ignore[attr-defined]

        response_post: HttpResponse = self.client.post(
            path=reverse("attach_evidence", kwargs={"pk": detached_evidence.pk}),
            data=json.dumps({"property_claim_id": self.pclaim.pk}),
            content_type="application/json",
        )

        assert response_post.status_code == 200

        self.pclaim.refresh_from_db()
        detached_evidence.refresh_from_db()

        assert (self.pclaim.evidence.count() - evidence_count) == 1  # type: ignore[attr-defined]
        assert detached_evidence in self.pclaim.evidence.all()  # type: ignore[attr-defined]
        assert not detached_evidence.in_sandbox


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
