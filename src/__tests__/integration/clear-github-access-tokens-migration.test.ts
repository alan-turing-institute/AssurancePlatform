import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { encryptToken } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Pins the data migration
 * `prisma/migrations/20261108120000_clear_github_access_tokens/migration.sql`.
 *
 * Reads and executes the migration file's ACTUAL SQL (not a hand-copied
 * predicate that could drift from what `prisma migrate deploy` applies)
 * against rows set up with `prisma` directly.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20261108120000_clear_github_access_tokens/migration.sql"
	),
	"utf8"
);

async function runMigration(): Promise<void> {
	// The file is one statement preceded by `--` comments, sent verbatim.
	await prisma.$executeRawUnsafe(MIGRATION_SQL);
}

describe("migration: clear stored GitHub access tokens", () => {
	it("clears the GitHub token and its expiry but keeps the GitHub id", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: {
				githubId: "424242",
				githubUsername: "octo-person",
				githubAccessToken: encryptToken("gho_stored_with_repo_scope"),
				githubTokenExpiresAt: new Date("2030-01-01T00:00:00Z"),
			},
		});

		await runMigration();

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.githubAccessToken).toBeNull();
		expect(after.githubTokenExpiresAt).toBeNull();
		expect(after.githubId).toBe("424242");
		expect(after.githubUsername).toBe("octo-person");
	});

	it("leaves Google tokens and accounts with no GitHub token unchanged", async () => {
		const googleUser = await createTestUser();
		const googleExpiry = new Date("2030-06-01T00:00:00Z");
		await prisma.user.update({
			where: { id: googleUser.id },
			data: {
				googleId: "google-id-1",
				googleAccessToken: encryptToken("google-access"),
				googleRefreshToken: encryptToken("google-refresh"),
				googleTokenExpiresAt: googleExpiry,
				githubId: "515151",
				githubAccessToken: encryptToken("gho_other"),
			},
		});
		const plainUser = await createTestUser();

		const googleBefore = await prisma.user.findUniqueOrThrow({
			where: { id: googleUser.id },
		});
		const plainBefore = await prisma.user.findUniqueOrThrow({
			where: { id: plainUser.id },
		});

		await runMigration();

		const googleAfter = await prisma.user.findUniqueOrThrow({
			where: { id: googleUser.id },
		});
		expect(googleAfter.googleAccessToken).toBe(googleBefore.googleAccessToken);
		expect(googleAfter.googleRefreshToken).toBe(
			googleBefore.googleRefreshToken
		);
		expect(googleAfter.googleTokenExpiresAt).toEqual(googleExpiry);
		expect(googleAfter.githubAccessToken).toBeNull();

		const plainAfter = await prisma.user.findUniqueOrThrow({
			where: { id: plainUser.id },
		});
		expect(plainAfter).toEqual(plainBefore);
	});
});
