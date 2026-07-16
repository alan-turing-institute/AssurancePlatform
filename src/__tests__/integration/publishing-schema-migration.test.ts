/**
 * Pins the hand-written migration for this feature
 * (`prisma/migrations/20260716000000_publishing_schema_and_state_model`):
 * legacy `READY_TO_PUBLISH` rows must map to `DRAFT`, and existing
 * `published_assurance_cases` rows must get a valid, unique, backfilled
 * slug — both BEFORE the `PublishStatus` enum is rebuilt without the
 * retired value.
 *
 * Every other integration test in this suite runs against a worker database
 * (`tea_test_w*`) already migrated to HEAD — by the time any of those tests
 * run, `READY_TO_PUBLISH` no longer exists as a valid enum value at all, so
 * there is no way to construct the "before" state through the normal Prisma
 * client. This test instead drives `prisma migrate deploy` directly, twice,
 * against its own throwaway database and its own COPY of the migrations
 * directory (never the real `prisma/migrations/`, and never the shared
 * `tea_test_w*`/`tea_test_template` databases) — safe to run alongside the
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
const NEW_MIGRATION_NAME = "20260716000000_publishing_schema_and_state_model";

const scratchDbName = `tea_test_migration_pin_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const tmpDir = path.join(PROJECT_ROOT, ".tmp", `migration-pin-${randomUUID()}`);

function scratchDatabaseUrl(): string {
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${scratchDbName}`;
	return url.toString();
}

/** Copies every migration folder in `names` from the real migrations dir into the tmp copy. */
function copyMigrations(names: string[]): void {
	for (const name of names) {
		fs.cpSync(
			path.join(REAL_MIGRATIONS_DIR, name),
			path.join(tmpDir, "prisma/migrations", name),
			{ recursive: true }
		);
	}
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
	fs.copyFileSync(
		path.join(REAL_MIGRATIONS_DIR, "migration_lock.toml"),
		path.join(tmpDir, "prisma/migrations/migration_lock.toml")
	);
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

describe("publishing-schema-and-state-model migration", () => {
	afterAll(async () => {
		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		try {
			await adminPool.query(
				`DROP DATABASE IF EXISTS "${scratchDbName}" WITH (FORCE)`
			);
		} finally {
			await adminPool.end();
		}
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}, 30_000);

	it("maps legacy READY_TO_PUBLISH rows to DRAFT and backfills a unique slug, before rebuilding the enum", async () => {
		const allMigrations = fs
			.readdirSync(REAL_MIGRATIONS_DIR)
			.filter(
				(name) => name !== "migration_lock.toml" && name !== NEW_MIGRATION_NAME
			);

		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);
		await adminPool.end();

		setUpTmpProject();
		copyMigrations(allMigrations);
		runMigrateDeploy();

		const scratchPool = new Pool({ connectionString: scratchDatabaseUrl() });
		try {
			const userId = randomUUID();
			const legacyCaseId = randomUUID();
			const punctuationCaseId = randomUUID();
			const historyCaseId = randomUUID();
			const publishedNormalId = randomUUID();
			const publishedPunctuationId = randomUUID();
			const historyOlderId = randomUUID();
			const historyNewerId = randomUUID();

			await scratchPool.query(
				`INSERT INTO users (id, email, username, password_algorithm, auth_provider, created_at, updated_at)
					 VALUES ($1, $2, $3, 'argon2id', 'LOCAL', now(), now())`,
				[
					userId,
					`migration-pin-${userId}@example.com`,
					`migrationpin${userId.slice(0, 8)}`,
				]
			);

			for (const [caseId, name] of [
				[legacyCaseId, "Legacy Ready Case"],
				[punctuationCaseId, "***"],
				[historyCaseId, "Republished Case"],
			] as const) {
				await scratchPool.query(
					`INSERT INTO assurance_cases
						 (id, name, description, created_by_id, mode, color_profile, is_demo, layout_direction, created_at, updated_at, published, publish_status)
						 VALUES ($1, $2, 'desc', $3, 'STANDARD', 'default', false, 'TB', now(), now(), false, 'READY_TO_PUBLISH')`,
					[caseId, name, userId]
				);
			}

			await scratchPool.query(
				`INSERT INTO published_assurance_cases (id, title, content, created_at, assurance_case_id, description)
					 VALUES ($1, 'My Great Case!!!', '{}'::jsonb, now(), $2, 'note')`,
				[publishedNormalId, legacyCaseId]
			);
			await scratchPool.query(
				`INSERT INTO published_assurance_cases (id, title, content, created_at, assurance_case_id, description)
					 VALUES ($1, '***', '{}'::jsonb, now(), $2, 'note2')`,
				[publishedPunctuationId, punctuationCaseId]
			);
			// Two historical versions of the SAME case, republished — only the
			// later one (by created_at) should end up `is_current = true`.
			await scratchPool.query(
				`INSERT INTO published_assurance_cases (id, title, content, created_at, assurance_case_id, description)
					 VALUES ($1, 'Republished Case', '{}'::jsonb, now() - interval '1 day', $2, 'first version')`,
				[historyOlderId, historyCaseId]
			);
			await scratchPool.query(
				`INSERT INTO published_assurance_cases (id, title, content, created_at, assurance_case_id, description)
					 VALUES ($1, 'Republished Case', '{}'::jsonb, now(), $2, 'second version')`,
				[historyNewerId, historyCaseId]
			);

			copyMigrations([NEW_MIGRATION_NAME]);
			runMigrateDeploy();

			const statuses = await scratchPool.query<{
				id: string;
				publish_status: string;
			}>("SELECT id, publish_status FROM assurance_cases WHERE id = ANY($1)", [
				[legacyCaseId, punctuationCaseId, historyCaseId],
			]);
			for (const row of statuses.rows) {
				expect(row.publish_status).toBe("DRAFT");
			}

			const slugs = await scratchPool.query<{
				id: string;
				title: string;
				slug: string;
				type: string;
				is_current: boolean;
			}>(
				"SELECT id, title, slug, type, is_current FROM published_assurance_cases WHERE id = ANY($1)",
				[
					[
						publishedNormalId,
						publishedPunctuationId,
						historyOlderId,
						historyNewerId,
					],
				]
			);
			const byId = new Map(slugs.rows.map((r) => [r.id, r]));

			const normalRow = byId.get(publishedNormalId);
			expect(normalRow?.slug).toBe(
				`my-great-case-${publishedNormalId.slice(0, 8)}`
			);
			expect(normalRow?.type).toBe("ASSURANCE_CASE");
			expect(normalRow?.is_current).toBe(true);

			const punctuationRow = byId.get(publishedPunctuationId);
			expect(punctuationRow?.slug).toBe(
				`item-${publishedPunctuationId.slice(0, 8)}`
			);

			// Uniqueness constraint actually landed (not just present values).
			expect(normalRow?.slug).not.toBe(punctuationRow?.slug);

			// Multi-version backfill: the id-fragment suffix means each legacy
			// row still gets its OWN unique slug (there is no shared "case
			// identity" to derive a common one from pre-migration) — the
			// invariant this backfill must uphold is "at most one current row
			// per case", not slug equality. Only the NEWER row stays current;
			// runtime republishes going forward carry one slug forward instead
			// (see `publish-service.test.ts`'s rename-stability test).
			const olderRow = byId.get(historyOlderId);
			const newerRow = byId.get(historyNewerId);
			expect(olderRow?.slug).not.toBe(newerRow?.slug);
			expect(olderRow?.is_current).toBe(false);
			expect(newerRow?.is_current).toBe(true);
		} finally {
			await scratchPool.end();
		}
	}, 60_000);
});
