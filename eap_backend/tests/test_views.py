
from django.test import TestCase
from django.urls import reverse
from eap_api.views import case_list
from django.urls import path
from eap_api.models import AssuranceCase, TopLevelNormativeGoal
from eap_api.serializers  import AssuranceCaseSerializer
import json


class ViewTest(TestCase):
    def setUp(self):
        # Mock Entries to be modified and tested
        self.case1 = AssuranceCase.objects.create(
            name="TestAC1", description="test description1"
        )
        self.case2 = AssuranceCase.objects.create(
            name="TestAC2", description="test description2"
        )
        self.case_delete = AssuranceCase.objects.create(
            name="todelete", description="to delete description2"
        )
        self.valid_entry = {
            "name" : "TestAC_updated",
            "description": "description is updated",
        }
        self.invalid_entry = {
            "name": "",
            "content": "description is updated",
        }
        # get data from DB
        self.data = AssuranceCase.objects.all()
        # convert it to JSON
        self.serializer = AssuranceCaseSerializer(self.data, many=True)

    def test_case_list_view_get(self):

        response_get = self.client.get(reverse('case_list'))
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), self.serializer.data)
        #self.assertEqual(response_get.json()[0]['name'], 'TestAC1')

    # METHOD PUT IN CASE_LIST DOESNT WORK. TO INVESTIGATE
    # def test_case_list_view_put(self):

    #     response_put = self.client.put(
    #         reverse('case_list', kwargs={'name':self.case1.name}),
    #         data = json.dumps(self.valid_entry),
    #         content_type = 'application/json'
    #     )
    #     self.assertEqual(response_put.status_code, 200)



    def test_case_detail_view_get(self):

        response_get = self.client.get(reverse('case_list'))
        self.assertEqual(response_get.status_code, 200)
        self.assertEqual(response_get.json(), self.serializer.data)

    def test_case_detail_view_put(self):
        response_put = self.client.put(
            reverse('case_detail', kwargs={'pk': self.case1.pk}),
            data = json.dumps(self.valid_entry),
            content_type = 'application/json'
        )
        self.assertEqual(response_put.status_code, 200)
        self.assertEqual(response_put.json()['name'], self.valid_entry['name'])

    def test_delete_with_standard_permission(self):

        url = reverse('case_detail', kwargs={'pk': self.case_delete.pk})
        self.client.delete(url)

        response_get = self.client.get(reverse('case_list'))
        self.assertEqual(len(response_get.json()), 2)
