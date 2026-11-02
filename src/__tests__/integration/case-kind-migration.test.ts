/**
 * Pins the migration that gives a case a kind
 * (`prisma/migrations/20261102100000_case_kind`) against a database that
 * already holds cases: every existing case becomes an ordinary case, any old
 * source-pattern value is cleared, the link then points at another case and
 * clears when that case is deleted, and the element table gains its two
 * placeholder columns without disturbing a row.
 *
 * Same technique as the other migration tests: its own throwaway database and
 * its own COPY of the migrations directory, migrated to just before the new
 * migration, filled with rows, then migrated to HEAD. It never touches the real
 * `prisma/migrations/` or the shared worker databases.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INTEGRATION_TEST_ADMIN_DATABASE_URL } from "../scripts/test-db-config";

// src/__tests__/integration/ -> project root is three levels up.
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const REAL_MIGRATIONS_DIR = path.join(PROJECT_ROOT, "prisma/migrations");
const NEW_MIGRATION_NAME = "20261102100000_case_kind";

const scratchDbName = `tea_test_case_kind_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const tmpDir = path.join(PROJECT_ROOT, ".tmp", `case-kind-${randomUUID()}`);

function scratchDatabaseUrl(): string {
	const url = new URL(INTEGRATION_TEST_ADMIN_DATABASE_URL);
	url.pathname = `/${scratchDbName}`;
	return url.toString();
}

function copyMigrations(names: string[]): void {
	for (const name of names) {
		fs.cpSync(
			path.join(REAL_MIGRATIONS_DIR, name),
			path.join(tmpDir, "prisma/migrations", name),
			{ recursive: true }
		);
	}
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

function runMigrateDeploy(): void {
	execFileSync("npx", ["prisma", "migrate", "deploy"], {
		cwd: tmpDir,
		env: { ...process.env, DATABASE_URL: scratchDatabaseUrl() },
		stdio: "pipe",
	});
}

/** Runs `prisma migrate diff --exit-code`, returning its exit code rather than throwing on non-zero. */
function runMigrateDiffExitCode(): number {
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
				env: { ...process.env, DATABASE_URL: scratchDatabaseUrl() },
				stdio: "pipe",
			}
		);
		return 0;
	} catch (error) {
		return (error as { status: number | null }).status ?? 1;
	}
}

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

const ID = {
	user: randomUUID(),
	oldPattern: randomUUID(),
	linked: randomUUID(),
	published: randomUUID(),
	trashed: randomUUID(),
	plain: randomUUID(),
};
const ELEMENT_IDS = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const CASE_IDS = [ID.linked, ID.published, ID.trashed, ID.plain];

let pool: Pool;

async function insertCase(
	id: string,
	name: string,
	extra: { linkTo?: string; published?: boolean; trashed?: boolean } = {}
): Promise<void> {
	await pool.query(
		`INSERT INTO assurance_cases
			 (id, name, description, created_by_id, mode, color_profile, is_demo, layout_direction, created_at, updated_at, published, publish_status, source_pattern_id, deleted_at)
			 VALUES ($1, $2, 'desc', $3, 'STANDARD', 'default', false, 'TB', now(), now(), $4, $5, $6, $7)`,
		[
			id,
			name,
			ID.user,
			extra.published ?? false,
			extra.published ? "PUBLISHED" : "DRAFT",
			extra.linkTo ?? null,
			extra.trashed ? new Date() : null,
		]
	);
}

beforeAll(async () => {
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

	pool = new Pool({ connectionString: scratchDatabaseUrl() });
	await pool.query(
		`INSERT INTO users (id, email, username, password_algorithm, auth_provider, created_at, updated_at)
		 VALUES ($1, $2, $3, 'argon2id', 'LOCAL', now(), now())`,
		[
			ID.user,
			`case-kind-${ID.user}@example.com`,
			`casekind${ID.user.slice(0, 8)}`,
		]
	);
	await pool.query(
		`INSERT INTO argument_patterns (id, name, description, version, tags, created_by_id, updated_at)
		 VALUES ($1, 'Old pattern', 'From the old table', '1.0', ARRAY[]::text[], $2, now())`,
		[ID.oldPattern, ID.user]
	);
	await insertCase(ID.linked, "Linked to an old pattern", {
		linkTo: ID.oldPattern,
	});
	await insertCase(ID.published, "Published", { published: true });
	await insertCase(ID.trashed, "In the trash", { trashed: true });
	await insertCase(ID.plain, "Plain");
	for (const [index, caseId] of CASE_IDS.entries()) {
		await pool.query(
			`INSERT INTO assurance_elements (id, case_id, element_type, description, created_by_id, updated_at, from_pattern)
			 VALUES ($1, $2, 'GOAL', $3, $4, now(), $5)`,
			[ELEMENT_IDS[index], caseId, `Goal ${index}`, ID.user, index === 0]
		);
	}

	copyMigrations([NEW_MIGRATION_NAME]);
	runMigrateDeploy();
}, 180_000);

afterAll(async () => {
	await pool?.end();
	await dropScratchDatabaseWithRetries();
	fs.rmSync(tmpDir, { recursive: true, force: true });
}, 60_000);

describe("the case kind migration on a database that holds cases", () => {
	it("makes every existing case an ordinary case and keeps every other field", async () => {
		const rows = await pool.query<{
			id: string;
			kind: string;
			name: string;
			published: boolean;
			deleted: boolean;
		}>(
			`SELECT id, kind::text AS kind, name, published, (deleted_at IS NOT NULL) AS deleted
			 FROM assurance_cases ORDER BY name`
		);

		expect(rows.rows.map((row) => row.kind)).toEqual([
			"CASE",
			"CASE",
			"CASE",
			"CASE",
		]);
		expect(rows.rows.map((row) => row.name)).toEqual([
			"In the trash",
			"Linked to an old pattern",
			"Plain",
			"Published",
		]);
		expect(rows.rows.find((row) => row.name === "Published")?.published).toBe(
			true
		);
		expect(rows.rows.find((row) => row.name === "In the trash")?.deleted).toBe(
			true
		);
	});

	it("clears the old source-pattern value and leaves the old patterns table alone", async () => {
		const links = await pool.query(
			"SELECT id FROM assurance_cases WHERE source_pattern_id IS NOT NULL"
		);
		const oldRows = await pool.query(
			"SELECT id FROM argument_patterns WHERE id = $1",
			[ID.oldPattern]
		);

		expect(links.rowCount).toBe(0);
		expect(oldRows.rowCount).toBe(1);
	});

	it("points the source link at the cases table, clearing on delete, and nowhere else", async () => {
		const constraint = await pool.query<{
			target: string;
			on_delete: string;
			on_update: string;
		}>(
			`SELECT confrelid::regclass::text AS target, confdeltype AS on_delete, confupdtype AS on_update
			 FROM pg_constraint WHERE conname = 'assurance_cases_source_pattern_id_fkey'`
		);
		const toOldTable = await pool.query(
			`SELECT conname FROM pg_constraint
			 WHERE conrelid = 'assurance_cases'::regclass AND confrelid = 'argument_patterns'::regclass`
		);

		expect(constraint.rows).toEqual([
			{ target: "assurance_cases", on_delete: "n", on_update: "c" },
		]);
		expect(toOldTable.rowCount).toBe(0);
	});

	it("indexes the source link column under the name Prisma gives it", async () => {
		const indexes = await pool.query<{ indexname: string; indexdef: string }>(
			`SELECT indexname, indexdef FROM pg_indexes
			 WHERE tablename = 'assurance_cases' AND indexname = 'assurance_cases_source_pattern_id_idx'`
		);

		expect(indexes.rows).toHaveLength(1);
		expect(indexes.rows[0]?.indexdef).toContain("(source_pattern_id)");
	});

	it("lets a new case link to a pattern, refuses a link to the old table, and clears the link when the pattern goes", async () => {
		const pattern = randomUUID();
		const started = randomUUID();
		await insertCase(pattern, "New pattern");
		await pool.query(
			"UPDATE assurance_cases SET kind = 'PATTERN' WHERE id = $1",
			[pattern]
		);
		await insertCase(started, "Started", { linkTo: pattern });

		await expect(
			insertCase(randomUUID(), "Bad", { linkTo: ID.oldPattern })
		).rejects.toThrow();
		await pool.query("DELETE FROM assurance_cases WHERE id = $1", [pattern]);

		const after = await pool.query(
			"SELECT source_pattern_id FROM assurance_cases WHERE id = $1",
			[started]
		);
		expect(after.rows).toEqual([{ source_pattern_id: null }]);
	});

	it("has a kind enum of exactly CASE and PATTERN", async () => {
		const labels = await pool.query<{ enumlabel: string }>(
			`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
			 WHERE t.typname = 'CaseKind' ORDER BY e.enumsortorder`
		);

		expect(labels.rows.map((row) => row.enumlabel)).toEqual([
			"CASE",
			"PATTERN",
		]);
	});

	it("adds the placeholder columns to every element as not a placeholder with no hint, and keeps the elements", async () => {
		const rows = await pool.query<{
			id: string;
			is_placeholder: boolean;
			placeholder_hint: string | null;
			from_pattern: boolean;
		}>(
			"SELECT id, is_placeholder, placeholder_hint, from_pattern FROM assurance_elements ORDER BY description"
		);

		expect(rows.rows.map((row) => row.id)).toEqual(ELEMENT_IDS);
		expect(rows.rows.every((row) => row.is_placeholder === false)).toBe(true);
		expect(rows.rows.every((row) => row.placeholder_hint === null)).toBe(true);
		expect(rows.rows.map((row) => row.from_pattern)).toEqual([
			true,
			false,
			false,
			false,
		]);
	});

	it("limits a placeholder hint to 500 characters", async () => {
		const column = await pool.query<{
			character_maximum_length: number;
			is_nullable: string;
		}>(
			`SELECT character_maximum_length, is_nullable FROM information_schema.columns
			 WHERE table_name = 'assurance_elements' AND column_name = 'placeholder_hint'`
		);
		const flag = await pool.query<{
			is_nullable: string;
			column_default: string;
		}>(
			`SELECT is_nullable, column_default FROM information_schema.columns
			 WHERE table_name = 'assurance_elements' AND column_name = 'is_placeholder'`
		);

		expect(column.rows).toEqual([
			{ character_maximum_length: 500, is_nullable: "YES" },
		]);
		expect(flag.rows).toEqual([{ is_nullable: "NO", column_default: "false" }]);
		await expect(
			pool.query(
				"UPDATE assurance_elements SET placeholder_hint = $1 WHERE id = $2",
				["x".repeat(501), ELEMENT_IDS[0]]
			)
		).rejects.toThrow();
	});

	it("leaves the database with no drift from the Prisma schema", () => {
		expect(runMigrateDiffExitCode()).toBe(0);
	}, 60_000);
});
