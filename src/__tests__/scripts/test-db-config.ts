// Shared constants for the per-worker integration test database scheme.
// Single source of truth so the worker cap can't drift between the vitest
// workspace config (which sets the fork pool size) and the global setup
// script (which must create exactly that many worker databases).

/**
 * Number of parallel vitest forks the integration project is allowed to run.
 * Also the number of `tea_test_w*` worker databases created in globalSetup.
 * Connection budget: each worker opens its own Prisma pool (default 10) plus
 * a 1-connection cleanup pool, so N=4 costs ~44 connections against a default
 * `max_connections` of 100. Tune only with measurement, and keep this the
 * single place both files read from.
 */
export const INTEGRATION_TEST_WORKER_COUNT = 4;

/** Admin connection — guaranteed to exist, used only to issue DDL (CREATE/DROP DATABASE). */
export const INTEGRATION_TEST_ADMIN_DATABASE_URL =
	"postgresql://tea_user:tea_password@localhost:5432/tea_dev";

/** Migrated template that every worker database is cloned from. */
export const INTEGRATION_TEST_TEMPLATE_DATABASE = "tea_test_template";

/** Prefix for per-worker throwaway databases: `tea_test_w1`, `tea_test_w2`, … */
export const INTEGRATION_TEST_WORKER_DATABASE_PREFIX = "tea_test_w";

/** Matches exactly the worker databases this scheme owns — used for force-drop and assertions. */
export const INTEGRATION_TEST_WORKER_DATABASE_PATTERN = /^tea_test_w[0-9]+$/;

export function workerDatabaseName(poolId: string | number): string {
	return `${INTEGRATION_TEST_WORKER_DATABASE_PREFIX}${poolId}`;
}
