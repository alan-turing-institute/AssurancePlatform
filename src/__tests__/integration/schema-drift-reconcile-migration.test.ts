/**
 * Pins the reconciliation migration
 * (`prisma/migrations/20260923000000_reconcile_schema_drift`) that fixes
 * AP-QA-004: a freshly migrated database used to differ from
 * `prisma/schema.prisma` in four places (missing `pattern_elements.context`,
 * two missing foreign keys, and a stray database default on
 * `published_assurance_cases.id`).
 *
 * Same technique as `publishing-schema-migration.test.ts`: drives
 * `prisma migrate deploy` (and here, `prisma migrate diff`) directly against
 * its own throwaway database and its own COPY of the migrations directory —
 * never the real `prisma/migrations/`, and never the shared
 * `tea_test_w*`/`tea_test_template` databases — safe to run alongside the
 * rest of the parallel integration suite.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { INTEGRATION_TEST_ADMIN_DATABASE_URL } from "../scripts/test-db-config";

// src/__tests__/integration/ -> project root is three levels up.
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const REAL_MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations");
const RECONCILE_MIGRATION_NAME = "20260923000000_reconcile_schema_drift";
// The migration immediately before the reconciliation migration — used to
// reach the "before" state that still allows an orphaned deleted_by_id /
// resolved_by_id to be inserted (both columns are unconstrained pre-fix).
const LAST_MIGRATION_BEFORE_RECONCILE =
	"20260916000000_add_module_reference_dangling";

function allMigrationNames(): string[] {
	return fs
		.readdirSync(REAL_MIGRATIONS_DIR)
		.filter((name) => name !== "migration_lock.toml")
		.sort();
}

function scratchDbName(): string {
	return `tea_test_drift_reconcile_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function scratchDatabaseUrl(dbName: string): string {
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${dbName}`;
	return url.toString();
}

/** Copies every migration folder in `names` from the real migrations dir into the tmp copy. */
function copyMigrations(tmpDir: string, names: string[]): void {
	for (const name of names) {
		fs.cpSync(
			path.join(REAL_MIGRATIONS_DIR, name),
			path.join(tmpDir, "prisma/migrations", name),
			{ recursive: true }
		);
	}
}

function setUpTmpProject(tmpDir: string): void {
	fs.mkdirSync(path.join(tmpDir, "prisma/migrations"), { recursive: true });
	fs.copyFileSync(
		path.join(REAL_MIGRATIONS_DIR, "migration_lock.toml"),
		path.join(tmpDir, "prisma/migrations/migration_lock.toml")
	);
	fs.copyFileSync(
		path.join(PROJECT_ROOT, "prisma/schema.prisma"),
		path.join(tmpDir, "prisma/schema.prisma")
	);
	// Minimal prisma.config.ts: same shape as the real one, pointed at this
	// tmp copy's own schema/migrations, relative to `cwd: tmpDir` below.
	fs.writeFileSync(
		path.join(tmpDir, "prisma.config.ts"),
		[
			'import { defineConfig, env } from "prisma/config";',
			"",
			"export default defineConfig({",
			'	schema: "prisma/schema.prisma",',
			'	migrations: { path: "prisma/migrations" },',
			'	datasource: { url: env("DATABASE_URL") },',
			"});",
			"",
		].join("\n")
	);
}

function runMigrateDeploy(tmpDir: string, dbUrl: string): void {
	execFileSync("npx", ["prisma", "migrate", "deploy"], {
		cwd: tmpDir,
		env: { ...process.env, DATABASE_URL: dbUrl },
		stdio: "pipe",
	});
}

/** Runs `prisma migrate diff --exit-code`, returning its exit code rather than throwing on non-zero. */
function runMigrateDiffExitCode(tmpDir: string, dbUrl: string): number {
	try {
		execFileSync(
			"npx",
			[
				"prisma",
				"migrate",
				"diff",
				"--from-config-datasource",
				"--to-schema=prisma/schema.prisma",
				"--exit-code",
			],
			{
				cwd: tmpDir,
				env: { ...process.env, DATABASE_URL: dbUrl },
				stdio: "pipe",
			}
		);
		return 0;
	} catch (error) {
		const status = (error as { status: number | null }).status;
		return status ?? 1;
	}
}

async function dropDatabaseWithRetries(dbName: string): Promise<void> {
	const maxAttempts = 3;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		try {
			await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
			return;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		} finally {
			await adminPool.end();
		}
	}
}

const tmpDirs: string[] = [];
const dbNames: string[] = [];

describe("reconcile-schema-drift migration", () => {
	afterAll(async () => {
		await Promise.all(dbNames.map((name) => dropDatabaseWithRetries(name)));
		for (const dir of tmpDirs) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}, 60_000);

	it("migrating a fresh database to HEAD leaves no drift against schema.prisma", async () => {
		const dbName = scratchDbName();
		const tmpDir = path.join(
			PROJECT_ROOT,
			".tmp",
			`drift-reconcile-head-${randomUUID()}`
		);
		dbNames.push(dbName);
		tmpDirs.push(tmpDir);

		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		await adminPool.query(`CREATE DATABASE "${dbName}"`);
		await adminPool.end();

		setUpTmpProject(tmpDir);
		copyMigrations(tmpDir, allMigrationNames());
		const dbUrl = scratchDatabaseUrl(dbName);
		runMigrateDeploy(tmpDir, dbUrl);

		expect(runMigrateDiffExitCode(tmpDir, dbUrl)).toBe(0);
	}, 60_000);

	it("clears orphaned deleted_by_id / resolved_by_id and adds both foreign keys, without failing on pre-existing orphans", async () => {
		const dbName = scratchDbName();
		const tmpDir = path.join(
			PROJECT_ROOT,
			".tmp",
			`drift-reconcile-orphans-${randomUUID()}`
		);
		dbNames.push(dbName);
		tmpDirs.push(tmpDir);

		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		await adminPool.query(`CREATE DATABASE "${dbName}"`);
		await adminPool.end();

		setUpTmpProject(tmpDir);
		const migrationsBeforeReconcile = allMigrationNames().filter(
			(name) => name !== RECONCILE_MIGRATION_NAME
		);
		copyMigrations(tmpDir, migrationsBeforeReconcile);
		const dbUrl = scratchDatabaseUrl(dbName);
		runMigrateDeploy(tmpDir, dbUrl);
		expect(migrationsBeforeReconcile.at(-1)).toBe(
			LAST_MIGRATION_BEFORE_RECONCILE
		);

		const scratchPool = new Pool({ connectionString: dbUrl });
		try {
			const userId = randomUUID();
			const caseId = randomUUID();
			const commentId = randomUUID();
			const orphanUserId = randomUUID();

			await scratchPool.query(
				`INSERT INTO users (id, email, username, password_algorithm, auth_provider, created_at, updated_at)
						 VALUES ($1, $2, $3, 'argon2id', 'LOCAL', now(), now())`,
				[
					userId,
					`drift-orphan-${userId}@example.com`,
					`driftorphan${userId.slice(0, 8)}`,
				]
			);
			await scratchPool.query(
				`INSERT INTO assurance_cases
						 (id, name, description, created_by_id, mode, color_profile, is_demo, layout_direction, created_at, updated_at, published, publish_status, deleted_by_id)
						 VALUES ($1, 'Orphan-deleter case', 'desc', $2, 'STANDARD', 'default', false, 'TB', now(), now(), false, 'DRAFT', $3)`,
				[caseId, userId, orphanUserId]
			);
			await scratchPool.query(
				`INSERT INTO comments (id, content, author_id, created_at, updated_at, resolved_by_id)
						 VALUES ($1, 'orphan-resolved comment', $2, now(), now(), $3)`,
				[commentId, userId, orphanUserId]
			);

			// Reconciliation migration must apply cleanly even though both rows
			// above reference a user id (orphanUserId) that does not exist.
			copyMigrations(tmpDir, [RECONCILE_MIGRATION_NAME]);
			runMigrateDeploy(tmpDir, dbUrl);

			const caseRow = await scratchPool.query<{
				deleted_by_id: string | null;
			}>("SELECT deleted_by_id FROM assurance_cases WHERE id = $1", [caseId]);
			expect(caseRow.rows[0]?.deleted_by_id).toBeNull();

			const commentRow = await scratchPool.query<{
				resolved_by_id: string | null;
			}>("SELECT resolved_by_id FROM comments WHERE id = $1", [commentId]);
			expect(commentRow.rows[0]?.resolved_by_id).toBeNull();

			const constraints = await scratchPool.query<{ conname: string }>(
				`SELECT conname FROM pg_constraint
						 WHERE conname IN ('assurance_cases_deleted_by_id_fkey', 'comments_resolved_by_id_fkey')`
			);
			expect(constraints.rows.map((row) => row.conname).sort()).toEqual([
				"assurance_cases_deleted_by_id_fkey",
				"comments_resolved_by_id_fkey",
			]);
		} finally {
			await scratchPool.end();
		}
	}, 60_000);
});
