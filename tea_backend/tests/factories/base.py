"""
Base factory classes and common factory utilities.

This module provides base factory classes and shared utilities
for creating consistent test data across all model factories.
"""

import factory
from django.contrib.auth import get_user_model
from faker import Faker

fake = Faker()
User = get_user_model()


class BaseFactory(factory.django.DjangoModelFactory):
    """
    Base factory class with common configuration.

    All model factories should inherit from this class to ensure
    consistent behavior and configuration.
    """

    class Meta:
        abstract = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """Override to handle any special creation logic."""
        return super()._create(model_class, *args, **kwargs)


class UserFactory(BaseFactory):
    """Factory for creating EAPUser instances."""

    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    is_active = True
    auth_provider = "legacy"
    auth_username = factory.LazyAttribute(lambda obj: obj.username)

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):  # noqa: ARG002
        """Set password after user creation."""
        password = extracted or "testpass123"
        obj.set_password(password)
        if create:
            obj.save()


class GitHubUserFactory(UserFactory):
    """Factory for creating users with GitHub OAuth provider."""

    auth_provider = "github"
    auth_username = factory.Sequence(lambda n: f"github_user_{n}")
    username = factory.LazyAttribute(lambda obj: obj.auth_username)


class SuperUserFactory(UserFactory):
    """Factory for creating superuser instances."""

    is_superuser = True
    is_staff = True
    username = factory.Sequence(lambda n: f"admin_{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
