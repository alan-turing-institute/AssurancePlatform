import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";

/**
 * Pins the data migration
 * `prisma/migrations/20261115120000_drop_invite_code_prefix_from_audit_log/migration.sql`
 * by running the file's actual statements against rows set up directly.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261115120000_drop_invite_code_prefix_from_audit_log/migration.sql"
	),
	"utf8"
);

const COMMENT_LINE = /^--.*$/gm;
const STATEMENTS = MIGRATION_SQL.replace(COMMENT_LINE, "")
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

const EVENT_TYPES = [
	"invite_acceptance_user_not_found",
	"invite_acceptance_invalid_token",
	"invite_acceptance_expired",
	"invite_acceptance_already_used",
	"invite_acceptance_email_mismatch",
	"invite_acceptance_failed",
];

const seed = (eventType: string, metadata: object) =>
	prisma.securityAuditLog.create({ data: { eventType, metadata } });

const runMigration = async () => {
	for (const statement of STATEMENTS) {
		await prisma.$executeRawUnsafe(statement);
	}
};

describe("migration: remove the invitation code prefix from the audit log", () => {
	it("removes the code prefix and keeps the rest of each entry", async () => {
		const rows = await Promise.all(
			EVENT_TYPES.map((eventType) =>
				seed(eventType, { inviteToken: "abcd1234...", inviteId: "i1" })
			)
		);

		await runMigration();

		for (const row of rows) {
			const after = await prisma.securityAuditLog.findUniqueOrThrow({
				where: { id: row.id },
			});
			expect(after.metadata).toEqual({ inviteId: "i1" });
		}
	});

	it("leaves entries with no metadata or a JSON null untouched", async () => {
		const noMetadata = await prisma.securityAuditLog.create({
			data: { eventType: "invite_acceptance_user_not_found" },
		});
		const jsonNull = await prisma.securityAuditLog.create({
			data: {
				eventType: "invite_acceptance_user_not_found",
				metadata: Prisma.JsonNull,
			},
		});
		const dbNull = await prisma.securityAuditLog.create({
			data: {
				eventType: "invite_acceptance_user_not_found",
				metadata: Prisma.DbNull,
			},
		});

		await runMigration();

		for (const row of [noMetadata, jsonNull, dbNull]) {
			const after = await prisma.securityAuditLog.findUniqueOrThrow({
				where: { id: row.id },
			});
			expect(after.metadata).toBeNull();
		}
	});

	it("leaves entries of other event types alone", async () => {
		const other = await seed("login_failed", { inviteToken: "keep" });

		await runMigration();

		const after = await prisma.securityAuditLog.findUniqueOrThrow({
			where: { id: other.id },
		});
		expect(after.metadata).toEqual({ inviteToken: "keep" });
	});
});
