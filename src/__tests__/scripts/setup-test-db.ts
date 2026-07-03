// globalSetup for integration tests.
//
// Gives each vitest fork-pool worker its own throwaway Postgres database
// cloned from a migrated template, instead of every worker sharing one
// `tea_test` database (see the design note linked from the issue for the
// full rationale). Sequence, every run:
//
//   1. Force-drop any stray `tea_test_w*` databases left by a prior run
//      (a crashed run leaves open connections; FORCE terminates them, which
//      is what eliminates the deadlock-on-shared-TRUNCATE failure mode).
//   2. Create the `tea_test_template` database if it doesn't exist yet, and
//      apply migrations to it (idempotent — safe to run every time).
//   3. Clone `tea_test_w1..wN` from the template, SEQUENTIALLY (Postgres
//      does not allow concurrent `CREATE DATABASE … TEMPLATE` against the
//      same source database).
//
// Teardown drops the worker databases (the template is left in place so the
// next run doesn't pay for a fresh clone slot / re-migrate from scratch).
import { execSync } from "node:child_process";
import path from "node:path";
import { Pool } from "pg";
import {
	INTEGRATION_TEST_ADMIN_DATABASE_URL,
	INTEGRATION_TEST_TEMPLATE_DATABASE,
	INTEGRATION_TEST_WORKER_COUNT,
	INTEGRATION_TEST_WORKER_DATABASE_PATTERN,
	workerDatabaseName,
} from "./test-db-config";

// Resolve project root from this file's location (src/__tests__/scripts/)
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");

function databaseUrlFor(databaseName: string): string {
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${databaseName}`;
	return url.toString();
}

async function databaseExists(
	adminPool: Pool,
	databaseName: string
): Promise<boolean> {
	const result = await adminPool.query(
		"SELECT 1 FROM pg_database WHERE datname = $1",
		[databaseName]
	);
	return (result.rowCount ?? 0) > 0;
}

/** Force-terminates connections and drops the database. Requires Postgres 13+ (FORCE). */
async function forceDropDatabase(
	adminPool: Pool,
	databaseName: string
): Promise<void> {
	// Identifiers can't be parameterised; only ever called with names that have
	// already been matched against INTEGRATION_TEST_WORKER_DATABASE_PATTERN or
	// the fixed template constant, so this is not building DDL from user input.
	await adminPool.query(
		`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`
	);
}

/** Drops every database matching the worker-database naming scheme, whatever N was last run with. */
async function dropAllWorkerDatabases(adminPool: Pool): Promise<void> {
	const result = await adminPool.query<{ datname: string }>(
		"SELECT datname FROM pg_database WHERE datname ~ '^tea_test_w[0-9]+$'"
	);
	for (const row of result.rows) {
		if (!INTEGRATION_TEST_WORKER_DATABASE_PATTERN.test(row.datname)) {
			// Defence in depth: the SQL regex above should already guarantee this.
			continue;
		}
		console.log(`Force-dropping stray database ${row.datname}`);
		await forceDropDatabase(adminPool, row.datname);
	}
}

async function ensureTemplateDatabase(adminPool: Pool): Promise<void> {
	const exists = await databaseExists(
		adminPool,
		INTEGRATION_TEST_TEMPLATE_DATABASE
	);
	if (!exists) {
		await adminPool.query(
			`CREATE DATABASE "${INTEGRATION_TEST_TEMPLATE_DATABASE}"`
		);
		console.log(`Created ${INTEGRATION_TEST_TEMPLATE_DATABASE} database`);
	}

	// Idempotent — re-applying already-applied migrations is a no-op, so this
	// also self-heals a template that's missing migrations added since it was
	// first created.
	execSync("npx prisma migrate deploy --schema=prisma/schema.prisma", {
		env: {
			...process.env,
			DATABASE_URL: databaseUrlFor(INTEGRATION_TEST_TEMPLATE_DATABASE),
		},
		stdio: "pipe",
		cwd: PROJECT_ROOT,
	});
	console.log(`Migrations applied to ${INTEGRATION_TEST_TEMPLATE_DATABASE}`);
}

async function createWorkerDatabases(adminPool: Pool): Promise<void> {
	// Sequential on purpose: Postgres refuses concurrent `CREATE DATABASE …
	// TEMPLATE` calls against the same source ("source database is being
	// accessed by other users"), so cloning must happen one at a time here in
	// global setup rather than letting workers self-clone.
	for (let poolId = 1; poolId <= INTEGRATION_TEST_WORKER_COUNT; poolId++) {
		const name = workerDatabaseName(poolId);
		await adminPool.query(
			`CREATE DATABASE "${name}" TEMPLATE "${INTEGRATION_TEST_TEMPLATE_DATABASE}"`
		);
		console.log(`Created ${name} database from template`);
	}
}

export async function setup() {
	const adminPool = new Pool({
		connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
	});

	try {
		await dropAllWorkerDatabases(adminPool);
		await ensureTemplateDatabase(adminPool);
		await createWorkerDatabases(adminPool);
	} catch (error) {
		await adminPool.end();
		throw error;
	}

	return async function teardown() {
		try {
			await dropAllWorkerDatabases(adminPool);
		} finally {
			await adminPool.end();
		}
	};
}
