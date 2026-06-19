#!/usr/bin/env bash
# Pre-commit hook: run integration tests if PostgreSQL is available.
# Skips gracefully when Docker PostgreSQL is not running.

if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo "⚠ Skipping integration tests — PostgreSQL not running on port 5432"
  echo "  Start it with: docker-compose -f docker-compose.local.yml up -d tea_postgres"
  exit 0
fi

pnpm run test:integration
