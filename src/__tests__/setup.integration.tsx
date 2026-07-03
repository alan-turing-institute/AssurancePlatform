import { Pool } from "pg";
import { afterAll, afterEach } from "vitest";
import { workerDatabaseName } from "./scripts/test-db-config";

// Redirect this worker onto its own throwaway database, cloned from the
// migrated template by globalSetup (setup-test-db.ts). This MUST happen
// before anything in this process imports lib/prisma.ts: that module reads
// DATABASE_URL at import time to build its connection pool, and setup files
// load before test files in each vitest fork — so this override always lands
// first. `VITEST_POOL_ID` is vitest's 1-indexed fork id; it's stable for the
// lifetime of the worker process, so every test file the worker picks up
// shares the same worker-scoped database.
const workerId = process.env.VITEST_POOL_ID ?? "1";
const baseDatabaseUrl = process.env.DATABASE_URL;
if (!baseDatabaseUrl) {
	throw new Error(
		"DATABASE_URL must be set (see the integration project's env in vitest.workspace.ts) before integration setup runs"
	);
}
const workerDatabaseUrl = new URL(baseDatabaseUrl);
workerDatabaseUrl.pathname = `/${workerDatabaseName(workerId)}`;
process.env.DATABASE_URL = workerDatabaseUrl.toString();

// Create a dedicated pool for cleanup (NOT through Prisma)
const cleanupPool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 1,
});

// Truncate all tables after each test
afterEach(async () => {
	const client = await cleanupPool.connect();
	try {
		// Truncate all application tables in one statement with CASCADE
		await client.query(`
      TRUNCATE TABLE
        case_study_images,
        case_study_published_cases,
        published_assurance_cases,
        case_studies,
        release_images,
        release_comments,
        release_snapshots,
        releases,
        comments,
        evidence_links,
        case_images,
        case_type_assignments,
        case_types,
        case_invites,
        case_team_permissions,
        case_permissions,
        plugin_data,
        assurance_elements,
        assurance_cases,
        pattern_permissions,
        pattern_team_permissions,
        pattern_elements,
        argument_patterns,
        team_members,
        teams,
        github_repositories,
        rate_limit_attempts,
        security_audit_logs,
        password_reset_attempts,
        api_tokens,
        integrations,
        plugin_state,
        users
      CASCADE
    `);
	} finally {
		client.release();
	}
});

// Cleanup pool on process exit
afterAll(async () => {
	await cleanupPool.end();
});
