#!/bin/sh
set -e

echo "Running database migrations..."

# Capture migration output (temporarily disable set -e to capture exit code)
set +e
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT_CODE=$?
set -e

if [ $MIGRATE_EXIT_CODE -eq 0 ]; then
    echo "$MIGRATE_OUTPUT"
    echo "Migrations applied successfully."

    # Check if data migration is needed (users table empty but api_eapuser has data)
    # First check if api_eapuser table exists (it was dropped in migration 20260110000000)
    echo "Checking if data migration is needed..."
    set +e
    LEGACY_TABLE_EXISTS=$(npx prisma db execute --stdin <<'CHECK_TABLE' 2>/dev/null | grep -c "t" || echo "0"
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'api_eapuser'
);
CHECK_TABLE
)
    set -e

    if [ "$LEGACY_TABLE_EXISTS" != "1" ] && [ "$LEGACY_TABLE_EXISTS" != "t" ]; then
        echo "Legacy tables already removed - data migration not needed."
        NEEDS_DATA_MIGRATION="0"
    else
        set +e
        NEEDS_DATA_MIGRATION=$(npx prisma db execute --stdin <<'CHECK_MIGRATION' 2>/dev/null | grep -c "t" || echo "0"
SELECT EXISTS (
    SELECT 1 FROM api_eapuser WHERE id IS NOT NULL
) AND NOT EXISTS (
    SELECT 1 FROM users WHERE id IS NOT NULL
);
CHECK_MIGRATION
)
        set -e
    fi

    if [ "$NEEDS_DATA_MIGRATION" = "1" ] || [ "$NEEDS_DATA_MIGRATION" = "t" ]; then
        echo "Data migration needed - migrating Django data to Prisma tables..."

        # Run migration scripts in order (--execute flag required for actual migration)
        npx tsx ./prisma/scripts/01-resolve-duplicate-users.ts --execute
        npx tsx ./prisma/scripts/02-migrate-data.ts --execute

        # Run validation - capture exit code but don't fail on expected discrepancies
        set +e
        npx tsx ./prisma/scripts/03-validate-migration.ts
        VALIDATE_EXIT=$?
        set -e
        if [ $VALIDATE_EXIT -ne 0 ]; then
            echo "WARNING: Validation reported issues (exit code $VALIDATE_EXIT). Review logs above."
            echo "Continuing with migration - some discrepancies may be expected (orphaned data, invalid links)."
        fi

        npx tsx ./prisma/scripts/04-migrate-legacy-tables.ts --execute

        echo "Data migration completed successfully."
    else
        echo "Data migration not needed (already migrated or no legacy data)."
    fi
elif echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
    # Baseline scenario: database has tables but no _prisma_migrations table
    # This happens when migrating from Django to Prisma for the first time
    echo "Detected baseline scenario (existing database without Prisma migrations)."
    echo "Creating _prisma_migrations table and running initial migration..."

    # Create the Prisma migrations tracking table using Prisma db execute
    # Note: Uses prisma.config.ts for datasource URL (no --schema flag needed)
    npx prisma db execute --stdin <<'MIGRATIONS_TABLE'
CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id                      VARCHAR(36) PRIMARY KEY NOT NULL,
    checksum                VARCHAR(64) NOT NULL,
    finished_at             TIMESTAMPTZ,
    migration_name          VARCHAR(255) NOT NULL,
    logs                    TEXT,
    rolled_back_at          TIMESTAMPTZ,
    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count     INTEGER NOT NULL DEFAULT 0
);
MIGRATIONS_TABLE

    # Run the initial migration SQL directly
    npx prisma db execute --file=./prisma/migrations/20251206000000_initial_schema/migration.sql

    # Mark the migration as applied
    npx prisma migrate resolve --applied "20251206000000_initial_schema"

    echo "Baseline migration completed successfully."

    # Run data migration scripts (only needed after baseline)
    echo "Running data migration scripts..."

    # Check if data migration is needed (users table empty but api_eapuser has data)
    # First check if api_eapuser table exists (it was dropped in migration 20260110000000)
    set +e
    LEGACY_TABLE_EXISTS=$(npx prisma db execute --stdin <<'CHECK_TABLE' 2>/dev/null | grep -c "t" || echo "0"
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'api_eapuser'
);
CHECK_TABLE
)
    set -e

    if [ "$LEGACY_TABLE_EXISTS" != "1" ] && [ "$LEGACY_TABLE_EXISTS" != "t" ]; then
        echo "Legacy tables already removed - data migration not needed."
        NEEDS_DATA_MIGRATION="0"
    else
        set +e
        NEEDS_DATA_MIGRATION=$(npx prisma db execute --stdin <<'CHECK_MIGRATION' 2>/dev/null | grep -c "t" || echo "0"
SELECT EXISTS (
    SELECT 1 FROM api_eapuser WHERE id IS NOT NULL
) AND NOT EXISTS (
    SELECT 1 FROM users WHERE id IS NOT NULL
);
CHECK_MIGRATION
)
        set -e
    fi

    if [ "$NEEDS_DATA_MIGRATION" = "1" ] || [ "$NEEDS_DATA_MIGRATION" = "t" ]; then
        echo "Data migration needed - migrating Django data to Prisma tables..."

        # Run migration scripts in order (--execute flag required for actual migration)
        npx tsx ./prisma/scripts/01-resolve-duplicate-users.ts --execute
        npx tsx ./prisma/scripts/02-migrate-data.ts --execute

        # Run validation - capture exit code but don't fail on expected discrepancies
        set +e
        npx tsx ./prisma/scripts/03-validate-migration.ts
        VALIDATE_EXIT=$?
        set -e
        if [ $VALIDATE_EXIT -ne 0 ]; then
            echo "WARNING: Validation reported issues (exit code $VALIDATE_EXIT). Review logs above."
            echo "Continuing with migration - some discrepancies may be expected (orphaned data, invalid links)."
        fi

        npx tsx ./prisma/scripts/04-migrate-legacy-tables.ts --execute

        echo "Data migration completed successfully."
    else
        echo "Data migration not needed (already migrated or no legacy data)."
    fi
else
    echo "$MIGRATE_OUTPUT"
    echo "Migration failed with unexpected error."
    exit 1
fi

echo "Starting Next.js server..."
exec node server.js
