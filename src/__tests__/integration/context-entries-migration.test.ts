/**
 * Pins the hand-written migration
 * `prisma/migrations/20261020000000_context_entries_jsonb`, which turns
 * `assurance_elements.context` from a list of text into a JSON list, and the
 * reverse script kept beside it.
 *
 * The worker databases are already migrated to HEAD, so the "before" column
 * cannot be built through them. Instead this runs the statements from the
 * real migration file (and the reverse file) against a scratch table that has
 * the old column definition: a text list, not null, default empty. The table
 * lives in the worker database and is dropped afterwards.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATION_DIR = path.join(
	PROJECT_ROOT,
	"prisma/migrations/20261020000000_context_entries_jsonb"
);
const REAL_TABLE = '"assurance_elements"';

const scratchTable = `scratch_context_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const SCRATCH = `"${scratchTable}"`;

/** The statements of a SQL file, with comment lines removed, aimed at the scratch table. */
function statementsFrom(fileName: string): string[] {
	const sql = fs.readFileSync(path.join(MIGRATION_DIR, fileName), "utf8");
	return sql
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n")
		.replaceAll(REAL_TABLE, SCRATCH)
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

async function run(statements: string[]): Promise<void> {
	for (const statement of statements) {
		await prisma.$executeRawUnsafe(statement);
	}
}

async function contextOf(id: number): Promise<unknown> {
	const rows = await prisma.$queryRawUnsafe<Array<{ context: unknown }>>(
		`SELECT "context" FROM ${SCRATCH} WHERE id = ${id}`
	);
	return rows[0]?.context;
}

async function columnType(): Promise<string> {
	const rows = await prisma.$queryRawUnsafe<Array<{ data_type: string }>>(
		`SELECT data_type FROM information_schema.columns
		 WHERE table_name = '${scratchTable}' AND column_name = 'context'`
	);
	return rows[0]?.data_type ?? "";
}

beforeAll(async () => {
	await prisma.$executeRawUnsafe(
		`CREATE TABLE ${SCRATCH} (id integer PRIMARY KEY, "context" TEXT[] NOT NULL DEFAULT '{}')`
	);
	await prisma.$executeRawUnsafe(
		`INSERT INTO ${SCRATCH} (id, "context") VALUES
		 (1, ARRAY['first', 'second']),
		 (2, ARRAY[]::TEXT[]),
		 (3, ARRAY['kept', NULL, 'also kept']),
		 (4, ARRAY['with "quotes", commas and {braces}', '']),
		 (5, DEFAULT)`
	);
});

afterAll(async () => {
	await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${SCRATCH}`);
});

describe("the migration file", () => {
	it("holds exactly the three statements, in order", () => {
		const statements = statementsFrom("migration.sql");
		expect(statements).toHaveLength(3);
		expect(statements[0]).toContain("DROP DEFAULT");
		expect(statements[1]).toContain("TYPE JSONB USING");
		expect(statements[2]).toContain("SET DEFAULT '[]'");
	});
});

describe("context_entries_jsonb", () => {
	it("converts every text list to a JSON list of the same strings, losing nothing", async () => {
		await run(statementsFrom("migration.sql"));

		expect(await columnType()).toBe("jsonb");
		expect(await contextOf(1)).toEqual(["first", "second"]);
		expect(await contextOf(4)).toEqual([
			'with "quotes", commas and {braces}',
			"",
		]);
	});

	it("turns an empty list into an empty JSON list", async () => {
		expect(await contextOf(2)).toEqual([]);
		expect(await contextOf(5)).toEqual([]);
	});

	it("drops a NULL inside a list and keeps the rest in order", async () => {
		expect(await contextOf(3)).toEqual(["kept", "also kept"]);
	});

	it("gives a new row an empty JSON list by default", async () => {
		await prisma.$executeRawUnsafe(`INSERT INTO ${SCRATCH} (id) VALUES (6)`);

		expect(await contextOf(6)).toEqual([]);
	});

	it("holds plain text and a named entry together", async () => {
		const named = {
			id: "k3f9x2m7qa",
			name: "window",
			text: "the interval",
			value: "5 minutes",
		};
		await prisma.$executeRawUnsafe(
			`INSERT INTO ${SCRATCH} (id, "context") VALUES (7, $1::jsonb)`,
			JSON.stringify(["plain", named])
		);

		expect(await contextOf(7)).toEqual(["plain", named]);
	});
});

describe("the reverse script", () => {
	it("puts the text lists back, in order, while no entry has a name", async () => {
		await prisma.$executeRawUnsafe(`DELETE FROM ${SCRATCH} WHERE id = 7`);

		await run(statementsFrom("reverse-not-applied.sql"));

		expect(await columnType()).toBe("ARRAY");
		expect(await contextOf(1)).toEqual(["first", "second"]);
		expect(await contextOf(2)).toEqual([]);
		expect(await contextOf(3)).toEqual(["kept", "also kept"]);
		expect(await contextOf(4)).toEqual([
			'with "quotes", commas and {braces}',
			"",
		]);
	});

	it("restores the not-null empty default", async () => {
		await prisma.$executeRawUnsafe(`INSERT INTO ${SCRATCH} (id) VALUES (8)`);

		expect(await contextOf(8)).toEqual([]);
	});
});
