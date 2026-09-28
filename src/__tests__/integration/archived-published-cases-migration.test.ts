/**
 * Pins the hand-written migration for this feature
 * (`prisma/migrations/20260928000000_archived_published_cases`): relaxing
 * `published_assurance_cases.assurance_case_id`'s foreign key to
 * `ON DELETE SET NULL` must let a case with a published row be permanently
 * deleted, clearing the link rather than being refused — this is the
 * structural fix that also makes `purgeCase`/`purgeExpiredCases` work
 * (`case-trash-service.test.ts` proves the service-level behaviour; this
 * test proves the constraint itself, at the database level, independent of
 * any application code).
 *
 * Structure only — no `UPDATE`/`DELETE` of existing rows, so unlike
 * `publishing-schema-migration.test.ts` this test has no "before" state to
 * construct; it applies every migration in one pass and checks the result.
 * Same isolation discipline as that file: its own scratch database and its
 * own copy of the migrations directory, safe alongside the parallel
 * integration suite.
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

const scratchDbName = `tea_test_archive_pin_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const tmpDir = path.join(PROJECT_ROOT, ".tmp", `archive-pin-${randomUUID()}`);

function scratchDatabaseUrl(): string {
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${scratchDbName}`;
	return url.toString();
}

function runMigrateDeploy(): void {
	execFileSync("npx", ["prisma", "migrate", "deploy"], {
		cwd: tmpDir,
		env: { ...process.env, DATABASE_URL: scratchDatabaseUrl() },
		stdio: "pipe",
	});
}

function setUpTmpProject(): void {
	fs.mkdirSync(path.join(tmpDir, "prisma/migrations"), { recursive: true });
	fs.cpSync(REAL_MIGRATIONS_DIR, path.join(tmpDir, "prisma/migrations"), {
		recursive: true,
	});
	fs.copyFileSync(
		path.join(PROJECT_ROOT, "prisma/schema.prisma"),
		path.join(tmpDir, "prisma/schema.prisma")
	);
	// Minimal prisma.config.ts: same shape as the real one, pointed at this
	// tmp copy's own schema/migrations, relative to `cwd: tmpDir` above.
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

/** Retried drop — same rationale as `publishing-schema-migration.test.ts`'s equivalent: `DROP DATABASE … WITH (FORCE)` under parallel suite load can be slow enough to blow past a tight timeout even though nothing is wrong. */
async function dropScratchDatabaseWithRetries(): Promise<void> {
	const maxAttempts = 3;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		try {
			await adminPool.query(
				`DROP DATABASE IF EXISTS "${scratchDbName}" WITH (FORCE)`
			);
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

describe("archived_published_cases migration", () => {
	afterAll(async () => {
		await dropScratchDatabaseWithRetries();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}, 60_000);

	it("relaxes the FK so a case with a published row can be permanently deleted, clearing the link", async () => {
		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);
		await adminPool.end();

		setUpTmpProject();
		runMigrateDeploy();

		const scratchPool = new Pool({ connectionString: scratchDatabaseUrl() });
		try {
			const userId = randomUUID();
			const caseId = randomUUID();
			const publishedId = randomUUID();

			await scratchPool.query(
				`INSERT INTO users (id, email, username, password_algorithm, auth_provider, created_at, updated_at)
					 VALUES ($1, $2, $3, 'argon2id', 'LOCAL', now(), now())`,
				[
					userId,
					`archive-pin-${userId}@example.com`,
					`archivepin${userId.slice(0, 8)}`,
				]
			);
			await scratchPool.query(
				`INSERT INTO assurance_cases
					 (id, name, description, created_by_id, mode, color_profile, is_demo, layout_direction, created_at, updated_at, published, publish_status, deleted_at)
					 VALUES ($1, 'Migration Pin Case', 'desc', $2, 'STANDARD', 'default', false, 'TB', now(), now(), true, 'PUBLISHED', now())`,
				[caseId, userId]
			);
			await scratchPool.query(
				`INSERT INTO published_assurance_cases (id, title, slug, content, created_at, assurance_case_id, archived_at, archived_owner_id)
					 VALUES ($1, 'Migration Pin Case', 'migration-pin-case', '{}'::jsonb, now(), $2, now(), $3)`,
				[publishedId, caseId, userId]
			);

			// The case can be deleted even though a published row still points
			// at it — the pre-migration `ON DELETE RESTRICT` FK would have
			// rejected this with a P2003-shaped foreign-key-violation error.
			await scratchPool.query("DELETE FROM assurance_cases WHERE id = $1", [
				caseId,
			]);

			const published = await scratchPool.query<{
				assurance_case_id: string | null;
				archived_at: Date;
				is_current: boolean;
			}>(
				"SELECT assurance_case_id, archived_at, is_current FROM published_assurance_cases WHERE id = $1",
				[publishedId]
			);
			expect(published.rows[0]?.assurance_case_id).toBeNull();
			expect(published.rows[0]?.archived_at).not.toBeNull();
			expect(published.rows[0]?.is_current).toBe(true);

			// Deleting the archiving user clears archived_owner_id too (its own
			// ON DELETE SET NULL) rather than being blocked.
			await scratchPool.query("DELETE FROM users WHERE id = $1", [userId]);
			const afterUserDelete = await scratchPool.query<{
				archived_owner_id: string | null;
			}>(
				"SELECT archived_owner_id FROM published_assurance_cases WHERE id = $1",
				[publishedId]
			);
			expect(afterUserDelete.rows[0]?.archived_owner_id).toBeNull();
		} finally {
			await scratchPool.end();
		}
	}, 60_000);
});
