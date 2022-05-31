from django.test import TestCase, Client
from django.urls import reverse
from rest_framework.authtoken.models import Token
import json
from eap_api.models import (
    EAPUser,
    EAPGroup,
)

from .constants_tests import (
    CASE1_INFO,
    CASE2_INFO,
    CASE3_INFO,
    USER1_INFO,
    USER2_INFO,
    USER3_INFO,
    GROUP1_INFO,
    GROUP2_INFO,
    GROUP3_INFO,
)


class CasePermissionsTest(TestCase):
    """
    More sophisticated test, create a few cases, groups, users, and test
    permissions.
    user1 is owner of group1 and case1, and member of group2
    user2 is owner of group2 and case2, and member of group3
    user3 is owner of group3 and case3 and member of group1.
    group1 has edit rights on case1 and view rights on case3
    group2 has view rights on case2
    group3 has view rights on case3

    """

    def setUp(self):
        # login user1
        user1 = EAPUser.objects.create(**USER1_INFO)
        user1.save()
        user2 = EAPUser.objects.create(**USER2_INFO)
        user2.save()
        user3 = EAPUser.objects.create(**USER3_INFO)
        user3.save()
        group1 = EAPGroup.objects.create(**GROUP1_INFO, owner_id=user1.id)
        group1.member.set([user1.id, user3.id])
        group2 = EAPGroup.objects.create(**GROUP2_INFO, owner_id=user2.id)
        group2.member.set([user1.id, user2.id])
        group3 = EAPGroup.objects.create(**GROUP3_INFO, owner_id=user3.id)
        group3.member.set([user2.id, user3.id])
        token1, created = Token.objects.get_or_create(user=user1)
        token2, created = Token.objects.get_or_create(user=user2)
        token3, created = Token.objects.get_or_create(user=user3)
        # 3 different clients with 3 different logged-in users (seems messy...)
        self.client1 = Client(HTTP_AUTHORIZATION="Token {}".format(token1.key))
        self.client2 = Client(HTTP_AUTHORIZATION="Token {}".format(token2.key))
        self.client3 = Client(HTTP_AUTHORIZATION="Token {}".format(token3.key))

    def test_case1(self):
        """
        case1 is created by user1, and group1 has edit rights.
        user1 and user3 (members of group1) should have edit rights on it.
        user2 should not be able to see it.
        """
        # create the case
        response_post = self.client1.post(
            reverse("case_list"),
            data=json.dumps(CASE1_INFO),
            content_type="application/json",
        )
        self.assertEqual(response_post.status_code, 201)
        # add group1 to edit groups
        response_put = self.client1.put(
            reverse("case_detail", kwargs={"pk": 1}),
            data=json.dumps({"edit_groups": [1]}),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        # user1 and user3 should now be able to see it via case_list, user2 should not.
        get_list1 = self.client1.get(reverse("case_list"))
        self.assertEqual(get_list1.status_code, 200)
        self.assertEqual(len(get_list1.json()), 1)
        get_list2 = self.client2.get(reverse("case_list"))
        self.assertEqual(get_list2.status_code, 200)
        self.assertEqual(len(get_list2.json()), 0)
        get_list3 = self.client3.get(reverse("case_list"))
        self.assertEqual(get_list3.status_code, 200)
        self.assertEqual(len(get_list3.json()), 1)
        # user1 and user3 should now be able to see it via case_detail, user2 should not.
        get_detail1 = self.client1.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail1.status_code, 200)
        get_detail2 = self.client2.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail2.status_code, 403)
        get_detail3 = self.client3.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail3.status_code, 200)
        # user3 should be able to delete it.
        delete_detail3 = self.client3.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail3.status_code, 204)

    def test_case2(self):
        """
        case2 is created by user2, and group2 has view rights.
        user2 (as owner) should have edit rights on it.
        user1 (member of group2) should have view rights on it.
        user3 should not be able to see it.
        """
        # create the case
        response_post = self.client2.post(
            reverse("case_list"),
            data=json.dumps(CASE2_INFO),
            content_type="application/json",
        )
        self.assertEqual(response_post.status_code, 201)
        # add group2 to view groups
        response_put = self.client2.put(
            reverse("case_detail", kwargs={"pk": 1}),
            data=json.dumps({"view_groups": [2]}),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        # user1 and user2 should now be able to see it via case_list, user3 should not.
        get_list1 = self.client1.get(reverse("case_list"))
        self.assertEqual(get_list1.status_code, 200)
        self.assertEqual(len(get_list1.json()), 1)
        get_list2 = self.client2.get(reverse("case_list"))
        self.assertEqual(get_list2.status_code, 200)
        self.assertEqual(len(get_list2.json()), 1)
        get_list3 = self.client3.get(reverse("case_list"))
        self.assertEqual(get_list3.status_code, 200)
        self.assertEqual(len(get_list3.json()), 0)
        # user1 and user2 should now be able to see it via case_detail, user3 should not.
        get_detail1 = self.client1.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail1.status_code, 200)
        get_detail2 = self.client2.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail2.status_code, 200)
        get_detail3 = self.client3.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail3.status_code, 403)
        # user1 should not be able to delete it.
        delete_detail1 = self.client1.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail1.status_code, 403)
        # user2 should be able to delete it.
        delete_detail2 = self.client2.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail2.status_code, 204)

    def test_case3(self):
        """
        case3 is created by user3, and group3 and group1 have view rights.
        user3 (as owner) should have edit rights on it.
        user1 (member of group1) should have view rights on it.
        user2 (member of group3) should also have view rights
        """
        # create the case
        response_post = self.client3.post(
            reverse("case_list"),
            data=json.dumps(CASE3_INFO),
            content_type="application/json",
        )
        self.assertEqual(response_post.status_code, 201)
        # add groups 1 and 3 to view groups
        response_put = self.client3.put(
            reverse("case_detail", kwargs={"pk": 1}),
            data=json.dumps({"view_groups": [1, 3]}),
            content_type="application/json",
        )
        self.assertEqual(response_put.status_code, 200)
        # user1, user2 and user3 should now be able to see it via case_list
        get_list1 = self.client1.get(reverse("case_list"))
        self.assertEqual(get_list1.status_code, 200)
        self.assertEqual(len(get_list1.json()), 1)
        get_list2 = self.client2.get(reverse("case_list"))
        self.assertEqual(get_list2.status_code, 200)
        self.assertEqual(len(get_list2.json()), 1)
        get_list3 = self.client3.get(reverse("case_list"))
        self.assertEqual(get_list3.status_code, 200)
        self.assertEqual(len(get_list3.json()), 1)
        # user1, user2, and user3 should now be able to see it via case_detail
        get_detail1 = self.client1.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail1.status_code, 200)
        get_detail2 = self.client2.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail2.status_code, 200)
        get_detail3 = self.client3.get(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(get_detail3.status_code, 200)
        # user1 should not be able to delete it.
        delete_detail1 = self.client1.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail1.status_code, 403)
        # user2 should not be able to delete it.
        delete_detail2 = self.client2.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail2.status_code, 403)
        # user3 should be able to delete it.
        delete_detail3 = self.client3.delete(reverse("case_detail", kwargs={"pk": 1}))
        self.assertEqual(delete_detail3.status_code, 204)
