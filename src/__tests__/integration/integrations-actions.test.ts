import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestUser } from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * Mock boundary: `googleapis` only, exactly as `google-drive-service.test.ts`
 * sets it up — `checkGoogleDriveAccess` delegates every token check to
 * `lib/services/google-drive-service.ts`, so this file exercises that same
 * seam rather than mocking the service module directly.
 */
const { mockSetCredentials, mockRefreshAccessToken } = vi.hoisted(() => ({
	mockSetCredentials: vi.fn(),
	mockRefreshAccessToken: vi.fn(),
}));

vi.mock("googleapis", () => {
	class OAuth2 {
		setCredentials = mockSetCredentials;
		refreshAccessToken = mockRefreshAccessToken;
	}
	return { google: { auth: { OAuth2 }, drive: vi.fn() } };
});

beforeEach(async () => {
	await mockNoAuth();
	vi.clearAllMocks();
});

describe("checkGoogleDriveAccess", () => {
	it("returns {connected: false, needsReauthorisation: false} when there is no session", async () => {
		const { checkGoogleDriveAccess } = await import("@/actions/integrations");

		expect(await checkGoogleDriveAccess()).toEqual({
			connected: false,
			needsReauthorisation: false,
		});
	});

	it("returns {connected: false, needsReauthorisation: false} for a user who never linked Google", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { checkGoogleDriveAccess } = await import("@/actions/integrations");

		expect(await checkGoogleDriveAccess()).toEqual({
			connected: false,
			needsReauthorisation: false,
		});
	});

	it("clears a revoked refresh token and returns {connected: false, needsReauthorisation: true} in the same call", async () => {
		const user = await createTestUser();
		await prisma.user.update({
			where: { id: user.id },
			data: {
				googleId: "google-test-id",
				googleEmail: "googleuser@example.com",
				googleAccessToken: "stale-token",
				googleRefreshToken: "stale-refresh-token",
				googleTokenExpiresAt: new Date(Date.now() - 60 * 1000),
			},
		});
		await mockAuth(user.id, user.username, user.email);
		mockRefreshAccessToken.mockRejectedValueOnce(
			Object.assign(new Error("invalid_grant"), {
				response: { data: { error: "invalid_grant" } },
			})
		);

		const { checkGoogleDriveAccess } = await import("@/actions/integrations");
		const result = await checkGoogleDriveAccess();

		expect(result).toEqual({ connected: false, needsReauthorisation: true });

		// The clearing happened inside this same call — `hasGoogleToken` runs
		// first and writes the cleared columns before `needsReauthorisation`
		// is read.
		const updated = await prisma.user.findUnique({ where: { id: user.id } });
		expect(updated?.googleRefreshToken).toBeNull();
		expect(updated?.googleAccessToken).toBeNull();
		expect(updated?.googleId).toBe("google-test-id");
	});
});
