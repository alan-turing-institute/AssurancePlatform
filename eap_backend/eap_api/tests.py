from django.test import TestCase

# Create your tests here.
from eap_api.models import AssuranceCase

class AssuranceTestCase(TestCase):
    def setUp(self):
        AssuranceCase.objects.create(name="Test 1", description= "test description", shape = 1)
        AssuranceCase.objects.create(name="Test 2", description= "test description 2", shape = 0)

    def test_assurance_right_shape(self):
        """assurance case has been assigned to the right shape"""
        ac_type1 = AssuranceCase.objects.get(name = "Test 1")
        ac_type2 = AssuranceCase.objects.get(name = "Test 2")
        self.assertEqual(ac_type1.shape, 1)
        self.assertEqual(ac_type2.shape, 0)

        