#!/usr/bin/env bash
# Pre-commit hook: run integration tests if the dedicated test Postgres is
# available. Skips gracefully when it's not running — this is a local
# convenience hook, not a CI gate.
#
# Host/port here MUST agree with src/__tests__/scripts/test-db-config.ts's
# INTEGRATION_TEST_ADMIN_DATABASE_URL: same env var, same default (the
# throwaway `postgres-test` container from docker-compose.local.yml, port
# 5433 — NOT dev's `postgres` container on 5432). Before the fsync=off
# change (see the perf/test-db-memory issue) this hook free-rode on dev
# postgres already being up on 5432; the integration suite no longer talks
# to that container, so probing 5432 here would silently skip when only
# postgres-test is up, or wrongly run (and fail) when only dev is up.
set -euo pipefail

DEFAULT_URL="postgresql://tea_user:tea_password@localhost:5433/tea_test_admin"
DB_URL="${INTEGRATION_TEST_ADMIN_DATABASE_URL:-$DEFAULT_URL}"

read -r PG_HOST PG_PORT <<< "$(node -e '
const u = new URL(process.argv[1]);
console.log(u.hostname, u.port || "5432");
' "$DB_URL")"

if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null; then
  echo "⚠ Skipping integration tests — PostgreSQL not running on $PG_HOST:$PG_PORT"
  echo "  Start it with: docker compose -f docker-compose.local.yml up -d postgres-test"
  exit 0
fi

pnpm run test:integration
