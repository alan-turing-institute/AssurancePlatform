#!/bin/sh
set -e

echo "Running database migrations..."

# Capture migration output (temporarily disable set -e to capture exit code)
set +e
MIGRATE_OUTPUT=$(npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1)
MIGRATE_EXIT_CODE=$?
set -e

if [ $MIGRATE_EXIT_CODE -eq 0 ]; then
    echo "$MIGRATE_OUTPUT"
    echo "Migrations applied successfully."
elif echo "$MIGRATE_OUTPUT" | grep -q "P3005"; then
    # Baseline scenario: database has tables but no _prisma_migrations table
    # This happens when migrating from Django to Prisma for the first time
    echo "Detected baseline scenario (existing database without Prisma migrations)."
    echo "Creating _prisma_migrations table and running initial migration..."

    # Create the Prisma migrations tracking table using Prisma db execute
    npx prisma db execute --schema=./prisma/schema.prisma --stdin <<'MIGRATIONS_TABLE'
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
    npx prisma db execute --schema=./prisma/schema.prisma --file=./prisma/migrations/20251206000000_initial_schema/migration.sql

    # Mark the migration as applied
    npx prisma migrate resolve --applied "20251206000000_initial_schema" --schema=./prisma/schema.prisma

    echo "Baseline migration completed successfully."
else
    echo "$MIGRATE_OUTPUT"
    echo "Migration failed with unexpected error."
    exit 1
fi

echo "Starting Next.js server..."
exec node server.js
