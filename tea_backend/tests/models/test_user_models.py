"""
Tests for user and authentication models.

This module provides comprehensive tests for:
- EAPUser model (custom user with GitHub OAuth)
- EAPGroup model (group management and permissions)
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from api.models import EAPGroup
from tests.factories.user_factories import (
    EAPGroupFactory,
    EAPUserFactory,
    GitHubEAPUserFactory,
    InactiveEAPUserFactory,
    StaffEAPUserFactory,
    SuperEAPUserFactory,
)

User = get_user_model()


class TestEAPUserModel(TestCase):
    """Test EAPUser model functionality."""

    def test_should_create_user_with_required_fields(self):
        """Test that EAPUser can be created with minimum required fields."""
        user = EAPUserFactory()

        self.assertIsNotNone(user.id)
        self.assertTrue(user.username.startswith("user_"))
        self.assertIn("@example.com", user.email)
        self.assertTrue(user.is_active)
        self.assertEqual(user.auth_provider, "legacy")

    def test_should_create_user_with_github_oauth(self):
        """Test that EAPUser can be created with GitHub OAuth provider."""
        user = GitHubEAPUserFactory()

        self.assertEqual(user.auth_provider, "github")
        self.assertTrue(user.auth_username.startswith("github_user_"))
        self.assertEqual(user.username, user.auth_username)

    def test_should_create_superuser(self):
        """Test that superuser EAPUser has correct permissions."""
        user = SuperEAPUserFactory()

        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)

    def test_should_create_staff_user(self):
        """Test that staff EAPUser has correct permissions."""
        user = StaffEAPUserFactory()

        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_active)

    def test_should_create_inactive_user(self):
        """Test that inactive EAPUser is properly configured."""
        user = InactiveEAPUserFactory()

        self.assertFalse(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_should_set_password_correctly(self):
        """Test that password is properly hashed and validated."""
        user = EAPUserFactory(password="custom_password")

        self.assertTrue(user.check_password("custom_password"))
        self.assertFalse(user.check_password("wrong_password"))
        # Ensure password is hashed
        self.assertNotEqual(user.password, "custom_password")

    def test_should_have_string_representation(self):
        """Test EAPUser string representation."""
        user = EAPUserFactory(username="testuser")

        self.assertEqual(str(user), "testuser")

    def test_should_require_unique_username(self):
        """Test that usernames must be unique."""
        EAPUserFactory(username="duplicate")

        with self.assertRaises(IntegrityError):
            EAPUserFactory(username="duplicate")

    def test_should_allow_duplicate_emails(self):
        """Test that email addresses are not required to be unique by default."""
        user1 = EAPUserFactory(email="test@example.com")
        user2 = EAPUserFactory(email="test@example.com")

        self.assertEqual(user1.email, user2.email)
        self.assertNotEqual(user1.username, user2.username)

    def test_should_handle_empty_auth_provider(self):
        """Test EAPUser with empty auth provider defaults to legacy."""
        user = EAPUserFactory(auth_provider="")

        self.assertEqual(user.auth_provider, "")
        # Test it can be updated
        user.auth_provider = "github"
        user.save()
        user.refresh_from_db()
        self.assertEqual(user.auth_provider, "github")

    def test_should_handle_empty_auth_username(self):
        """Test EAPUser with empty auth username."""
        user = EAPUserFactory(auth_username="")

        self.assertEqual(user.auth_username, "")
        # Test it can be updated
        user.auth_username = "github_user"
        user.save()
        user.refresh_from_db()
        self.assertEqual(user.auth_username, "github_user")

    def test_should_allow_multiple_auth_providers(self):
        """Test that users can have different auth providers."""
        legacy_user = EAPUserFactory(auth_provider="legacy")
        github_user = GitHubEAPUserFactory(auth_provider="github")

        self.assertEqual(legacy_user.auth_provider, "legacy")
        self.assertEqual(github_user.auth_provider, "github")

    def test_should_handle_long_auth_provider_name(self):
        """Test EAPUser with maximum length auth provider."""
        long_provider = "a" * 200  # Max length is 200
        user = EAPUserFactory(auth_provider=long_provider)

        self.assertEqual(user.auth_provider, long_provider)

    def test_should_handle_long_auth_username(self):
        """Test EAPUser with maximum length auth username."""
        long_username = "a" * 200  # Max length is 200
        user = EAPUserFactory(auth_username=long_username)

        self.assertEqual(user.auth_username, long_username)


class TestEAPGroupModel(TestCase):
    """Test EAPGroup model functionality."""

    def test_should_create_group_with_owner(self):
        """Test that EAPGroup can be created with an owner."""
        group = EAPGroupFactory()

        self.assertIsNotNone(group.id)
        self.assertTrue(group.name.startswith("Test Group"))
        self.assertIsNotNone(group.owner)
        self.assertIsNotNone(group.created_date)

    def test_should_have_string_representation(self):
        """Test EAPGroup string representation."""
        group = EAPGroupFactory(name="Test Group")

        self.assertEqual(str(group), "Test Group")

    def test_should_allow_members_to_be_added(self):
        """Test that members can be added to a group."""
        group = EAPGroupFactory()
        user1 = EAPUserFactory()
        user2 = EAPUserFactory()

        group.member.add(user1, user2)

        self.assertEqual(group.member.count(), 2)
        self.assertIn(user1, group.member.all())
        self.assertIn(user2, group.member.all())

    def test_should_allow_members_to_be_removed(self):
        """Test that members can be removed from a group."""
        user1 = EAPUserFactory()
        user2 = EAPUserFactory()
        group = EAPGroupFactory(members=[user1, user2])

        group.member.remove(user1)

        self.assertEqual(group.member.count(), 1)
        self.assertNotIn(user1, group.member.all())
        self.assertIn(user2, group.member.all())

    def test_should_delete_group_when_owner_deleted(self):
        """Test that group is deleted when owner is deleted."""
        owner = EAPUserFactory()
        group = EAPGroupFactory(owner=owner)
        group_id = group.id

        owner.delete()

        self.assertFalse(EAPGroup.objects.filter(id=group_id).exists())

    def test_should_allow_same_user_as_owner_and_member(self):
        """Test that a user can be both owner and member of a group."""
        owner = EAPUserFactory()
        group = EAPGroupFactory(owner=owner)

        group.member.add(owner)

        self.assertEqual(group.owner, owner)
        self.assertIn(owner, group.member.all())

    def test_should_maintain_member_relationships_after_owner_change(self):
        """Test that member relationships persist when owner changes."""
        original_owner = EAPUserFactory()
        new_owner = EAPUserFactory()
        member = EAPUserFactory()
        group = EAPGroupFactory(owner=original_owner, members=[member])

        group.owner = new_owner
        group.save()

        self.assertEqual(group.owner, new_owner)
        self.assertIn(member, group.member.all())

    def test_should_handle_group_without_members(self):
        """Test that a group can exist without any members."""
        group = EAPGroupFactory()

        self.assertEqual(group.member.count(), 0)
        self.assertIsNotNone(group.owner)

    def test_should_allow_multiple_groups_same_owner(self):
        """Test that a user can own multiple groups."""
        owner = EAPUserFactory()
        group1 = EAPGroupFactory(owner=owner, name="Group 1")
        group2 = EAPGroupFactory(owner=owner, name="Group 2")

        self.assertEqual(group1.owner, owner)
        self.assertEqual(group2.owner, owner)
        self.assertEqual(owner.owned_groups.count(), 2)

    def test_should_track_user_group_memberships(self):
        """Test that user's group memberships are tracked correctly."""
        user = EAPUserFactory()
        group1 = EAPGroupFactory()
        group2 = EAPGroupFactory()

        group1.member.add(user)
        group2.member.add(user)

        self.assertEqual(user.all_groups.count(), 2)
        self.assertIn(group1, user.all_groups.all())
        self.assertIn(group2, user.all_groups.all())


class TestUserGroupIntegration(TestCase):
    """Test integration between EAPUser and EAPGroup models."""

    def test_should_handle_complex_group_membership_scenario(self):
        """Test complex scenario with multiple users and groups."""
        # Create users
        owner = EAPUserFactory()
        admin = EAPUserFactory()
        member1 = EAPUserFactory()
        member2 = EAPUserFactory()

        # Create groups
        admin_group = EAPGroupFactory(owner=owner, name="Administrators")
        user_group = EAPGroupFactory(owner=admin, name="Users")

        # Set up memberships
        admin_group.member.add(admin)
        user_group.member.add(member1, member2, admin)

        # Verify relationships
        self.assertEqual(admin.all_groups.count(), 2)
        self.assertEqual(member1.all_groups.count(), 1)
        self.assertEqual(member2.all_groups.count(), 1)
        self.assertEqual(owner.owned_groups.count(), 1)
        self.assertEqual(admin.owned_groups.count(), 1)

    def test_should_handle_user_deletion_with_group_memberships(self):
        """Test that user deletion properly handles group memberships."""
        owner = EAPUserFactory()
        member = EAPUserFactory()
        group = EAPGroupFactory(owner=owner, members=[member])

        member_id = member.id
        member.delete()

        # Group should still exist but member should be removed
        group.refresh_from_db()
        self.assertEqual(group.member.count(), 0)
        self.assertFalse(User.objects.filter(id=member_id).exists())
