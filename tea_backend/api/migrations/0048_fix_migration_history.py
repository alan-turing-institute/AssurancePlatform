# Generated manually to fix migration inconsistency
from django.db import migrations


def fix_migration_history(apps, schema_editor):
    """
    Fix the migration history inconsistency where account.0001_initial
    was applied before its dependency api.0001_initial.

    This is a no-op data migration that just ensures proper dependency order.
    """
    pass


def reverse_fix(apps, schema_editor):
    """Reverse function (no-op)"""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0047_rename_published_assurance_cases"),
        ("account", "0001_initial"),  # Explicitly depend on the problematic migration
    ]

    operations = [
        migrations.RunPython(fix_migration_history, reverse_fix),
    ]
