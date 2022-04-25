from django.test import TestCase
from django.urls import reverse
from eap_api.views import make_summary
from eap_api.models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    EvidentialClaim,
    Evidence,
)
from eap_api.serializers import (
    AssuranceCaseSerializer,
    TopLevelNormativeGoalSerializer,
    ContextSerializer,
    SystemDescriptionSerializer,
    PropertyClaimSerializer,
    EvidentialClaimSerializer,
    EvidenceSerializer,
)
import json
from .constants_tests import (
    CASE_INFO,
    GOAL_INFO,
    CONTEXT_INFO,
    DESCRIPTION_INFO,
    PROPERTYCLAIM1_INFO,
    PROPERTYCLAIM2_INFO,
    # for many-to-many relations, need to NOT have
    # e.g. property_claim_id in the JSON
    EVIDENTIALCLAIM1_INFO,
    # for many-to-many relations, need to NOT have
    # e.g. evidential_claim_id in the JSON
    EVIDENCE1_INFO_NO_ID,
    EVIDENCE2_INFO_NO_ID,
)


class CaseViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case1 = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_post.status_code, 201)
        self.assertEqual(response_post.json()["name"], post_data["name"])
        # check we now have two cases in the db
        response_get = self.client.get(reverse("case_list"))
        self.assertEqual(len(response_get.json()), 2)

    def test_case_list_view_get(self):
        response_get = self.client.get(reverse("case_list"))
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))

    def test_case_detail_view_get(self):
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.case1.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_case_detail_view_put(self):
        response_put = self.client.put(
            reverse("case_detail", kwargs={"pk": self.case1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_case_delete_with_standard_permission(self):
        url = reverse("case_detail", kwargs={"pk": self.case1.pk})
        self.client.delete(url)

        response_get = self.client.get(reverse("case_list"))
        self.assertEqual(len(response_get.json()), 0)


class GoalViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))

    def test_goal_detail_view_get(self):
        response_get = self.client.get(
            reverse("goal_detail", kwargs={"pk": self.goal.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_goal_detail_view_put(self):
        response_put = self.client.put(
            reverse("goal_detail", kwargs={"pk": self.goal.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_goal_delete_with_standard_permission(self):
        url = reverse("goal_detail", kwargs={"pk": self.goal.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("goal_list"))
        self.assertEqual(len(response_get.json()), 0)


class ContextViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))

    def test_context_detail_view_get(self):
        response_get = self.client.get(
            reverse("context_detail", kwargs={"pk": self.context.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_context_detail_view_put(self):
        response_put = self.client.put(
            reverse("context_detail", kwargs={"pk": self.context.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_context_delete_with_standard_permission(self):
        url = reverse("context_detail", kwargs={"pk": self.context.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("context_list"))
        self.assertEqual(len(response_get.json()), 0)


class DescriptionViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.description = SystemDescription.objects.create(**DESCRIPTION_INFO)
        self.update = {
            "name": "TestDescription_updated",
            "short_description": "description is updated",
        }
        # get data from DB
        self.data = SystemDescription.objects.all()
        # convert it to JSON
        self.serializer = SystemDescriptionSerializer(self.data, many=True)

    def test_description_list_view_get(self):
        response_get = self.client.get(reverse("description_list"))
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))

    def test_description_detail_view_get(self):
        response_get = self.client.get(
            reverse("description_detail", kwargs={"pk": self.description.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_description_detail_view_put(self):
        response_put = self.client.put(
            reverse("description_detail", kwargs={"pk": self.description.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_description_delete_with_standard_permission(self):
        url = reverse("description_detail", kwargs={"pk": self.description.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("description_list"))
        self.assertEqual(len(response_get.json()), 0)


class PropertyClaimViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))
        self.assertEqual(len(response_get.json()), 2)

    def test_property_claim_detail_view_get(self):
        response_get = self.client.get(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])
        response_get = self.client.get(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim2.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[1]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_property_claim_detail_view_put(self):
        response_put = self.client.put(
            reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_property_claim_delete_with_standard_permission(self):
        url = reverse("property_claim_detail", kwargs={"pk": self.pclaim1.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("property_claim_list"))
        self.assertEqual(len(response_get.json()), 1)


class EvidentialClaimViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))
        self.assertEqual(len(response_get.json()), 1)

    def test_evidential_claim_detail_view_get(self):
        response_get = self.client.get(
            reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_evidential_claim_detail_view_put(self):
        response_put = self.client.put(
            reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_evidential_claim_delete_with_standard_permission(self):
        url = reverse("evidential_claim_detail", kwargs={"pk": self.eclaim.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("evidential_claim_list"))
        self.assertEqual(len(response_get.json()), 0)


class EvidenceViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), make_summary(self.serializer.data))
        self.assertEqual(len(response_get.json()), 2)

    def test_evidence_detail_view_get(self):
        response_get = self.client.get(
            reverse("evidence_detail", kwargs={"pk": self.evidence1.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])
        response_get = self.client.get(
            reverse("evidence_detail", kwargs={"pk": self.evidence2.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[1]
        self.assertEqual(response_data["name"], serializer_data["name"])

    def test_evidence_detail_view_put(self):
        response_put = self.client.put(
            reverse("evidence_detail", kwargs={"pk": self.evidence1.pk}),
            data=json.dumps(self.update),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()["name"], self.update["name"])

    def test_evidence_delete_with_standard_permission(self):
        url = reverse("evidence_detail", kwargs={"pk": self.evidence1.pk})
        self.client.delete(url)
        response_get = self.client.get(reverse("evidence_list"))
        self.assertEqual(len(response_get.json()), 1)


class FullCaseDetailViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case = AssuranceCase.objects.create(**CASE_INFO)
        self.goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        self.description = SystemDescription.objects.create(**DESCRIPTION_INFO)
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
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])
        response_get = self.client.get(
            reverse("case_detail", kwargs={"pk": self.case.pk})
        )
        self.assertEqual(response_get.status_code, 200)
        response_data = response_get.json()
        serializer_data = self.serializer.data[0]
        self.assertEqual(response_data["name"], serializer_data["name"])
        # check we can go down the whole tree
        self.assertEqual(len(response_data["goals"]), 1)
        self.assertEqual(len(response_data["goals"][0]["context"]), 1)
        self.assertEqual(len(response_data["goals"][0]["system_description"]), 1)
        self.assertEqual(len(response_data["goals"][0]["property_claims"]), 1)
        self.assertEqual(
            len(response_data["goals"][0]["property_claims"][0]["evidential_claims"]), 1
        )
        self.assertEqual(
            len(
                response_data["goals"][0]["property_claims"][0]["evidential_claims"][0][
                    "evidence"
                ]
            ),
            2,
        )
