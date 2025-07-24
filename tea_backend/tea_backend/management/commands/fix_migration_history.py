import sys

from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder


class Command(BaseCommand):
    help = "Fix migration history inconsistencies"

    def handle(self, *args, **options):  # noqa: ARG002
        """
        Fix the specific issue where account.0001_initial is applied
        before its dependency api.0001_initial.
        """
        try:
            # Check if we have the specific issue
            recorder = MigrationRecorder(connection)
            applied_migrations = recorder.applied_migrations()

            account_applied = ("account", "0001_initial") in applied_migrations
            api_applied = ("api", "0001_initial") in applied_migrations

            if account_applied and not api_applied:
                self.stdout.write(
                    self.style.WARNING(
                        "Detected account.0001_initial applied before api.0001_initial"
                    )
                )

                # Record api.0001_initial as fake-applied
                self.stdout.write("Marking api.0001_initial as applied...")
                recorder.record_applied("api", "0001_initial")

                self.stdout.write(self.style.SUCCESS("Migration history fixed!"))
            else:
                self.stdout.write(self.style.SUCCESS("No migration history issues detected"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error fixing migration history: {e}"))
            sys.exit(1)
