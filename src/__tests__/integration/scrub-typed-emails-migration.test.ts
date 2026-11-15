import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";

/**
 * Pins the data migration
 * `prisma/migrations/20261115110000_scrub_typed_emails_from_audit_log/migration.sql`
 * by running the file's actual statements against rows set up directly.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261115110000_scrub_typed_emails_from_audit_log/migration.sql"
	),
	"utf8"
);

const COMMENT_LINE = /^--.*$/gm;
const STATEMENTS = MIGRATION_SQL.replace(COMMENT_LINE, "")
	.split(";")
	.map((statement) => statement.trim())
	.filter(Boolean);

function seed(eventType: string, metadata: object) {
	return prisma.securityAuditLog.create({ data: { eventType, metadata } });
}

describe("migration: remove typed email addresses from the audit log", () => {
	it("removes the address fields and keeps the rest of each entry", async () => {
		const reset = await seed("password_reset_requested_invalid_user", {
			email: "a@example.com",
			reason: "user_not_found",
		});
		const limited = await seed("password_reset_rate_limited", {
			email: "b@example.com",
			reason: "too many",
		});
		const register = await seed("register_rate_limited", {
			reason: "too many",
			identifiers: { ip: "198.51.100.1", email: "c@example.com" },
		});
		const invite = await seed("invite_acceptance_email_mismatch", {
			inviteId: "i1",
			inviteEmail: "d@example.com",
			userEmail: "e@example.com",
		});

		const failedWithAddress = await seed("password_reset_email_failed", {
			error: "Recipient d.person@example.com was rejected",
			userId: "u1",
		});
		const failedWithoutAddress = await seed("password_reset_email_failed", {
			error: "Email sending failed (Throttled)",
		});

		expect(STATEMENTS.length).toBe(4);
		for (const statement of STATEMENTS) {
			await prisma.$executeRawUnsafe(statement);
		}

		const read = async (id: string) =>
			(await prisma.securityAuditLog.findUniqueOrThrow({ where: { id } }))
				.metadata;
		expect(await read(reset.id)).toEqual({ reason: "user_not_found" });
		expect(await read(limited.id)).toEqual({ reason: "too many" });
		expect(await read(register.id)).toEqual({
			reason: "too many",
			identifiers: { ip: "198.51.100.1" },
		});
		expect(await read(invite.id)).toEqual({ inviteId: "i1" });
		expect(await read(failedWithAddress.id)).toEqual({
			error: "Email sending failed",
			userId: "u1",
		});
		expect(await read(failedWithoutAddress.id)).toEqual({
			error: "Email sending failed (Throttled)",
		});
	});

	it("leaves entries of other event types alone", async () => {
		const other = await seed("login_failed", { email: "keep@example.com" });

		for (const statement of STATEMENTS) {
			await prisma.$executeRawUnsafe(statement);
		}

		const after = await prisma.securityAuditLog.findUniqueOrThrow({
			where: { id: other.id },
		});
		expect(after.metadata).toEqual({ email: "keep@example.com" });
	});
});
