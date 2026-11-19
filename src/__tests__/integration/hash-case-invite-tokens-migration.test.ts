import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { acceptInvite } from "@/lib/services/case-invite-service";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Pins the data step of
 * `prisma/migrations/20261115100000_hash_case_invite_tokens/migration.sql`.
 *
 * The test database is already migrated, so the column is already renamed.
 * The file's UPDATE statement is run for real against a row holding a raw
 * code, which is what an invitation sent before the migration looks like.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261115100000_hash_case_invite_tokens/migration.sql"
	),
	"utf8"
);

const UPDATE_RE = /^(--[^\n]*\n)*\s*UPDATE "case_invites"/;
const UPDATE_STATEMENT = MIGRATION_SQL.split(";")
	.map((part) => part.trim())
	.find((part) => UPDATE_RE.test(part));

describe("migration: hash stored case invitation codes", () => {
	it("hashes a stored raw code in place so the link already sent still works", async () => {
		expect(UPDATE_STATEMENT).toBeDefined();
		const owner = await createTestUser();
		const invitee = await createTestUser({ email: "sent-before@example.com" });
		const testCase = await createTestCase(owner.id);
		const raw = "f".repeat(64);
		const expiresAt = new Date(Date.now() + 3 * 86_400_000);
		await prisma.caseInvite.create({
			data: {
				caseId: testCase.id,
				email: "sent-before@example.com",
				permission: "COMMENT",
				inviteTokenHash: raw,
				inviteExpiresAt: expiresAt,
				invitedById: owner.id,
			},
		});

		await prisma.$executeRawUnsafe(UPDATE_STATEMENT as string);

		const row = await prisma.caseInvite.findFirstOrThrow({
			where: { caseId: testCase.id },
		});
		expect(row.inviteTokenHash).toBe(
			createHash("sha256").update(raw).digest("hex")
		);
		expect(row.inviteExpiresAt).toEqual(expiresAt);

		const accepted = await acceptInvite(invitee.id, raw);
		expect("data" in accepted && accepted.data.caseId).toBe(testCase.id);
	});
});
