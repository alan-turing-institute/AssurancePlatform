import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	requestPasswordReset,
	resetPassword,
	validateResetToken,
} from "@/lib/services/password-reset-service";
import { createTestUser } from "../utils/prisma-factories";

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

/**
 * Queries the user record and returns the current passwordResetToken.
 * Used after requestPasswordReset to retrieve the generated token.
 */
async function getResetToken(userId: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { passwordResetToken: true },
	});
	return user?.passwordResetToken ?? null;
}

type RequestResetResult = {
	success: boolean;
	rateLimited?: boolean;
	error?: string;
};

type ValidateTokenResult = {
	success: boolean;
	userId?: string;
	email?: string;
	error?: string;
};

type ResetPasswordResult = {
	success: boolean;
	error?: string;
};

// ============================================
// requestPasswordReset
// ============================================

describe("requestPasswordReset", () => {
	it("creates a reset token on the user record for a LOCAL user", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		const result = (await requestPasswordReset(
			user.email,
			TEST_IP
		)) as unknown as RequestResetResult;

		expect(result.success).toBe(true);

		const token = await getResetToken(user.id);
		expect(token).not.toBeNull();
		expect(typeof token).toBe("string");
		expect(token).toHaveLength(64); // 32 random bytes as hex
	});

	it("returns success for a non-existent email (anti-enumeration)", async () => {
		const result = (await requestPasswordReset(
			"nobody@example.com",
			TEST_IP
		)) as unknown as RequestResetResult;

		// Must succeed silently — must not reveal whether the address exists
		expect(result.success).toBe(true);
	});

	it("returns success for an OAuth-only user (anti-enumeration)", async () => {
		const user = await createTestUser({ authProvider: "GITHUB" });

		const result = (await requestPasswordReset(
			user.email,
			TEST_IP
		)) as unknown as RequestResetResult;

		// Must succeed silently — must not reveal that the account is OAuth-only
		expect(result.success).toBe(true);

		// The OAuth user should have no reset token set
		const token = await getResetToken(user.id);
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
		const result = (await requestPasswordReset(
			user.email,
			"10.1.1.1"
		)) as unknown as RequestResetResult;

		expect(result.success).toBe(false);
		if (!result.success) {
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

		const token = await getResetToken(user.id);
		expect(token).not.toBeNull();

		const result = (await validateResetToken(
			token as string
		)) as unknown as ValidateTokenResult;

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.userId).toBe(user.id);
			expect(result.email).toBe(user.email);
		}
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

		const result = (await validateResetToken(
			expiredToken
		)) as unknown as ValidateTokenResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid or expired reset token");
		}
	});

	it("returns invalid for a token with wrong format (not 64 hex chars)", async () => {
		const result = (await validateResetToken(
			"short"
		)) as unknown as ValidateTokenResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid reset token");
		}
	});

	it("returns invalid for a well-formatted but non-existent token", async () => {
		const nonExistentToken = "b".repeat(64);

		const result = (await validateResetToken(
			nonExistentToken
		)) as unknown as ValidateTokenResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid or expired reset token");
		}
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
		const token = await getResetToken(user.id);
		if (!token) {
			throw new Error("Token was not created");
		}
		return { userId: user.id, email: user.email, token };
	}

	it("succeeds with a valid token and strong password", async () => {
		const { token } = await createUserWithValidToken();

		const result = (await resetPassword(
			token,
			STRONG_PASSWORD,
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(true);
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

		const result = (await resetPassword(
			token,
			"Ab1!",
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("8 characters");
		}
	});

	it("rejects a password with no uppercase letter", async () => {
		const { token } = await createUserWithValidToken();

		const result = (await resetPassword(
			token,
			"alllower1!",
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("uppercase");
		}
	});

	it("rejects a password with no digit", async () => {
		const { token } = await createUserWithValidToken();

		const result = (await resetPassword(
			token,
			"NoDigits!",
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("number");
		}
	});

	it("rejects a password with no special character", async () => {
		const { token } = await createUserWithValidToken();

		const result = (await resetPassword(
			token,
			"NoSpecial1",
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("special character");
		}
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

		const result = (await resetPassword(
			expiredToken,
			STRONG_PASSWORD,
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid or expired reset token");
		}
	});

	it("rejects a non-existent token", async () => {
		const nonExistentToken = "d".repeat(64);

		const result = (await resetPassword(
			nonExistentToken,
			STRONG_PASSWORD,
			TEST_IP
		)) as unknown as ResetPasswordResult;

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid or expired reset token");
		}
	});

	it("creates a SecurityAuditLog entry on successful reset", async () => {
		const { userId, token } = await createUserWithValidToken();

		await resetPassword(token, STRONG_PASSWORD, TEST_IP);

		const auditLog = await prisma.securityAuditLog.findFirst({
			where: { userId, eventType: "password_reset_completed" },
			orderBy: { createdAt: "desc" },
		});
		expect(auditLog).not.toBeNull();
		expect(auditLog?.ipAddress).toBe(TEST_IP);
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
