''' from https://realpython.com/testing-in-django-part-1-best-practices-and-examples/
https://www.bezkoder.com/django-rest-api/
https://docs.djangoproject.com/en/3.2/topics/testing/tools/'''

from django.test import TestCase

# Create your tests here.
from eap_api.models import (
    AssuranceCase,
    TopLevelNormativeGoal,
    Context,
    SystemDescription,
    PropertyClaim,
    Argument,
    EvidentialClaim,
    Evidence
)

class AssuranceTestCase(TestCase):
    """ creates an AssuranceCase object and tested whether the created title
        matches the expected title"""

    def create_test_entry(self, name, description):
        return AssuranceCase.objects.create(name=name, description=description)

    def test_assurance_creation(self):
        test_name = "TestAC1"
        test_description="test description"
        test_entry = self.create_test_entry(test_name, test_description)
        self.assertTrue(isinstance(test_entry, AssuranceCase))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.description, test_description)



class TopLevelNormativeGoalTestCase(TestCase):
    """
    creates a TopLevelNormativeGoal object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self, name, description, keywords):
        a_case = AssuranceCase.objects.create(
            name="TestAC",
            description="test description"
        )
        return TopLevelNormativeGoal.objects.create(
            name=name,
            short_description=description,
            keywords=keywords,
            assurance_case=a_case
        )

    def test_goal_creation(self):
        test_name = "TestGoal1"
        test_entry = self.create_test_entry(name=test_name,
                                            description="a test",
                                            keywords="key,word")
        self.assertTrue(isinstance(test_entry, TopLevelNormativeGoal))
        self.assertEqual(test_entry.name, test_name)
        self.assertTrue(isinstance(test_entry.assurance_case,
                                   AssuranceCase))


class ContextTestCase(TestCase):
    """
    creates a Context object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self, name, description):
        a_case = AssuranceCase.objects.create(
            name="TestAC",
            description="test description"
        )
        a_goal = TopLevelNormativeGoal.objects.create(
            name="TestGoal",
            short_description="test description",
            long_description="a test description",
            keywords="key",
            assurance_case=a_case
        )
        return Context.objects.create(
            name=name,
            short_description=description,
            long_description=description,
            goal=a_goal
        )

    def test_context_creation(self):
        test_name = "TestContext1"
        test_entry = self.create_test_entry(name=test_name,
                                            description="a test")
        self.assertTrue(isinstance(test_entry, Context))
        self.assertEqual(test_entry.name, test_name)
        self.assertTrue(isinstance(test_entry.goal,
                                   TopLevelNormativeGoal))
