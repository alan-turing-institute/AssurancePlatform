""" from https://realpython.com/testing-in-django-part-1-best-practices-and-examples/
https://www.bezkoder.com/django-rest-api/
https://docs.djangoproject.com/en/3.2/topics/testing/tools/"""

from django.test import TestCase
from .constants_tests import TEST_AC_NAME, TEST_GOAL_NAME

# Create your tests here.
from eap_api.models import AssuranceCase, TopLevelNormativeGoal


class AssuranceTestCase(TestCase):
    """creates an AssuranceCase object and tested whether the created title
    matches the expected title"""

    def create_test_entry(
        self, name=TEST_AC_NAME, description="test description", shape=0
    ):
        return AssuranceCase.objects.create(
            name=name, description=description, shape=shape
        )

    def test_assurance_creation(self, name=TEST_AC_NAME):
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, AssuranceCase))
        self.assertEqual(test_entry.name, name)


class TopLevelNormativeGoalTestCase(TestCase):
    """creates a TopLevelNormativeGoal object and tests foreign key and
    whether the created title matches the expected title"""

    def create_test_entry(
        self, name=TEST_GOAL_NAME, description="test description", shape=0,
        keywords="test"
    ):
        a_case = AssuranceCase.objects.create(
            name=TEST_AC_NAME, description="test description", shape=0
        )
        return TopLevelNormativeGoal.objects.create(
            name=name,
            short_description=description,
            shape=shape,
            keywords=keywords,
            assurance_case=a_case,
        )

    def test_assurance_creation(self, name=TEST_GOAL_NAME):
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, TopLevelNormativeGoal))
        self.assertEqual(test_entry.name, name)
