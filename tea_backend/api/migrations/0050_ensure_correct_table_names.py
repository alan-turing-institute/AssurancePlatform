"""
Migration to ensure database tables have correct names.

This migration documents that table renaming from 'eap_' prefix to no prefix
has been handled by the ensure_correct_table_names management command.

The actual renaming is done by the management command, not this migration,
to avoid issues with migration dependencies and to handle various database states.
"""

from django.db import migrations


def ensure_tables_renamed(apps, schema_editor):
    """
    This migration is a no-op because the actual table renaming
    is handled by the ensure_correct_table_names management command
    which runs before migrations in the entrypoint script.

    This migration exists purely for documentation and to ensure
    the migration history reflects this important schema change.
    """
    pass


def reverse_noop(apps, schema_editor):
    """
    Reversal is also a no-op. If you need to reverse the table
    renaming, you would need to manually rename tables back to
    their 'eap_' prefixed versions.
    """
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0049_rename_eap_tables_to_tea"),
    ]

    operations = [
        migrations.RunPython(
            ensure_tables_renamed,
            reverse_noop,
            hints={"model_operations": []},
        ),
    ]
