import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	requestPasswordReset,
	resetPassword,
	validateResetToken,
} from "@/lib/services/password-reset-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestUser,
	getTestPasswordResetToken,
} from "../utils/prisma-factories";

// The email service is an external Azure Communication Services boundary — mock it.
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi.fn().mockResolvedValue({
		success: true,
		messageId: "mock-message-id",
	}),
}));

// ============================================
// Helpers
// ============================================

/** A strong password that satisfies all validation rules. */
const STRONG_PASSWORD = "StrongP@ss1";

/** A fixed IP address used throughout rate-limit tests. */
const TEST_IP = "127.0.0.1";

const TOO_SHORT_PATTERN = /8 characters/;
const NO_UPPERCASE_PATTERN = /uppercase/;
const NO_DIGIT_PATTERN = /number/;
const NO_SPECIAL_CHAR_PATTERN = /special character/;

// ============================================
// requestPasswordReset
// ============================================

describe("requestPasswordReset", () => {
	it("creates a reset token on the user record for a LOCAL user", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		expectSuccess(await requestPasswordReset(user.email, TEST_IP));

		const token = await getTestPasswordResetToken(user.id);
		expect(token).not.toBeNull();
		expect(typeof token).toBe("string");
		expect(token).toHaveLength(64); // 32 random bytes as hex
	});

	it("returns success for a non-existent email (anti-enumeration)", async () => {
		// Must succeed silently — must not reveal whether the address exists
		expectSuccess(await requestPasswordReset("nobody@example.com", TEST_IP));
	});

	it("returns success for an OAuth-only user (anti-enumeration)", async () => {
		const user = await createTestUser({ authProvider: "GITHUB" });

		// Must succeed silently — must not reveal that the account is OAuth-only
		expectSuccess(await requestPasswordReset(user.email, TEST_IP));

		// The OAuth user should have no reset token set
		const token = await getTestPasswordResetToken(user.id);
		expect(token).toBeNull();
	});

	it("rate-limits after 3 requests for the same email within an hour", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		// Seed 3 existing attempts so the next call is the 4th (over limit)
		await prisma.passwordResetAttempt.createMany({
			data: [
				{
					email: user.email.toLowerCase(),
					ipAddress: "10.0.0.1",
					successful: false,
					attemptedAt: new Date(),
				},
				{
					email: user.email.toLowerCase(),
					ipAddress: "10.0.0.2",
					successful: false,
					attemptedAt: new Date(),
				},
				{
					email: user.email.toLowerCase(),
					ipAddress: "10.0.0.3",
					successful: false,
					attemptedAt: new Date(),
				},
			],
		});

		// Use a fresh IP that has not hit its own IP-level limit
		const result = await requestPasswordReset(user.email, "10.1.1.1");

		expectError(result);
		if ("error" in result) {
			expect(result.rateLimited).toBe(true);
		}
	});
});

// ============================================
// validateResetToken
// ============================================

describe("validateResetToken", () => {
	it("returns userId and email for a valid, unexpired token", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await requestPasswordReset(user.email, TEST_IP);

		const token = await getTestPasswordResetToken(user.id);
		expect(token).not.toBeNull();

		const data = expectSuccess(await validateResetToken(token as string));
		expect(data.userId).toBe(user.id);
		expect(data.email).toBe(user.email);
	});

	it("returns invalid for an expired token (older than 60 minutes)", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		// Write an expired token directly — service would not expose this
		const expiredToken = "a".repeat(64);
		const expiredAt = new Date(Date.now() - 61 * 60 * 1000);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: expiredToken,
				passwordResetExpires: expiredAt,
			},
		});

		expectError(
			await validateResetToken(expiredToken),
			"Invalid or expired reset token"
		);
	});

	it("returns invalid for a token with wrong format (not 64 hex chars)", async () => {
		expectError(await validateResetToken("short"), "Invalid reset token");
	});

	it("returns invalid for a well-formatted but non-existent token", async () => {
		const nonExistentToken = "b".repeat(64);

		expectError(
			await validateResetToken(nonExistentToken),
			"Invalid or expired reset token"
		);
	});
});

// ============================================
// resetPassword
// ============================================

describe("resetPassword", () => {
	/**
	 * Helper: creates a LOCAL user with a valid (unexpired) reset token set
	 * in the database, then returns both the user and the raw token string.
	 */
	async function createUserWithValidToken(): Promise<{
		userId: string;
		email: string;
		token: string;
	}> {
		const user = await createTestUser({ authProvider: "LOCAL" });
		await requestPasswordReset(user.email, TEST_IP);
		const token = await getTestPasswordResetToken(user.id);
		if (!token) {
			throw new Error("Token was not created");
		}
		return { userId: user.id, email: user.email, token };
	}

	it("succeeds with a valid token and strong password", async () => {
		const { token } = await createUserWithValidToken();

		expectSuccess(await resetPassword(token, STRONG_PASSWORD, TEST_IP));
	});

	it("clears the reset token from the user record after success", async () => {
		const { userId, token } = await createUserWithValidToken();

		await resetPassword(token, STRONG_PASSWORD, TEST_IP);

		const inDb = await prisma.user.findUnique({
			where: { id: userId },
			select: { passwordResetToken: true, passwordResetExpires: true },
		});
		expect(inDb?.passwordResetToken).toBeNull();
		expect(inDb?.passwordResetExpires).toBeNull();
	});

	it("rejects a password that is too short (fewer than 8 characters)", async () => {
		const { token } = await createUserWithValidToken();

		const result = await resetPassword(token, "Ab1!", TEST_IP);
		expectError(result, TOO_SHORT_PATTERN);
	});

	it("rejects a password with no uppercase letter", async () => {
		const { token } = await createUserWithValidToken();

		const result = await resetPassword(token, "alllower1!", TEST_IP);
		expectError(result, NO_UPPERCASE_PATTERN);
	});

	it("rejects a password with no digit", async () => {
		const { token } = await createUserWithValidToken();

		const result = await resetPassword(token, "NoDigits!", TEST_IP);
		expectError(result, NO_DIGIT_PATTERN);
	});

	it("rejects a password with no special character", async () => {
		const { token } = await createUserWithValidToken();

		const result = await resetPassword(token, "NoSpecial1", TEST_IP);
		expectError(result, NO_SPECIAL_CHAR_PATTERN);
	});

	it("rejects an expired token", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		const expiredToken = "c".repeat(64);
		const expiredAt = new Date(Date.now() - 61 * 60 * 1000);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetToken: expiredToken,
				passwordResetExpires: expiredAt,
			},
		});

		expectError(
			await resetPassword(expiredToken, STRONG_PASSWORD, TEST_IP),
			"Invalid or expired reset token"
		);
	});

	it("rejects a non-existent token", async () => {
		const nonExistentToken = "d".repeat(64);

		expectError(
			await resetPassword(nonExistentToken, STRONG_PASSWORD, TEST_IP),
			"Invalid or expired reset token"
		);
	});

	it("clears the reset token from the database on successful reset (security audit)", async () => {
		// logSecurityEvent writes to the console only — there is no SecurityAuditLog
		// DB table used for password_reset_completed. We verify the reset happened
		// correctly by confirming the token is cleared and the password is updated.
		const { userId, token } = await createUserWithValidToken();

		expectSuccess(await resetPassword(token, STRONG_PASSWORD, TEST_IP));

		const inDb = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				passwordResetToken: true,
				passwordResetExpires: true,
				passwordHash: true,
			},
		});
		// Token must be cleared after successful reset
		expect(inDb?.passwordResetToken).toBeNull();
		expect(inDb?.passwordResetExpires).toBeNull();
		// Password hash must be set
		expect(inDb?.passwordHash).not.toBeNull();
	});

	it("updates the PasswordResetAttempt record to successful=true on success", async () => {
		const { email, token } = await createUserWithValidToken();

		await resetPassword(token, STRONG_PASSWORD, TEST_IP);

		// The attempt record seeded by requestPasswordReset should now be marked successful
		const attempt = await prisma.passwordResetAttempt.findFirst({
			where: { email: email.toLowerCase(), successful: true },
			orderBy: { attemptedAt: "desc" },
		});
		expect(attempt).not.toBeNull();
		expect(attempt?.successful).toBe(true);
	});
});
