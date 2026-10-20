/**
 * Runs the statements of the context-entries migration, and of its reverse
 * script, against a scratch table that has the old column shape (`context
 * TEXT[] NOT NULL DEFAULT '{}'`). The migrated template is not touched: it has
 * already been through the migration, so it cannot show what the statements do
 * to text-list data.
 *
 * The SQL is read from the migration files and only the table name is changed,
 * so this cannot drift from what `prisma migrate deploy` applies.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.join(
	import.meta.dirname,
	"../../../prisma/migrations"
);
const MIGRATION_DIR_NAME = readdirSync(MIGRATIONS_DIR).find((name) =>
	name.endsWith("_context_entries_jsonb")
);

function readSql(file: string): string {
	if (!MIGRATION_DIR_NAME) {
		throw new Error("The context-entries migration directory was not found");
	}
	return readFileSync(
		path.join(MIGRATIONS_DIR, MIGRATION_DIR_NAME, file),
		"utf8"
	);
}

const TABLE = `scratch_context_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

/** The statements of a SQL file with the real table renamed to the scratch one. */
function statementsFor(file: string): string[] {
	const withoutComments = readSql(file)
		.split("\n")
		.filter((line) => !line.trimStart().startsWith("--"))
		.join("\n");
	const retargeted = withoutComments.replaceAll(
		'"assurance_elements"',
		`"${TABLE}"`
	);
	// Only the real table's name may have changed.
	if (retargeted.includes("assurance_elements")) {
		throw new Error(
			"A statement names the real table in a form not retargeted"
		);
	}
	return retargeted
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

let pool: Pool;

async function runFile(file: string): Promise<void> {
	for (const statement of statementsFor(file)) {
		await pool.query(statement);
	}
}

async function createOldShapedTable(): Promise<void> {
	await pool.query(`DROP TABLE IF EXISTS "${TABLE}"`);
	await pool.query(
		`CREATE TABLE "${TABLE}" (id SERIAL PRIMARY KEY, label TEXT NOT NULL, context TEXT[] NOT NULL DEFAULT '{}')`
	);
}

async function insertRow(label: string, literal: string): Promise<void> {
	await pool.query(
		`INSERT INTO "${TABLE}" (label, context) VALUES ($1, ${literal})`,
		[label]
	);
}

async function contextOf(label: string): Promise<unknown> {
	const { rows } = await pool.query(
		`SELECT context FROM "${TABLE}" WHERE label = $1`,
		[label]
	);
	return rows[0]?.context;
}

beforeAll(() => {
	pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
});

afterAll(async () => {
	await pool.query(`DROP TABLE IF EXISTS "${TABLE}"`);
	await pool.end();
});

const AWKWARD = [
	"plain",
	"",
	"  padded  ",
	"quote \" and ' and \\ backslash",
	"{like this} and {name#abcdefghij}",
	'{"id":"abcdefghij","name":"window","text":"looks like a record"}',
	"[1,2,3]",
	"null",
	"unicode é \u{1F642} م",
	"line one\nline two\ttab",
	"x".repeat(10_000),
];

describe("the context-entries migration, on text-list data", () => {
	it("turns every list into a JSON list of the same strings in the same order, whatever the strings hold", async () => {
		await createOldShapedTable();
		await pool.query(
			`INSERT INTO "${TABLE}" (label, context) VALUES ('awkward', $1::text[])`,
			[AWKWARD]
		);
		await insertRow("empty", "ARRAY[]::text[]");
		await insertRow("single", "ARRAY['only']");
		await insertRow("untouched-default", "DEFAULT");

		await runFile("migration.sql");

		expect(await contextOf("awkward")).toEqual(AWKWARD);
		expect(await contextOf("empty")).toEqual([]);
		expect(await contextOf("single")).toEqual(["only"]);
		expect(await contextOf("untouched-default")).toEqual([]);
	});

	it("keeps a string that looks like a record as a string", async () => {
		await createOldShapedTable();
		await pool.query(
			`INSERT INTO "${TABLE}" (label, context) VALUES ('looks-like-record', $1::text[])`,
			[[AWKWARD[5]]]
		);
		await runFile("migration.sql");
		const { rows } = await pool.query(
			`SELECT jsonb_typeof(context -> 0) AS kind FROM "${TABLE}" WHERE label = 'looks-like-record'`
		);
		expect(rows[0]?.kind).toBe("string");
	});

	it("drops a NULL inside a list and keeps every other entry, in order", async () => {
		await createOldShapedTable();
		await insertRow("null-middle", "ARRAY['a', NULL, 'b']");
		await insertRow("null-ends", "ARRAY[NULL, 'a', NULL]");
		await insertRow("all-null", "ARRAY[NULL, NULL]::text[]");
		await runFile("migration.sql");

		expect(await contextOf("null-middle")).toEqual(["a", "b"]);
		expect(await contextOf("null-ends")).toEqual(["a"]);
		expect(await contextOf("all-null")).toEqual([]);
		const { rows } = await pool.query(
			`SELECT count(*)::int AS nulls FROM "${TABLE}", jsonb_array_elements(context) AS entry WHERE jsonb_typeof(entry) = 'null'`
		);
		expect(rows[0]?.nulls).toBe(0);
	});

	it("leaves a JSONB column whose default is an empty list", async () => {
		await createOldShapedTable();
		await runFile("migration.sql");
		const { rows } = await pool.query(
			`SELECT data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = 'context'`,
			[TABLE]
		);
		expect(rows[0]?.data_type).toBe("jsonb");
		expect(rows[0]?.is_nullable).toBe("NO");
		await pool.query(`INSERT INTO "${TABLE}" (label) VALUES ('after')`);
		expect(await contextOf("after")).toEqual([]);
	});

	it("can hold a named entry after the change", async () => {
		await createOldShapedTable();
		await runFile("migration.sql");
		const record = { id: "abcdefghij", name: "window", text: "t", value: "5" };
		await pool.query(
			`INSERT INTO "${TABLE}" (label, context) VALUES ('named', $1::jsonb)`,
			[JSON.stringify(["text", record])]
		);
		expect(await contextOf("named")).toEqual(["text", record]);
	});
});

describe("the reverse script", () => {
	it("gives back the same text lists, in the same order, while no entry has a name", async () => {
		await createOldShapedTable();
		await pool.query(
			`INSERT INTO "${TABLE}" (label, context) VALUES ('awkward', $1::text[])`,
			[AWKWARD]
		);
		await insertRow("empty", "ARRAY[]::text[]");
		await runFile("migration.sql");
		await runFile("reverse-not-applied.sql");

		expect(await contextOf("awkward")).toEqual(AWKWARD);
		expect(await contextOf("empty")).toEqual([]);
		const { rows } = await pool.query(
			`SELECT udt_name, is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = 'context'`,
			[TABLE]
		);
		expect(rows[0]?.udt_name).toBe("_text");
		expect(rows[0]?.is_nullable).toBe("NO");
		await pool.query(`INSERT INTO "${TABLE}" (label) VALUES ('after')`);
		expect(await contextOf("after")).toEqual([]);
	});
});
