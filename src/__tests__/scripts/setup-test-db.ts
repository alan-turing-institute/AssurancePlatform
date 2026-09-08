// globalSetup for integration tests.
//
// Gives each vitest fork-pool worker its own throwaway Postgres database
// cloned from a migrated template, instead of every worker sharing one
// `tea_test` database (see the design note linked from the issue for the
// full rationale). Worker database names are scoped to THIS invocation
// (`tea_test_p<pid>_w<n>`, pid = this process's own pid) so that two
// overlapping `vitest run` invocations against the same Postgres never
// collide on the same database names — see the issue's reproduction
// findings (2026-08-12) for the collision this replaces. Sequence, every
// run:
//
//   1. Force-drop stray `tea_test_p*_w*` databases left by a prior run —
//      but ONLY those whose embedded pid is no longer a running process.
//      A crashed run leaves its worker databases behind; a concurrently
//      RUNNING invocation's databases must survive this sweep, which is
//      exactly what the old fixed-name scheme got wrong.
//   2. Ensure the `tea_test_template` database exists, is migrated to HEAD,
//      and is not contaminated by a migration applied on another branch
//      that isn't on disk here (see `ensureTemplateDatabase`).
//   3. Clone this invocation's `tea_test_p<pid>_w1..wN` from the template,
//      SEQUENTIALLY (Postgres does not allow concurrent
//      `CREATE DATABASE … TEMPLATE` against the same source database).
//
// Teardown drops only THIS invocation's worker databases (never a blanket
// sweep — that was the collision bug) — the template is left in place so
// the next run doesn't pay for a fresh clone slot / re-migrate from scratch.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
	INTEGRATION_TEST_ADMIN_DATABASE_URL,
	INTEGRATION_TEST_TEMPLATE_DATABASE,
	INTEGRATION_TEST_WORKER_COUNT,
	INTEGRATION_TEST_WORKER_DATABASE_PATTERN,
	parseWorkerDatabaseName,
	setInvocationId,
	workerDatabaseName,
} from "./test-db-config";

// Resolve project root from this file's location (src/__tests__/scripts/)
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations");

/** Postgres error code for "relation does not exist" — a fresh, unmigrated database. */
const PG_UNDEFINED_TABLE = "42P01";

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

/**
 * Whether a process with this pid is still running. Used to decide whether a
 * `tea_test_p<pid>_w*` database belongs to a crashed run (safe to force-drop)
 * or a currently-running invocation (must be left alone) — the distinction
 * the old fixed-name scheme couldn't make, which is what let two overlapping
 * invocations destroy each other's databases (see the issue's reproduction
 * findings, 2026-08-12). Runs on the same host as the pid it's checking:
 * both the vitest process and this globalSetup run on the developer/CI
 * machine, not inside the Postgres container, so the pid namespace matches.
 */
function isInvocationProcessAlive(pid: number): boolean {
	try {
		// Signal 0 sends nothing; it only checks the process exists and is
		// signalable. Throws if not.
		process.kill(pid, 0);
		return true;
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ESRCH") {
			return false; // no such process — the invocation that owned it is gone
		}
		// EPERM (exists, but owned by another user) or anything else: we can't
		// prove it's dead, so err on the side of NOT dropping a database that
		// might still be in use.
		return true;
	}
}

/**
 * Startup-only sweep: force-drops worker databases left by crashed runs.
 * Deliberately does NOT touch a database whose embedded invocation pid is
 * still alive — that's what makes this safe to run while another invocation
 * is mid-suite against the same Postgres.
 */
async function dropStrayWorkerDatabases(adminPool: Pool): Promise<void> {
	const result = await adminPool.query<{ datname: string }>(
		"SELECT datname FROM pg_database WHERE datname ~ $1",
		[INTEGRATION_TEST_WORKER_DATABASE_PATTERN.source]
	);
	for (const row of result.rows) {
		const parsed = parseWorkerDatabaseName(row.datname);
		if (!parsed) {
			// Defence in depth: the SQL regex above should already guarantee a match.
			continue;
		}
		const pid = Number.parseInt(parsed.invocationId, 10);
		if (isInvocationProcessAlive(pid)) {
			continue; // belongs to a currently-running invocation — leave it alone
		}
		console.log(
			`Force-dropping stray database ${row.datname} (owning pid ${pid} is not running)`
		);
		await forceDropDatabase(adminPool, row.datname);
	}
}

/**
 * Teardown-only: drops exactly this invocation's own worker databases. Never
 * a blanket sweep by pattern — that's what let two overlapping invocations
 * drop each other's databases under the old fixed-name scheme.
 */
async function dropInvocationWorkerDatabases(
	adminPool: Pool,
	invocationId: string
): Promise<void> {
	for (let poolId = 1; poolId <= INTEGRATION_TEST_WORKER_COUNT; poolId++) {
		const name = workerDatabaseName(poolId, invocationId);
		console.log(`Dropping worker database ${name}`);
		await forceDropDatabase(adminPool, name);
	}
}

/** Migration directory names actually present on disk (excludes `migration_lock.toml`). */
function migrationsOnDisk(): Set<string> {
	return new Set(
		fs
			.readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
	);
}

/** Migration names Prisma has recorded as applied against the template. */
async function appliedTemplateMigrations(): Promise<string[]> {
	const templatePool = new Pool({
		connectionString: databaseUrlFor(INTEGRATION_TEST_TEMPLATE_DATABASE),
	});
	try {
		const result = await templatePool.query<{ migration_name: string }>(
			"SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL"
		);
		return result.rows.map((row) => row.migration_name);
	} catch (error) {
		// Fresh, never-migrated template: the Prisma bookkeeping table doesn't
		// exist yet. Nothing applied, so nothing can be contaminated.
		if ((error as NodeJS.ErrnoException).code === PG_UNDEFINED_TABLE) {
			return [];
		}
		throw error;
	} finally {
		await templatePool.end();
	}
}

/**
 * True if the template has a migration applied that doesn't exist in
 * `prisma/migrations/` on this checkout — i.e. it was migrated forward by a
 * DIFFERENT branch's run (`prisma migrate deploy` only ever moves a database
 * forward, so it can't self-heal an over-applied template). See the issue's
 * cross-branch contamination finding, 2026-08-12.
 */
async function templateIsContaminated(): Promise<boolean> {
	const applied = await appliedTemplateMigrations();
	if (applied.length === 0) {
		return false;
	}
	const onDisk = migrationsOnDisk();
	return applied.some((name) => !onDisk.has(name));
}

async function ensureTemplateDatabase(adminPool: Pool): Promise<void> {
	let exists = await databaseExists(
		adminPool,
		INTEGRATION_TEST_TEMPLATE_DATABASE
	);

	if (exists && (await templateIsContaminated())) {
		console.log(
			`${INTEGRATION_TEST_TEMPLATE_DATABASE} has a migration applied that isn't in prisma/migrations/ on this branch (likely left over from another branch's run) — rebuilding it`
		);
		await forceDropDatabase(adminPool, INTEGRATION_TEST_TEMPLATE_DATABASE);
		exists = false;
	}

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

async function createWorkerDatabases(
	adminPool: Pool,
	invocationId: string
): Promise<void> {
	// Sequential on purpose: Postgres refuses concurrent `CREATE DATABASE …
	// TEMPLATE` calls against the same source ("source database is being
	// accessed by other users"), so cloning must happen one at a time here in
	// global setup rather than letting workers self-clone.
	for (let poolId = 1; poolId <= INTEGRATION_TEST_WORKER_COUNT; poolId++) {
		const name = workerDatabaseName(poolId, invocationId);
		await adminPool.query(
			`CREATE DATABASE "${name}" TEMPLATE "${INTEGRATION_TEST_TEMPLATE_DATABASE}"`
		);
		console.log(`Created ${name} database from template`);
	}
}

export async function setup() {
	// This process's own pid scopes every database name this invocation
	// creates. Set BEFORE anything spawns worker processes, and before
	// process.env is captured for them — `setInvocationId` mutates
	// `process.env`, which vitest's fork-pool workers inherit at spawn time.
	const invocationId = String(process.pid);
	setInvocationId(invocationId);

	const adminPool = new Pool({
		connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
	});

	try {
		await dropStrayWorkerDatabases(adminPool);
		await ensureTemplateDatabase(adminPool);
		await createWorkerDatabases(adminPool, invocationId);
	} catch (error) {
		await adminPool.end();
		throw error;
	}

	return async function teardown() {
		try {
			await dropInvocationWorkerDatabases(adminPool, invocationId);
		} finally {
			await adminPool.end();
		}
	};
}
