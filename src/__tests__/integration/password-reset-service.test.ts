import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password-service";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import {
	cleanupExpiredTokens,
	requestPasswordReset,
	resetPassword,
	validateResetToken,
} from "@/lib/services/password-reset-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestUser,
	getTestPasswordResetTokenHash,
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

/** A second strong password, distinct from STRONG_PASSWORD, for the
 * concurrent-consumption test (it must be able to tell which one won). */
const OTHER_STRONG_PASSWORD = "OtherStr0ng!Pass";

/** A fixed IP address used throughout rate-limit tests. */
const TEST_IP = "127.0.0.1";

const TOO_SHORT_PATTERN = /8 characters/;
const NO_UPPERCASE_PATTERN = /uppercase/;
const NO_DIGIT_PATTERN = /number/;
const NO_SPECIAL_CHAR_PATTERN = /special character/;

const INVALID_TOKEN_MESSAGE = "Invalid or expired reset token";

/**
 * The raw reset token never touches the database (AP-QA-006) — the only
 * place it appears is the outbound email. Reads it back from the mocked
 * `sendPasswordResetEmail`'s last call.
 */
function getCapturedResetToken(): string {
	const calls = vi.mocked(sendPasswordResetEmail).mock.calls;
	const lastCall = calls.at(-1);
	if (!lastCall) {
		throw new Error("sendPasswordResetEmail was not called");
	}
	return lastCall[0].resetToken;
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

// ============================================
// requestPasswordReset
// ============================================

describe("requestPasswordReset", () => {
	it("creates a reset token on the user record for a LOCAL user", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		expectSuccess(await requestPasswordReset(user.email, TEST_IP));

		const token = getCapturedResetToken();
		expect(typeof token).toBe("string");
		expect(token).toHaveLength(64); // 32 random bytes as hex
	});

	it("stores only the SHA-256 hash of the token, never the raw token", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		expectSuccess(await requestPasswordReset(user.email, TEST_IP));

		const token = getCapturedResetToken();
		const storedHash = await getTestPasswordResetTokenHash(user.id);

		expect(storedHash).toBe(sha256Hex(token));
		expect(storedHash).not.toBe(token);
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
		const tokenHash = await getTestPasswordResetTokenHash(user.id);
		expect(tokenHash).toBeNull();
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

		const token = getCapturedResetToken();

		const data = expectSuccess(await validateResetToken(token));
		expect(data.userId).toBe(user.id);
		expect(data.email).toBe(user.email);
	});

	it("returns invalid for an expired token (older than 60 minutes)", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		// Write an expired token's hash directly — service would not expose this
		const expiredToken = "a".repeat(64);
		const expiredAt = new Date(Date.now() - 61 * 60 * 1000);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetTokenHash: sha256Hex(expiredToken),
				passwordResetExpires: expiredAt,
			},
		});

		expectError(await validateResetToken(expiredToken), INVALID_TOKEN_MESSAGE);
	});

	it("returns invalid for a token with wrong format (not 64 hex chars)", async () => {
		expectError(await validateResetToken("short"), INVALID_TOKEN_MESSAGE);
	});

	it("returns invalid for a well-formatted but non-existent token", async () => {
		const nonExistentToken = "b".repeat(64);

		expectError(
			await validateResetToken(nonExistentToken),
			INVALID_TOKEN_MESSAGE
		);
	});

	it("malformed, expired and unknown tokens return byte-identical errors", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		const expiredToken = "a1".repeat(32);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetTokenHash: sha256Hex(expiredToken),
				passwordResetExpires: new Date(Date.now() - 60 * 1000),
			},
		});

		const malformed = await validateResetToken("short");
		const expired = await validateResetToken(expiredToken);
		const unknown = await validateResetToken("b1".repeat(32));

		expectSameError(malformed, expired);
		expectSameError(expired, unknown);
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
		const token = getCapturedResetToken();
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
			select: { passwordResetTokenHash: true, passwordResetExpires: true },
		});
		expect(inDb?.passwordResetTokenHash).toBeNull();
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
				passwordResetTokenHash: sha256Hex(expiredToken),
				passwordResetExpires: expiredAt,
			},
		});

		expectError(
			await resetPassword(expiredToken, STRONG_PASSWORD, TEST_IP),
			INVALID_TOKEN_MESSAGE
		);
	});

	it("rejects a non-existent token", async () => {
		const nonExistentToken = "d".repeat(64);

		expectError(
			await resetPassword(nonExistentToken, STRONG_PASSWORD, TEST_IP),
			INVALID_TOKEN_MESSAGE
		);
	});

	it("rejects a malformed token (wrong length) with the same error as any other invalid token, without touching sessionVersion", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		const result = await resetPassword("short", STRONG_PASSWORD, TEST_IP);
		expectError(result, INVALID_TOKEN_MESSAGE);

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.sessionVersion).toBe(user.sessionVersion);
	});

	it("rejects a replayed token after a successful reset, with the same error as any other invalid token", async () => {
		const { token } = await createUserWithValidToken();

		expectSuccess(await resetPassword(token, STRONG_PASSWORD, TEST_IP));

		const replay = await resetPassword(token, OTHER_STRONG_PASSWORD, TEST_IP);
		expectError(replay, INVALID_TOKEN_MESSAGE);
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
				passwordResetTokenHash: true,
				passwordResetExpires: true,
				passwordHash: true,
			},
		});
		// Token must be cleared after successful reset
		expect(inDb?.passwordResetTokenHash).toBeNull();
		expect(inDb?.passwordResetExpires).toBeNull();
		// Password hash must be set
		expect(inDb?.passwordHash).not.toBeNull();
	});

	it("consumes the token atomically: exactly one of two concurrent resets wins", async () => {
		const { userId, token } = await createUserWithValidToken();

		const [resultA, resultB] = await Promise.all([
			resetPassword(token, STRONG_PASSWORD, TEST_IP),
			resetPassword(token, OTHER_STRONG_PASSWORD, TEST_IP),
		]);

		const results = [resultA, resultB];
		const successes = results.filter((r) => "data" in r);
		const failures = results.filter((r) => "error" in r);
		expect(successes).toHaveLength(1);
		expect(failures).toHaveLength(1);
		expectError(failures[0] as { error: string }, INVALID_TOKEN_MESSAGE);

		// The winning password is the one whose result was successful; the
		// stored hash must verify against it and only it.
		const winningPassword =
			resultA === successes[0] ? STRONG_PASSWORD : OTHER_STRONG_PASSWORD;
		const losingPassword =
			winningPassword === STRONG_PASSWORD
				? OTHER_STRONG_PASSWORD
				: STRONG_PASSWORD;

		const inDb = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { passwordHash: true, passwordAlgorithm: true },
		});
		const winnerCheck = await verifyPassword(
			winningPassword,
			inDb.passwordHash as string,
			inDb.passwordAlgorithm as "argon2id"
		);
		const loserCheck = await verifyPassword(
			losingPassword,
			inDb.passwordHash as string,
			inDb.passwordAlgorithm as "argon2id"
		);
		expect(winnerCheck.valid).toBe(true);
		expect(loserCheck.valid).toBe(false);
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

	it("increments sessionVersion by exactly one on success", async () => {
		const { userId, token } = await createUserWithValidToken();
		const before = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});

		expectSuccess(await resetPassword(token, STRONG_PASSWORD, TEST_IP));

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
		});
		expect(after.sessionVersion).toBe(before.sessionVersion + 1);
	});
});

// ============================================
// sessionVersion — unaffected paths (AP-QA-003)
// ============================================

describe("sessionVersion — unaffected paths", () => {
	it("requestPasswordReset leaves sessionVersion unchanged", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		expectSuccess(await requestPasswordReset(user.email, TEST_IP));

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.sessionVersion).toBe(user.sessionVersion);
	});

	it("an invalid-token resetPassword leaves sessionVersion unchanged", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });

		expectError(
			await resetPassword("e".repeat(64), STRONG_PASSWORD, TEST_IP),
			INVALID_TOKEN_MESSAGE
		);

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.sessionVersion).toBe(user.sessionVersion);
	});

	it("cleanupExpiredTokens leaves sessionVersion unchanged", async () => {
		const user = await createTestUser({ authProvider: "LOCAL" });
		const expiredToken = "f".repeat(64);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordResetTokenHash: sha256Hex(expiredToken),
				passwordResetExpires: new Date(Date.now() - 61 * 60 * 1000),
			},
		});

		await cleanupExpiredTokens();

		const after = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
		});
		expect(after.sessionVersion).toBe(user.sessionVersion);
	});
});
