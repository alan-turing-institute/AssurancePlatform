import type { JWT } from "next-auth/jwt";
import { describe, expect, it, vi } from "vitest";
import { authOptions } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import { SessionRevokedError } from "@/lib/auth/session-version";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import {
	requestPasswordReset,
	resetPassword,
} from "@/lib/services/password-reset-service";
import { changePassword } from "@/lib/services/user-management-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { createTestUser } from "../utils/prisma-factories";

// The reset token never touches the database (AP-QA-006) — capture it from
// the mocked outbound email instead.
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
}));

/**
 * Exercises `authOptions.callbacks.jwt` (lib/auth/config.ts) directly against
 * real Postgres — the AP-QA-003 revocation lever: a per-user session version
 * stamped into the token at sign-in and checked on every later read. Same
 * technique as `auth-link-intent.test.ts` for driving a callback function
 * without spinning up next-auth's HTTP routes.
 */

const jwt = authOptions.callbacks?.jwt;
if (!jwt) {
	throw new Error("authOptions.callbacks.jwt must be configured");
}
type JwtParams = Parameters<typeof jwt>[0];

const CURRENT_PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "StrongP@ss1";
const TEST_IP = "127.0.0.1";

/** Minimal sign-in call: only `user` matters to the callback's initial-sign-in branch. */
function signInParams(userId: string, provider = "credentials"): JwtParams {
	return {
		token: {} as JWT,
		user: { id: userId, provider },
	} as JwtParams;
}

describe("callbacks.jwt — session version (AP-QA-003)", () => {
	it("stamps the user's current session version on initial sign-in", async () => {
		const user = await createTestUser();

		const token = await jwt(signInParams(user.id));

		expect(token.id).toBe(user.id);
		expect(token.sessionVersion).toBe(user.sessionVersion);
	});

	it("passes a matching token through unchanged", async () => {
		const user = await createTestUser();
		const signedInToken = await jwt(signInParams(user.id));

		const result = await jwt({ token: signedInToken } as JwtParams);

		expect(result).toEqual(signedInToken);
	});

	it("throws SessionRevokedError for a token from before changePassword, and a fresh sign-in passes", async () => {
		const passwordHash = await hashPassword(CURRENT_PASSWORD);
		const user = await createTestUser({ passwordHash, authProvider: "LOCAL" });
		const oldToken = await jwt(signInParams(user.id));

		expectSuccess(
			await changePassword(user.id, {
				currentPassword: CURRENT_PASSWORD,
				newPassword: NEW_PASSWORD,
			})
		);

		await expect(jwt({ token: oldToken } as JwtParams)).rejects.toThrow(
			SessionRevokedError
		);

		const newToken = await jwt(signInParams(user.id));
		expect(newToken.sessionVersion).toBe(user.sessionVersion + 1);
		await expect(jwt({ token: newToken } as JwtParams)).resolves.toEqual(
			newToken
		);
	});

	it("throws SessionRevokedError for a token from before resetPassword, and a fresh sign-in passes", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		const oldToken = await jwt(signInParams(user.id));

		await requestPasswordReset(user.email, TEST_IP);
		const calls = vi.mocked(sendPasswordResetEmail).mock.calls;
		const lastCall = calls.at(-1);
		if (!lastCall) {
			throw new Error("sendPasswordResetEmail was not called");
		}
		const resetToken = lastCall[0].resetToken;
		expectSuccess(await resetPassword(resetToken, NEW_PASSWORD, TEST_IP));

		await expect(jwt({ token: oldToken } as JwtParams)).rejects.toThrow(
			SessionRevokedError
		);

		const newToken = await jwt(signInParams(user.id));
		expect(newToken.sessionVersion).toBe(user.sessionVersion + 1);
		await expect(jwt({ token: newToken } as JwtParams)).resolves.toEqual(
			newToken
		);
	});

	it("throws SessionRevokedError for a token with no sessionVersion claim", async () => {
		const user = await createTestUser();

		await expect(
			jwt({ token: { id: user.id } as JWT } as JwtParams)
		).rejects.toThrow(SessionRevokedError);
	});

	it("throws SessionRevokedError for a deleted user's token", async () => {
		const user = await createTestUser();
		const token = await jwt(signInParams(user.id));

		await prisma.user.delete({ where: { id: user.id } });

		await expect(jwt({ token } as JwtParams)).rejects.toThrow(
			SessionRevokedError
		);
	});

	it("leaves a GITHUB user's token passing after another user's password change and after their own password-reset request", async () => {
		const githubUser = await createTestUser({ authProvider: "GITHUB" });
		const githubToken = await jwt(signInParams(githubUser.id, "github"));

		const passwordHash = await hashPassword(CURRENT_PASSWORD);
		const otherUser = await createTestUser({
			passwordHash,
			authProvider: "LOCAL",
		});
		expectSuccess(
			await changePassword(otherUser.id, {
				currentPassword: CURRENT_PASSWORD,
				newPassword: NEW_PASSWORD,
			})
		);

		await expect(jwt({ token: githubToken } as JwtParams)).resolves.toEqual(
			githubToken
		);

		// requestPasswordReset on an OAuth user's own email is a no-op
		// (non-LOCAL accounts are skipped, anti-enumeration) — must not bump
		// their sessionVersion either.
		await requestPasswordReset(githubUser.email, TEST_IP);

		await expect(jwt({ token: githubToken } as JwtParams)).resolves.toEqual(
			githubToken
		);
	});
});
