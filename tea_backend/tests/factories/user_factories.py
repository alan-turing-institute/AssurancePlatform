"""
FactoryBoy factories for user and authentication models.

This module provides factories for creating test data for:
- EAPUser (custom user model)
- EAPGroup (group management)
"""

import factory
from django.contrib.auth import get_user_model

from api.models import EAPGroup
from tests.factories.base import BaseFactory

User = get_user_model()


class EAPGroupFactory(BaseFactory):
    """Factory for creating EAPGroup instances."""

    class Meta:
        model = EAPGroup

    name = factory.Sequence(lambda n: f"Test Group {n}")
    owner = factory.SubFactory("tests.factories.user_factories.EAPUserFactory")

    @factory.post_generation
    def members(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add members to the group after creation."""
        if not create:
            return

        if extracted:
            for member in extracted:
                self.member.add(member)


class EAPUserFactory(BaseFactory):
    """Factory for creating EAPUser instances."""

    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_active = True
    is_staff = False
    is_superuser = False
    auth_provider = "legacy"
    auth_username = factory.LazyAttribute(lambda obj: obj.username)

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):  # noqa: ARG002
        """Set password after user creation."""
        password = extracted or "testpass123"
        obj.set_password(password)
        if create:
            obj.save()

    @factory.post_generation
    def groups(self, create, extracted, **kwargs):  # noqa: ARG002
        """Add user to groups after creation."""
        if not create:
            return

        if extracted:
            for group in extracted:
                self.groups.add(group)


class GitHubEAPUserFactory(EAPUserFactory):
    """Factory for creating EAPUser instances with GitHub OAuth provider."""

    auth_provider = "github"
    auth_username = factory.Sequence(lambda n: f"github_user_{n}")
    username = factory.LazyAttribute(lambda obj: obj.auth_username)


class SuperEAPUserFactory(EAPUserFactory):
    """Factory for creating superuser EAPUser instances."""

    is_superuser = True
    is_staff = True
    username = factory.Sequence(lambda n: f"admin_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")


class StaffEAPUserFactory(EAPUserFactory):
    """Factory for creating staff EAPUser instances."""

    is_staff = True
    username = factory.Sequence(lambda n: f"staff_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")


class InactiveEAPUserFactory(EAPUserFactory):
    """Factory for creating inactive EAPUser instances."""

    is_active = False
    username = factory.Sequence(lambda n: f"inactive_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
