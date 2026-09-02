// Shared constants for the per-worker integration test database scheme.
// Single source of truth so the worker cap can't drift between the vitest
// workspace config (which sets the fork pool size) and the global setup
// script (which must create exactly that many worker databases).

/**
 * Number of parallel vitest forks the integration project is allowed to run.
 * Also the number of `tea_test_p<pid>_w*` worker databases created in
 * globalSetup for a given invocation. Connection budget: each worker opens
 * its own Prisma pool (default 10) plus a 1-connection cleanup pool, so N=4
 * costs ~44 connections against a default `max_connections` of 100. Tune
 * only with measurement, and keep this the single place both files read
 * from.
 */
export const INTEGRATION_TEST_WORKER_COUNT = 4;

/**
 * Admin connection — guaranteed to exist, used only to issue database
 * create/drop DDL. Defaults to the dedicated, throwaway `postgres-test`
 * container in docker-compose.local.yml (port 5433, fsync=off — see that
 * file's comment for why the integration suite gets its own Postgres rather
 * than sharing the crash-safe dev one on 5432). CI overrides this via the
 * `INTEGRATION_TEST_ADMIN_DATABASE_URL` env var (build.yaml) to keep
 * pointing at its single, already test-only service container instead.
 */
export const INTEGRATION_TEST_ADMIN_DATABASE_URL =
	process.env.INTEGRATION_TEST_ADMIN_DATABASE_URL ??
	"postgresql://tea_user:tea_password@localhost:5433/tea_test_admin";

/** Migrated template that every worker database is cloned from. */
export const INTEGRATION_TEST_TEMPLATE_DATABASE = "tea_test_template";

/** Prefix for per-worker throwaway databases, before the invocation/worker suffix. */
const INTEGRATION_TEST_WORKER_DATABASE_PREFIX = "tea_test_p";

/**
 * Matches exactly the worker databases this scheme owns —
 * `tea_test_p<invocationId>_w<poolId>`, e.g. `tea_test_p48213_w2`. Used for
 * force-drop, the stray-database sweep, and assertions. Capture groups let
 * callers recover the invocation id and worker id from a matched name (see
 * `parseWorkerDatabaseName`) — group order must stay `(invocationId)(poolId)`.
 */
export const INTEGRATION_TEST_WORKER_DATABASE_PATTERN =
	/^tea_test_p([0-9]+)_w([0-9]+)$/;

/**
 * The environment variable that carries this vitest invocation's identity
 * (its root process's PID) from globalSetup, where it is first computed, to
 * every worker fork, where `setup.integration.tsx` reads it to build the
 * same worker-database name globalSetup already created. Node's
 * `child_process.fork` (vitest's "forks" pool) inherits `process.env` from
 * the process that calls it, and globalSetup sets this before workers are
 * spawned — see `setup-test-db.ts` for the write side and the acceptance-run
 * evidence on the issue for verification that the inheritance holds.
 */
const INTEGRATION_TEST_INVOCATION_ID_ENV_VAR = "INTEGRATION_TEST_INVOCATION_ID";

/** Matches a bare PID — used to validate `INTEGRATION_TEST_INVOCATION_ID_ENV_VAR`. */
const NUMERIC_PID_PATTERN = /^[0-9]+$/;

/**
 * Reads the current invocation id set by globalSetup. Fails loudly (rather
 * than silently falling back to a shared/default name, which is exactly the
 * bug this scheme fixes) if it's missing or not a bare PID.
 */
export function currentInvocationId(): string {
	const id = process.env[INTEGRATION_TEST_INVOCATION_ID_ENV_VAR];
	if (!(id && NUMERIC_PID_PATTERN.test(id))) {
		throw new Error(
			`${INTEGRATION_TEST_INVOCATION_ID_ENV_VAR} must be set to a numeric PID before worker database names can be resolved (expected setup-test-db.ts's globalSetup to set it before any worker process starts), got ${JSON.stringify(id)}`
		);
	}
	return id;
}

/** Sets the invocation id env var — called once, by globalSetup, before workers are spawned. */
export function setInvocationId(id: string | number): void {
	process.env[INTEGRATION_TEST_INVOCATION_ID_ENV_VAR] = String(id);
}

/**
 * Validates and formats a vitest worker/pool id into its worker database
 * name, scoped to the current invocation (`currentInvocationId()`, or an
 * explicit override for globalSetup's own use before workers exist). Rejects
 * a pool id outside `1..INTEGRATION_TEST_WORKER_COUNT` so a bad or unset
 * `VITEST_POOL_ID` fails loudly here, naming the bad value, instead of
 * surfacing later as an opaque "database does not exist" from pg.
 */
export function workerDatabaseName(
	poolId: string | number,
	invocationId: string = currentInvocationId()
): string {
	const id = typeof poolId === "number" ? poolId : Number.parseInt(poolId, 10);
	if (!Number.isInteger(id) || id < 1 || id > INTEGRATION_TEST_WORKER_COUNT) {
		throw new Error(
			`Invalid vitest worker id ${JSON.stringify(poolId)}: expected an integer between 1 and ${INTEGRATION_TEST_WORKER_COUNT} (INTEGRATION_TEST_WORKER_COUNT), got ${id}`
		);
	}
	return `${INTEGRATION_TEST_WORKER_DATABASE_PREFIX}${invocationId}_w${id}`;
}

/** Recovers `{ invocationId, poolId }` from a worker database name, or `null` if it doesn't match. */
export function parseWorkerDatabaseName(
	databaseName: string
): { invocationId: string; poolId: number } | null {
	const match = INTEGRATION_TEST_WORKER_DATABASE_PATTERN.exec(databaseName);
	if (!(match?.[1] && match[2])) {
		return null;
	}
	return { invocationId: match[1], poolId: Number.parseInt(match[2], 10) };
}
