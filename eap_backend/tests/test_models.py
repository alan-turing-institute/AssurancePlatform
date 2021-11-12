""" from https://realpython.com/testing-in-django-part-1-best-practices-and-examples/
https://www.bezkoder.com/django-rest-api/
https://docs.djangoproject.com/en/3.2/topics/testing/tools/"""

from django.test import TestCase
from .constants_tests import (
    CASE_INFO,
    GOAL_INFO,
    CONTEXT_INFO,
    DESCRIPTION_INFO,
    PROPERTYCLAIM1_INFO,
    PROPERTYCLAIM2_INFO,
    ARGUMENT1_INFO_NO_ID,
    ARGUMENT2_INFO,
    EVIDENTIALCLAIM1_INFO,
    EVIDENTIALCLAIM2_INFO,
    EVIDENTIALCLAIM3_INFO,
    EVIDENTIALCLAIM4_INFO,
    EVIDENCE1_INFO_NO_ID,
    EVIDENCE2_INFO,
    EVIDENCE3_INFO,
    EVIDENCE4_INFO,
    EVIDENCE5_INFO,
    EVIDENCE6_INFO,
    EVIDENCE7_INFO,
)

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

    def create_test_entry(self):
        return AssuranceCase.objects.create(**CASE_INFO)

    def test_assurance_creation(self):
        test_name = CASE_INFO["name"]
        test_description=CASE_INFO["description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, AssuranceCase))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.description, test_description)


class TopLevelNormativeGoalTestCase(TestCase):
    """
    creates a TopLevelNormativeGoal object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        return goal

    def test_goal_creation(self):
        test_name = GOAL_INFO["name"]
        test_keywords = GOAL_INFO["keywords"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, TopLevelNormativeGoal))
        self.assertEqual(test_entry.name, test_name)
        self.assertTrue(isinstance(test_entry.assurance_case,
                                   AssuranceCase))


class ContextTestCase(TestCase):
    """
    creates a Context object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        context = Context.objects.create(**CONTEXT_INFO)
        context.goal = goal
        return context

    def test_context_creation(self):
        test_name = CONTEXT_INFO["name"]
        test_desc = CONTEXT_INFO["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, Context))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.goal,
                                   TopLevelNormativeGoal))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.goal.assurance_case,
                                   AssuranceCase))


class DescriptionTestCase(TestCase):
    """
    creates a Context object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        desc = SystemDescription.objects.create(**DESCRIPTION_INFO)
        desc.goal = goal
        return desc

    def test_description_creation(self):
        test_name = DESCRIPTION_INFO["name"]
        test_desc = DESCRIPTION_INFO["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, SystemDescription))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.goal,
                                   TopLevelNormativeGoal))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.goal.assurance_case,
                                   AssuranceCase))

class PropertyClaimTestCase(TestCase):
    """
    creates a PropertyClaim object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        return pclaim

    def test_property_claim_creation(self):
        test_name = PROPERTYCLAIM1_INFO["name"]
        test_desc = PROPERTYCLAIM1_INFO["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, PropertyClaim))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.goal,
                                   TopLevelNormativeGoal))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.goal.assurance_case,
                                   AssuranceCase))

class PropertyClaimTestCase(TestCase):
    """
    creates a PropertyClaim object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        return pclaim

    def test_property_claim_creation(self):
        test_name = PROPERTYCLAIM1_INFO["name"]
        test_desc = PROPERTYCLAIM1_INFO["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, PropertyClaim))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.goal,
                                   TopLevelNormativeGoal))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.goal.assurance_case,
                                   AssuranceCase))


class ArgumentTestCase(TestCase):
    """
    creates an Argument object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        argument = Argument.objects.create(**ARGUMENT1_INFO_NO_ID)
        argument.property_claim.set([pclaim])
        return argument

    def test_argument_creation(self):
        test_name = ARGUMENT1_INFO_NO_ID["name"]
        test_desc = ARGUMENT1_INFO_NO_ID["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, Argument))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # one step relation
        self.assertTrue(isinstance(test_entry.property_claim.all()[0],
                                   PropertyClaim))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.property_claim.all()[0].goal,
                                   TopLevelNormativeGoal))
        # test three-step relation
        self.assertTrue(isinstance(
            test_entry.property_claim.all()[0].goal.assurance_case,
            AssuranceCase)
        )


class EvidentialClaimTestCase(TestCase):
    """
    creates an EvidentialClaim object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        argument = Argument.objects.create(**ARGUMENT1_INFO_NO_ID)
        argument.property_claim.set([pclaim])
        eclaim = EvidentialClaim.objects.create(**EVIDENTIALCLAIM1_INFO)
        eclaim.argument = argument
        return eclaim

    def test_evidential_claim_creation(self):
        test_name = EVIDENTIALCLAIM1_INFO["name"]
        test_desc = EVIDENTIALCLAIM1_INFO["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, EvidentialClaim))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.argument,
                                   Argument))
        # test two-step relation
        self.assertTrue(isinstance(test_entry.argument.property_claim.all()[0],
                                   PropertyClaim))
        # test three-step relation
        self.assertTrue(isinstance(
            test_entry.argument.property_claim.all()[0].goal,
            TopLevelNormativeGoal))
        # test four-step relation
        self.assertTrue(isinstance(
            test_entry.argument.property_claim.all()[0].goal.assurance_case,
            AssuranceCase)
        )


class EvidenceCase(TestCase):
    """
    creates an Evidence object and tests foreign key and
    whether the created title matches the expected title
    """
    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        argument = Argument.objects.create(**ARGUMENT1_INFO_NO_ID)
        argument.property_claim.set([pclaim])
        eclaim = EvidentialClaim.objects.create(**EVIDENTIALCLAIM1_INFO)
        eclaim.argument = argument
        evidence = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        evidence.evidential_claim.set([eclaim])
        return evidence

    def test_evidence_creation(self):
        test_name = EVIDENCE1_INFO_NO_ID["name"]
        test_desc = EVIDENCE1_INFO_NO_ID["short_description"]
        test_entry = self.create_test_entry()
        self.assertTrue(isinstance(test_entry, Evidence))
        self.assertEqual(test_entry.name, test_name)
        self.assertEqual(test_entry.short_description, test_desc)
        # test one-step relation
        self.assertTrue(isinstance(test_entry.evidential_claim.all()[0],
                                   EvidentialClaim))
        # test two-step relation
        self.assertTrue(isinstance(
            test_entry.evidential_claim.all()[0].argument,
            Argument))
        # test three-step relation
        self.assertTrue(isinstance(
            test_entry.evidential_claim.all()[0].argument.\
            property_claim.all()[0],
            PropertyClaim))
        # test four-step relation
        self.assertTrue(isinstance(
            test_entry.evidential_claim.all()[0].argument.\
            property_claim.all()[0].goal,
            TopLevelNormativeGoal))
        # test five-step relation
        self.assertTrue(isinstance(
            test_entry.evidential_claim.all()[0].argument.\
            property_claim.all()[0].goal.assurance_case,
            AssuranceCase)
        )
