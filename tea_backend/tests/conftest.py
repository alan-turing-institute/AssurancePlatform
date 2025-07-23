"""
Pytest configuration and shared fixtures for TEA Platform backend tests.

This module provides:
- Django test database configuration for PostgreSQL
- Common test fixtures
- Test client setup
- Factory setup and utilities
"""

import os

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture(scope="session")
def _django_db_setup():
    """
    Configure test database settings for PostgreSQL.

    Uses PostgreSQL for production parity when available,
    falls back to SQLite for development without PostgreSQL.
    """
    # PostgreSQL configuration for when it's available
    # This will be used in CI/CD and local dev with PostgreSQL
    if "DATABASE_URL" in os.environ or "postgres" in os.environ.get("DATABASE_ENGINE", ""):
        settings.DATABASES["default"] = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DATABASE_NAME", "test_tea_platform"),
            "USER": os.environ.get("DATABASE_USER", "postgres"),
            "PASSWORD": os.environ.get("DATABASE_PASSWORD", "postgres"),
            "HOST": os.environ.get("DATABASE_HOST", "localhost"),
            "PORT": os.environ.get("DATABASE_PORT", "5432"),
            "OPTIONS": {
                "charset": "utf8",
            },
            "TEST": {
                "NAME": "test_tea_platform_test",
            },
        }


@pytest.fixture
def api_client():
    """Provide a DRF API test client."""
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, user):
    """Provide an authenticated API client."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def superuser():
    """Create a test superuser."""
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
    )


@pytest.fixture
def github_user():
    """Create a test user with GitHub OAuth provider."""
    return User.objects.create_user(
        username="githubuser",
        email="github@example.com",
        password="githubpass123",
        auth_provider="github",
        auth_username="githubuser",
    )


@pytest.mark.django_db
class TestDatabaseSetup:
    """Test database configuration and connectivity."""

    def test_database_connection(self):
        """Test that we can connect to the test database."""
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result == (1,)

    def test_database_engine(self):
        """Test that we're using PostgreSQL."""
        assert connection.vendor == "postgresql"
