import json

from django.test import Client, TestCase
from django.urls import reverse
from eap_api.models import (
    AssuranceCase,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    EvidentialClaim,
    PropertyClaim,
    TopLevelNormativeGoal,
)
from eap_api.serializers import (
    AssuranceCaseSerializer,
    ContextSerializer,
    EAPGroupSerializer,
    EAPUserSerializer,
    EvidenceSerializer,
    EvidentialClaimSerializer,
    PropertyClaimSerializer,
    TopLevelNormativeGoalSerializer,
)
from eap_api.views import make_summary
from rest_framework.authtoken.models import Token

from .constants_tests import (
    CASE1_INFO,
    CONTEXT_INFO,
    # for many-to-many relations, need to NOT have
    # e.g. evidential_claim_id in the JSON
    EVIDENCE1_INFO_NO_ID,
    EVIDENCE2_INFO_NO_ID,
    EVIDENTIALCLAIM1_INFO,
    GOAL_INFO,
    GROUP1_INFO,
    PROPERTYCLAIM1_INFO,
    PROPERTYCLAIM2_INFO,
    USER1_INFO,
)


class CaseViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case1 = AssuranceCase.objects.create(**CASE1_INFO)
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
        assert response_get.json() == make_summary(self.serializer.data)

    def test_case_detail_view_get(self):
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.case1.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]

    def test_case_detail_view_put(self):
        response_put = self.client.put(
            reverse("case_detail", kwargs={"pk": self.case1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_case_delete_with_standard_permission(self):
        url = reverse("case_detail", kwargs={"pk": self.case1.pk})
        self.client.delete(url)

        response_get = self.client.get(reverse("case_list"))
        assert len(response_get.json()) == 0


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
            "name": "TestPropertyClaim_updated",
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
        assert response_put.json()["name"] == self.update["name"]

    def test_property_claim_delete_with_standard_permission(self):
        url = reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("property_claim_list"))
        assert len(response_get.json()) == 1


class EvidentialClaimViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        self.eclaim = EvidentialClaim.objects.create(**EVIDENTIALCLAIM1_INFO)
        self.eclaim.property_claim.set([self.pclaim])

        self.update = {
            "name": "TestEvidentialClaim_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = EvidentialClaim.objects.all()
        # convert it to JSON
        self.serializer = EvidentialClaimSerializer(self.data, many=True)

    def test_evidential_claim_list_view_get(self):
        response_get = self.client.get(reverse("evidential_claim_list"))
        assert response_get.status_code == 200
        assert response_get.json() == make_summary(self.serializer.data)
        assert len(response_get.json()) == 1

    def test_evidential_claim_detail_view_get(self):
        response_get = self.client.get(
            reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk})
        )
        assert response_get.status_code == 200
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        assert response_data["name"] == serializer_data["name"]

    def test_evidential_claim_detail_view_put(self):
        response_put = self.client.put(
            reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        assert response_put.status_code == 200
        assert response_put.json()["name"] == self.update["name"]

    def test_evidential_claim_delete_with_standard_permission(self):
        url = reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("evidential_claim_list"))
        assert len(response_get.json()) == 0


class EvidenceViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE1_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        self.eclaim = EvidentialClaim.objects.create(**EVIDENTIALCLAIM1_INFO)
        self.eclaim.property_claim.set([self.pclaim])

        self.evidence1 = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        self.evidence1.save()
        self.evidence1.evidential_claim.set([self.eclaim])
        self.evidence2 = Evidence.objects.create(**EVIDENCE2_INFO_NO_ID)
        self.evidence2.save()
        self.evidence2.evidential_claim.set([self.eclaim])

        self.update = {
            "name": "Evidence_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = Evidence.objects.all()
        # convert it to JSON
        self.serializer = EvidenceSerializer(self.data, many=True)

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
        self.eclaim = EvidentialClaim.objects.create(**EVIDENTIALCLAIM1_INFO)
        self.eclaim.property_claim.set([self.pclaim])

        self.evidence1 = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        self.evidence1.save()
        self.evidence1.evidential_claim.set([self.eclaim])
        self.evidence2 = Evidence.objects.create(**EVIDENCE2_INFO_NO_ID)
        self.evidence2.save()
        self.evidence2.evidential_claim.set([self.eclaim])

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
        assert (
            len(response_data["goals"][0]["property_claims"][0]["evidential_claims"])
            == 1
        )
        assert (
            len(
                response_data["goals"][0]["property_claims"][0]["evidential_claims"][0][
                    "evidence"
                ]
            )
            == 2
        )


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
