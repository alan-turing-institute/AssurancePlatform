/**
 * Pins the hand-written migration
 * `prisma/migrations/20261002000000_health_evidence_v1_1`: format 0.1
 * evidence and the `tea.health` cached summaries are removed with their
 * counts audited first, per-user `tea.health` settings are cleared, other
 * plugins are left alone, and the four new tables and the open-revocation
 * index exist afterwards.
 *
 * The worker databases are already migrated to HEAD, so the "before" state
 * cannot be built through them. This test drives `prisma migrate deploy`
 * twice against its own scratch databases and its own copy of the migrations
 * directory, never the real one or the shared worker databases.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { INTEGRATION_TEST_ADMIN_DATABASE_URL } from "../scripts/test-db-config";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const REAL_MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations");
const NEW_MIGRATION_NAME = "20261002000000_health_evidence_v1_1";
const HEALTH = "tea.health";
const OTHER = "tea.other";

const NEW_TABLES = [
	"plugin_health_evidence",
	"plugin_health_claim_states",
	"plugin_health_binding_changes",
	"plugin_health_revocations",
];
const OPEN_REVOCATION_INDEX = "plugin_health_revocations_evidence_id_open_key";

interface Scratch {
	name: string;
	tmpDir: string;
	url: string;
}

const scratches: Scratch[] = [];

function createScratch(): Scratch {
	const id = randomUUID().replaceAll("-", "").slice(0, 12);
	const name = `tea_test_health_mig_${id}`;
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${name}`;
	const tmpDir = path.join(PROJECT_ROOT, ".tmp", `health-migration-${id}`);
	const scratch = { name, tmpDir, url: url.toString() };
	scratches.push(scratch);
	return scratch;
}

function copyMigrations(scratch: Scratch, names: string[]): void {
	for (const name of names) {
		fs.cpSync(
			path.join(REAL_MIGRATIONS_DIR, name),
			path.join(scratch.tmpDir, "prisma/migrations", name),
			{ recursive: true }
		);
	}
}

function runMigrateDeploy(scratch: Scratch): void {
	execFileSync("npx", ["prisma", "migrate", "deploy"], {
		cwd: scratch.tmpDir,
		env: { ...process.env, DATABASE_URL: scratch.url },
		stdio: "pipe",
	});
}

/** Creates the scratch database and applies every migration before the one under test. */
async function setUp(scratch: Scratch): Promise<void> {
	const adminPool = new Pool({
		connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
	});
	await adminPool.query(`CREATE DATABASE "${scratch.name}"`);
	await adminPool.end();

	fs.mkdirSync(path.join(scratch.tmpDir, "prisma/migrations"), {
		recursive: true,
	});
	fs.copyFileSync(
		path.join(REAL_MIGRATIONS_DIR, "migration_lock.toml"),
		path.join(scratch.tmpDir, "prisma/migrations/migration_lock.toml")
	);
	fs.copyFileSync(
		path.join(PROJECT_ROOT, "prisma/schema.prisma"),
		path.join(scratch.tmpDir, "prisma/schema.prisma")
	);
	fs.writeFileSync(
		path.join(scratch.tmpDir, "prisma.config.ts"),
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
	copyMigrations(
		scratch,
		fs
			.readdirSync(REAL_MIGRATIONS_DIR)
			.filter(
				(name) => name !== "migration_lock.toml" && name !== NEW_MIGRATION_NAME
			)
	);
	runMigrateDeploy(scratch);
}

async function dropScratch(scratch: Scratch): Promise<void> {
	const maxAttempts = 3;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const adminPool = new Pool({
			connectionString: INTEGRATION_TEST_ADMIN_DATABASE_URL,
		});
		try {
			await adminPool.query(
				`DROP DATABASE IF EXISTS "${scratch.name}" WITH (FORCE)`
			);
			break;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
		} finally {
			await adminPool.end();
		}
	}
	fs.rmSync(scratch.tmpDir, { recursive: true, force: true });
}

async function auditCounts(pool: Pool) {
	const result = await pool.query<{ metadata: Record<string, number> }>(
		"SELECT metadata FROM security_audit_logs WHERE event_type = 'health_evidence_v01_removed'"
	);
	return result.rows.map((row) => row.metadata);
}

afterAll(async () => {
	for (const scratch of scratches) {
		await dropScratch(scratch);
	}
}, 60_000);

describe("health evidence v1.1 migration", () => {
	it("removes format 0.1 evidence and tea.health data, audits the counts, and leaves other plugins alone", async () => {
		const scratch = createScratch();
		await setUp(scratch);
		const pool = new Pool({ connectionString: scratch.url });
		try {
			const userId = randomUUID();
			const caseId = randomUUID();
			const claimId = randomUUID();
			await pool.query(
				`INSERT INTO users (id, email, username, password_algorithm, auth_provider, created_at, updated_at)
				 VALUES ($1, $2, $3, 'argon2id', 'LOCAL', now(), now())`,
				[userId, `health-mig-${userId}@example.com`, `m${userId.slice(0, 8)}`]
			);
			await pool.query(
				`INSERT INTO assurance_cases
				 (id, name, description, created_by_id, mode, color_profile, is_demo, layout_direction, created_at, updated_at, published, publish_status)
				 VALUES ($1, 'Case', 'desc', $2, 'STANDARD', 'default', false, 'TB', now(), now(), false, 'DRAFT')`,
				[caseId, userId]
			);
			await pool.query(
				`INSERT INTO assurance_elements (id, case_id, element_type, name, description, created_by_id, created_at, updated_at)
				 VALUES ($1, $2, 'PROPERTY_CLAIM', 'Claim', 'desc', $3, now(), now())`,
				[claimId, caseId, userId]
			);

			for (const [i, verdict] of ["PASS", "FAIL"].entries()) {
				await pool.query(
					`INSERT INTO plugin_health_evidence
					 (id, claim_id, metric_name, value, threshold, verdict, source_system, provenance, evaluated_at, format_version, record_hash, created_by_id)
					 VALUES ($1, $2, 'metric', 1, 2, $3::"PluginHealthEvidenceVerdict", 'sys', '{}'::jsonb, now(), '0.1', $4, $5)`,
					[randomUUID(), claimId, verdict, `hash-${i}`, userId]
				);
			}
			const insertData = (pluginId: string, elementId: string | null) =>
				pool.query(
					`INSERT INTO plugin_data (id, plugin_id, case_id, element_id, data, updated_at)
					 VALUES ($1, $2, $3, $4, '{"k":1}'::jsonb, now())`,
					[randomUUID(), pluginId, caseId, elementId]
				);
			await insertData(HEALTH, claimId);
			await insertData(HEALTH, null);
			await insertData(OTHER, claimId);
			await insertData(OTHER, null);

			const insertState = (pluginId: string) =>
				pool.query(
					`INSERT INTO plugin_state (id, plugin_id, scope_type, scope_id, enabled, settings, updated_at)
					 VALUES ($1, $2, 'USER', $3, true, '{"weights":[1,2]}'::jsonb, now())`,
					[randomUUID(), pluginId, userId]
				);
			await insertState(HEALTH);
			await insertState(OTHER);

			copyMigrations(scratch, [NEW_MIGRATION_NAME]);
			runMigrateDeploy(scratch);

			expect(await auditCounts(pool)).toEqual([
				{ evidence_rows: 2, plugin_data_rows: 2 },
			]);

			const remaining = await pool.query<{ plugin_id: string; n: string }>(
				"SELECT plugin_id, count(*) AS n FROM plugin_data GROUP BY plugin_id"
			);
			expect(remaining.rows).toEqual([{ plugin_id: OTHER, n: "2" }]);

			const states = await pool.query<{
				plugin_id: string;
				settings: unknown;
			}>("SELECT plugin_id, settings FROM plugin_state");
			const settingsOf = (pluginId: string) =>
				states.rows.find((row) => row.plugin_id === pluginId)?.settings;
			expect(settingsOf(HEALTH)).toBeNull();
			expect(settingsOf(OTHER)).toEqual({ weights: [1, 2] });

			const tables = await pool.query<{ table_name: string }>(
				"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
				[NEW_TABLES]
			);
			expect(tables.rows.map((row) => row.table_name).sort()).toEqual(
				[...NEW_TABLES].sort()
			);
			const evidenceRows = await pool.query(
				"SELECT count(*) AS n FROM plugin_health_evidence"
			);
			expect(evidenceRows.rows[0]?.n).toBe("0");
			const indexes = await pool.query<{ indexdef: string }>(
				"SELECT indexdef FROM pg_indexes WHERE indexname = $1",
				[OPEN_REVOCATION_INDEX]
			);
			expect(indexes.rows[0]?.indexdef).toContain("UNIQUE");
			expect(indexes.rows[0]?.indexdef).toContain("reinstated_at IS NULL");

			// The database refuses a second open revocation for one record.
			const evidenceId = randomUUID();
			await pool.query(
				`INSERT INTO plugin_health_evidence
				 (id, claim_id, record, record_id, record_timestamp, verdict, check_name, session, valid_for, format_version, record_hash, created_by_id)
				 VALUES ($1, $2, '{}'::jsonb, $3, now(), 'PASS', 'c', 's', 'PT1H', '1.1', 'h', $4)`,
				[evidenceId, claimId, randomUUID(), userId]
			);
			const revoke = () =>
				pool.query(
					`INSERT INTO plugin_health_revocations (id, evidence_id, cause, reason, revoked_by_id)
					 VALUES ($1, $2, 'OTHER', 'why', $3)`,
					[randomUUID(), evidenceId, userId]
				);
			await revoke();
			await expect(revoke()).rejects.toThrow(OPEN_REVOCATION_INDEX);
		} finally {
			await pool.end();
		}
	}, 120_000);

	it("applies on an empty database and records zero counts", async () => {
		const scratch = createScratch();
		await setUp(scratch);
		copyMigrations(scratch, [NEW_MIGRATION_NAME]);
		runMigrateDeploy(scratch);

		const pool = new Pool({ connectionString: scratch.url });
		try {
			expect(await auditCounts(pool)).toEqual([
				{ evidence_rows: 0, plugin_data_rows: 0 },
			]);
			const tables = await pool.query(
				"SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
				[NEW_TABLES]
			);
			expect(tables.rows[0]?.n).toBe("4");
		} finally {
			await pool.end();
		}
	}, 120_000);
});
