import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	getConnectedAccounts,
	unlinkProvider,
} from "@/lib/services/connected-accounts-service";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Pure-DB service — no SDK, so no `googleapis` mock is needed here (per the
 * issue's Design section). Real Postgres throughout, per repo convention.
 */

/** Connects Google on a test user's row via direct Prisma update. */
function connectGoogle(
	userId: string,
	overrides: Partial<{ googleRefreshToken: string | null }> = {}
) {
	return prisma.user.update({
		where: { id: userId },
		data: {
			googleId: "google-account-id",
			googleEmail: "connected@example.com",
			googleAccessToken: "access-token",
			googleRefreshToken:
				overrides.googleRefreshToken === undefined
					? "refresh-token"
					: overrides.googleRefreshToken,
			googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
		},
	});
}

describe("getConnectedAccounts", () => {
	it("reports hasDriveAccess true when Google is connected with a refresh token", async () => {
		const user = await createTestUser();
		await connectGoogle(user.id);

		const result = await getConnectedAccounts(user.id);
		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			throw new Error("expected success");
		}
		expect(result.data.google.connected).toBe(true);
		expect(result.data.google.hasDriveAccess).toBe(true);
	});

	it("reports hasDriveAccess false when Google is connected without a refresh token", async () => {
		const user = await createTestUser();
		await connectGoogle(user.id, { googleRefreshToken: null });

		const result = await getConnectedAccounts(user.id);
		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			throw new Error("expected success");
		}
		expect(result.data.google.connected).toBe(true);
		expect(result.data.google.hasDriveAccess).toBe(false);
	});
});

describe("unlinkProvider('google')", () => {
	it("clears all five Google columns and, when Google was the sign-in provider, switches authProvider to LOCAL (password present)", async () => {
		const user = await createTestUser({ authProvider: "GOOGLE" });
		await connectGoogle(user.id);

		const result = await unlinkProvider(user.id, "google");
		expect("data" in result).toBe(true);

		const updated = await prisma.user.findUnique({ where: { id: user.id } });
		expect(updated?.googleId).toBeNull();
		expect(updated?.googleEmail).toBeNull();
		expect(updated?.googleAccessToken).toBeNull();
		expect(updated?.googleRefreshToken).toBeNull();
		expect(updated?.googleTokenExpiresAt).toBeNull();
		expect(updated?.authProvider).toBe("LOCAL");
	});

	it("refuses to unlink Google when it is the account's only sign-in method", async () => {
		const user = await createTestUser({ authProvider: "GOOGLE" });
		await prisma.user.update({
			where: { id: user.id },
			data: { passwordHash: null },
		});
		await connectGoogle(user.id);

		const result = await unlinkProvider(user.id, "google");
		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.error).toBe(
			"Cannot disconnect Google. It is your only way to sign in. Connect another provider first."
		);

		// The guard fired before any write — columns are untouched.
		const unchanged = await prisma.user.findUnique({ where: { id: user.id } });
		expect(unchanged?.googleId).toBe("google-account-id");
	});

	it("returns an error when Google is not connected", async () => {
		const user = await createTestUser();

		const result = await unlinkProvider(user.id, "google");
		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.error).toBe("Google is not connected to your account.");
	});
});
