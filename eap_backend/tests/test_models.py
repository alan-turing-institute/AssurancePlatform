"""from https://realpython.com/testing-in-django-part-1-best-practices-and-examples/
https://www.bezkoder.com/django-rest-api/
https://docs.djangoproject.com/en/3.2/topics/testing/tools/"""

from django.test import TestCase

# Create your tests here.
from eap_api.models import (
    AssuranceCase,
    Context,
    EAPGroup,
    EAPUser,
    Evidence,
    PropertyClaim,
    TopLevelNormativeGoal,
)

from .constants_tests import (
    CASE1_INFO,
    CONTEXT_INFO,
    EVIDENCE1_INFO_NO_ID,
    GOAL_INFO,
    GROUP1_INFO,
    PROPERTYCLAIM1_INFO,
    USER1_INFO,
)


class AssuranceTestCase(TestCase):
    """creates an AssuranceCase object and tests whether the created title
    matches the expected title"""

    def create_test_entry(self):
        return AssuranceCase.objects.create(**CASE1_INFO)

    def test_assurance_creation(self):
        test_name = CASE1_INFO["name"]
        test_description = CASE1_INFO["description"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, AssuranceCase)
        assert test_entry.name == test_name
        assert test_entry.description == test_description


class TopLevelNormativeGoalTestCase(TestCase):
    """
    creates a TopLevelNormativeGoal object and tests foreign key and
    whether the created title matches the expected title
    """

    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE1_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        return goal

    def test_goal_creation(self):
        test_name = GOAL_INFO["name"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, TopLevelNormativeGoal)
        assert test_entry.name == test_name
        assert isinstance(test_entry.assurance_case, AssuranceCase)


class ContextTestCase(TestCase):
    """
    creates a Context object and tests foreign key and
    whether the created title matches the expected title
    """

    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE1_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        context = Context.objects.create(**CONTEXT_INFO)
        context.goal = goal
        return context

    def test_context_creation(self):
        test_name = CONTEXT_INFO["name"]
        test_desc = CONTEXT_INFO["short_description"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, Context)
        assert test_entry.name == test_name
        assert test_entry.short_description == test_desc
        # test one-step relation
        assert isinstance(test_entry.goal, TopLevelNormativeGoal)
        # test two-step relation
        assert isinstance(test_entry.goal.assurance_case, AssuranceCase)


class PropertyClaimTestCase(TestCase):
    """
    creates a PropertyClaim object and tests foreign key and
    whether the created title matches the expected title
    """

    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE1_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        return pclaim

    def test_property_claim_creation(self):
        test_name = PROPERTYCLAIM1_INFO["name"]
        test_desc = PROPERTYCLAIM1_INFO["short_description"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, PropertyClaim)
        assert test_entry.name == test_name
        assert test_entry.short_description == test_desc
        # test one-step relation
        assert isinstance(test_entry.goal, TopLevelNormativeGoal)
        # test two-step relation
        assert isinstance(test_entry.goal.assurance_case, AssuranceCase)


class EvidenceCase(TestCase):
    """
    creates an Evidence object and tests foreign key and
    whether the created title matches the expected title
    """

    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE1_INFO)
        goal = TopLevelNormativeGoal.objects.create(**GOAL_INFO)
        goal.assurance_case = case
        pclaim = PropertyClaim.objects.create(**PROPERTYCLAIM1_INFO)
        pclaim.goal = goal
        evidence = Evidence.objects.create(**EVIDENCE1_INFO_NO_ID)
        evidence.property_claim.set([pclaim])
        return evidence

    def test_evidence_creation(self):
        test_name = EVIDENCE1_INFO_NO_ID["name"]
        test_desc = EVIDENCE1_INFO_NO_ID["short_description"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, Evidence)
        assert test_entry.name == test_name
        assert test_entry.short_description == test_desc
        # test one-step relation


class UserCase(TestCase):
    """
    creates an EAPUser object
    """

    def create_test_entry(self):
        return EAPUser.objects.create(**USER1_INFO)

    def test_user_creation(self):
        test_username = USER1_INFO["username"]
        test_email = USER1_INFO["email"]
        test_password = USER1_INFO["password"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, EAPUser)
        assert test_entry.username == test_username
        assert test_entry.email == test_email
        assert test_entry.password == test_password


class GroupCase(TestCase):
    """
    creates an EAPGroup object
    """

    def create_test_entry(self):
        case = AssuranceCase.objects.create(**CASE1_INFO)
        user = EAPUser.objects.create(**USER1_INFO)
        group = EAPGroup.objects.create(**GROUP1_INFO, owner=user)
        group.editable_cases.set([case])
        return group

    def test_group_creation(self):
        test_name = GROUP1_INFO["name"]
        test_username = USER1_INFO["username"]
        test_casename = CASE1_INFO["name"]
        test_entry = self.create_test_entry()
        assert isinstance(test_entry, EAPGroup)
        assert test_entry.name == test_name
        assert isinstance(test_entry.owner, EAPUser)
        assert test_entry.owner.username == test_username
        assert len(test_entry.editable_cases.get_queryset()) == 1
        assert isinstance(test_entry.editable_cases.get_queryset()[0], AssuranceCase)
        assert test_entry.editable_cases.get_queryset()[0].name == test_casename
        assert len(test_entry.viewable_cases.get_queryset()) == 0
