"""
Management command to ensure database tables have correct names.

This command handles the historical rename from 'eap_api' to 'api' by:
1. Detecting actual table names in the database
2. Comparing with Django's expected table names
3. Renaming tables that need it
4. Updating migration history appropriately

This is idempotent and safe to run multiple times.
"""

import logging

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.migrations.recorder import MigrationRecorder

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Ensure database tables have correct names (handles eap_ to api_ rename)"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tables_to_rename: dict[str, str] = {}
        self.migration_to_mark = "0049_rename_eap_tables_to_tea"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be renamed without making changes",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force rename even if migration is already marked as applied",
        )

    def handle(self, **options):
        self.dry_run = options.get("dry_run", False)
        self.force = options.get("force", False)

        try:
            # Get current table names
            current_tables = self.get_current_tables()
            self.stdout.write(f"Found {len(current_tables)} tables in database")

            # Check which tables need renaming
            self.identify_tables_to_rename(current_tables)

            if not self.tables_to_rename:
                self.stdout.write(self.style.SUCCESS("✓ All tables already have correct names"))
                self.ensure_migration_marked_applied()
                return

            # Show what will be renamed
            self.stdout.write(f"\nTables that need renaming: {len(self.tables_to_rename)}")
            for old_name, new_name in sorted(self.tables_to_rename.items()):
                self.stdout.write(f"  {old_name} → {new_name}")

            if self.dry_run:
                self.stdout.write("\nDRY RUN: No changes made")
                return

            # Perform the renames
            self.rename_tables()

            # Mark migration as applied
            self.ensure_migration_marked_applied()

            self.stdout.write(
                self.style.SUCCESS(f"\n✓ Successfully renamed {len(self.tables_to_rename)} tables")
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            raise

    def get_current_tables(self) -> list[str]:
        """Get list of all tables in the database."""
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
            """)
            return [row[0] for row in cursor.fetchall()]

    def identify_tables_to_rename(self, current_tables: list[str]):
        """Identify which tables need to be renamed."""
        # Define expected renames
        expected_renames = {
            # Core model tables
            "eap_api_eapuser": "api_eapuser",
            "eap_api_eapgroup": "api_eapgroup",
            "eap_api_assurancecase": "api_assurancecase",
            "eap_api_toplevelnormativegoal": "api_toplevelnormativegoal",
            "eap_api_context": "api_context",
            "eap_api_strategy": "api_strategy",
            "eap_api_propertyclaim": "api_propertyclaim",
            "eap_api_evidence": "api_evidence",
            "eap_api_comment": "api_comment",
            "eap_api_githubrepository": "api_githubrepository",
            "eap_api_casestudy": "api_casestudy",
            "eap_api_publishedassurancecase": "api_publishedassurancecase",
            "eap_api_assurancecaseimage": "api_assurancecaseimage",
            "eap_api_casestudyfeatureimage": "api_casestudyfeatureimage",
            # Many-to-many relationship tables
            "eap_api_eapuser_groups": "api_eapuser_groups",
            "eap_api_eapuser_user_permissions": "api_eapuser_user_permissions",
            "eap_api_eapgroup_member": "api_eapgroup_member",
            "eap_api_assurancecase_edit_groups": "api_assurancecase_edit_groups",
            "eap_api_assurancecase_review_groups": "api_assurancecase_review_groups",
            "eap_api_assurancecase_view_groups": "api_assurancecase_view_groups",
            "eap_api_evidence_property_claim": "api_evidence_property_claim",
            "eap_api_casestudy_assurance_cases": "api_casestudy_assurance_cases",
            # Websockets app table
            "eap_websockets_assurancecaseconnection": "websockets_assurancecaseconnection",
        }

        for old_name, new_name in expected_renames.items():
            if old_name in current_tables and new_name not in current_tables:
                self.tables_to_rename[old_name] = new_name
            elif old_name in current_tables and new_name in current_tables:
                self.stdout.write(
                    self.style.WARNING(
                        f"Warning: Both {old_name} and {new_name} exist! Manual intervention needed."
                    )
                )

    def rename_tables(self):
        """Perform the actual table renames."""
        self.stdout.write("\nRenaming tables...")

        with transaction.atomic(), connection.cursor() as cursor:
            for old_name, new_name in sorted(self.tables_to_rename.items()):
                try:
                    self.stdout.write(f"  Renaming {old_name} → {new_name}")
                    cursor.execute(f'ALTER TABLE "{old_name}" RENAME TO "{new_name}"')
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"    Failed to rename {old_name}: {e}"))
                    raise

    def ensure_migration_marked_applied(self):
        """Ensure the rename migration is marked as applied."""
        recorder = MigrationRecorder(connection)

        # Check if migration is already recorded
        applied_migrations = recorder.applied_migrations()
        if ("api", self.migration_to_mark) in applied_migrations:
            if not self.force:
                self.stdout.write(f"Migration {self.migration_to_mark} already marked as applied")
                return
            else:
                self.stdout.write("Force flag set, re-marking migration as applied")

        # Check if the migration file exists and mark as applied
        # We're using a simple approach here - just mark the migration as applied
        # without checking for the file, since the migration might not exist yet
        # but we still want to track that the table renaming has been done
        try:
            recorder.record_applied("api", self.migration_to_mark)
            self.stdout.write(
                self.style.SUCCESS(f"✓ Marked migration {self.migration_to_mark} as applied")
            )
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Could not mark migration as applied: {e}"))
