import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

/**
 * Pins the row deletes in
 * `prisma/migrations/20261115130000_key_typed_emails_in_attempt_tables/migration.sql`.
 *
 * The test database is already migrated, so the column is already renamed.
 * The file's DELETE statements are run for real against seeded rows.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261115130000_key_typed_emails_in_attempt_tables/migration.sql"
	),
	"utf8"
);

const COMMENT_LINE = /^--.*$/gm;
const DELETES = MIGRATION_SQL.replace(COMMENT_LINE, "")
	.split(";")
	.map((statement) => statement.trim())
	.filter((statement) => statement.startsWith("DELETE"));

const attempt = (
	endpoint: string,
	identifierType: string,
	identifier: string
) => ({ endpoint, identifierType, identifier });

describe("migration: remove typed addresses from the attempt tables", () => {
	it("removes reset rows and registration email rows only", async () => {
		expect(DELETES).toHaveLength(2);
		await prisma.passwordResetAttempt.createMany({
			data: [
				{ emailKey: "a".repeat(64), ipAddress: "10.0.0.1" },
				{ emailKey: null, ipAddress: "10.0.0.2" },
			],
		});
		await prisma.rateLimitAttempt.createMany({
			data: [
				attempt("register", "email", "typed@example.com"),
				attempt("register", "ip", "10.0.0.1"),
				attempt("sign_in", "email", "b".repeat(64)),
				attempt("invite_accept", "user_id", "user-1"),
			],
		});

		for (const statement of DELETES) {
			await prisma.$executeRawUnsafe(statement);
		}

		expect(await prisma.passwordResetAttempt.count()).toBe(0);
		const kept = await prisma.rateLimitAttempt.findMany({
			orderBy: { endpoint: "asc" },
		});
		expect(kept.map((row) => `${row.endpoint}/${row.identifierType}`)).toEqual([
			"invite_accept/user_id",
			"register/ip",
			"sign_in/email",
		]);
	});
});
