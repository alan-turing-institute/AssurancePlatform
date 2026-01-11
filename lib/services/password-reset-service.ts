"use server";

import crypto from "node:crypto";
import { hashPassword } from "@/lib/auth/password-service";
import { prismaNew } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";

// Configuration
const RESET_TOKEN_EXPIRY_MINUTES = 60;
const MAX_ATTEMPTS_PER_EMAIL_PER_HOUR = 3;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 10;

// Password validation regex patterns (top-level for performance)
const UPPERCASE_REGEX = /[A-Z]/;
const DIGIT_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_,.?":{}|<>]/;

// Types
type RequestResetResult =
	| { success: true }
	| { success: false; error: string; rateLimited?: boolean };

type ValidateTokenResult =
	| { success: true; userId: string; email: string }
	| { success: false; error: string };

type ResetPasswordResult =
	| { success: true }
	| { success: false; error: string };

type SecurityEventParams = {
	eventType: string;
	userId: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata?: object;
};

/**
 * Generate a secure random token for password reset.
 */
function generateResetToken(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * Check if the user has exceeded the rate limit for password reset requests.
 */
async function checkRateLimit(
	email: string,
	ipAddress: string
): Promise<{ allowed: boolean; reason?: string }> {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

	// Check email-based rate limit
	const emailAttempts = await prismaNew.passwordResetAttempt.count({
		where: {
			email: email.toLowerCase(),
			attemptedAt: { gte: oneHourAgo },
		},
	});

	if (emailAttempts >= MAX_ATTEMPTS_PER_EMAIL_PER_HOUR) {
		return {
			allowed: false,
			reason:
				"Too many password reset requests for this email. Please try again later.",
		};
	}

	// Check IP-based rate limit
	const ipAttempts = await prismaNew.passwordResetAttempt.count({
		where: {
			ipAddress,
			attemptedAt: { gte: oneHourAgo },
		},
	});

	if (ipAttempts >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
		return {
			allowed: false,
			reason:
				"Too many password reset requests from your network. Please try again later.",
		};
	}

	return { allowed: true };
}

/**
 * Record a password reset attempt for rate limiting purposes.
 */
async function recordAttempt(
	email: string,
	ipAddress: string,
	successful: boolean
): Promise<void> {
	await prismaNew.passwordResetAttempt.create({
		data: {
			email: email.toLowerCase(),
			ipAddress,
			successful,
		},
	});
}

/**
 * Log a security event for audit purposes.
 */
async function logSecurityEvent(params: SecurityEventParams): Promise<void> {
	await prismaNew.securityAuditLog.create({
		data: {
			userId: params.userId,
			eventType: params.eventType,
			ipAddress: params.ipAddress,
			userAgent: params.userAgent,
			// biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
			metadata: (params.metadata ?? null) as any,
		},
	});
}

/**
 * Request a password reset for the given email.
 * This function is intentionally vague about whether the email exists
 * to prevent user enumeration attacks.
 */
export async function requestPasswordReset(
	email: string,
	ipAddress: string,
	userAgent?: string
): Promise<RequestResetResult> {
	const normalizedEmail = email.toLowerCase().trim();

	// Check rate limit first
	const rateLimitCheck = await checkRateLimit(normalizedEmail, ipAddress);
	if (!rateLimitCheck.allowed) {
		await logSecurityEvent({
			eventType: "password_reset_rate_limited",
			userId: null,
			ipAddress,
			userAgent: userAgent ?? null,
			metadata: { email: normalizedEmail, reason: rateLimitCheck.reason },
		});
		return {
			success: false,
			error: rateLimitCheck.reason ?? "Rate limit exceeded",
			rateLimited: true,
		};
	}

	// Record the attempt
	await recordAttempt(normalizedEmail, ipAddress, false);

	// Look up the user
	const user = await prismaNew.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true, username: true, authProvider: true },
	});

	// If user doesn't exist or uses OAuth, pretend success to prevent enumeration
	if (!user || user.authProvider !== "LOCAL") {
		await logSecurityEvent({
			eventType: "password_reset_requested_invalid_user",
			userId: null,
			ipAddress,
			userAgent: userAgent ?? null,
			metadata: {
				email: normalizedEmail,
				reason: user ? "oauth_user" : "user_not_found",
			},
		});
		// Return success to prevent user enumeration
		return { success: true };
	}

	// Generate reset token and expiry
	const resetToken = generateResetToken();
	const resetExpires = new Date(
		Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
	);

	// Store the token
	await prismaNew.user.update({
		where: { id: user.id },
		data: {
			passwordResetToken: resetToken,
			passwordResetExpires: resetExpires,
		},
	});

	// Send the email
	const emailResult = await sendPasswordResetEmail({
		to: normalizedEmail,
		username: user.username,
		resetToken,
		expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
	});

	if (!emailResult.success) {
		await logSecurityEvent({
			eventType: "password_reset_email_failed",
			userId: user.id,
			ipAddress,
			userAgent: userAgent ?? null,
			metadata: { error: emailResult.error },
		});
		// Still return success to prevent enumeration
		return { success: true };
	}

	await logSecurityEvent({
		eventType: "password_reset_requested",
		userId: user.id,
		ipAddress,
		userAgent: userAgent ?? null,
		metadata: { emailSent: true },
	});

	return { success: true };
}

/**
 * Validate a password reset token.
 */
export async function validateResetToken(
	token: string
): Promise<ValidateTokenResult> {
	if (!token || token.length !== 64) {
		return { success: false, error: "Invalid reset token" };
	}

	const user = await prismaNew.user.findFirst({
		where: {
			passwordResetToken: token,
			passwordResetExpires: { gt: new Date() },
		},
		select: { id: true, email: true },
	});

	if (!user) {
		return { success: false, error: "Invalid or expired reset token" };
	}

	return { success: true, userId: user.id, email: user.email };
}

/**
 * Reset the user's password using a valid reset token.
 */
export async function resetPassword(
	token: string,
	newPassword: string,
	ipAddress: string,
	userAgent?: string
): Promise<ResetPasswordResult> {
	// Validate the token first
	const validation = await validateResetToken(token);
	if (!validation.success) {
		await logSecurityEvent({
			eventType: "password_reset_invalid_token",
			userId: null,
			ipAddress,
			userAgent: userAgent ?? null,
			metadata: { tokenLength: token?.length },
		});
		return { success: false, error: validation.error };
	}

	// Validate password strength
	if (newPassword.length < 8) {
		return { success: false, error: "Password must be at least 8 characters" };
	}
	if (!UPPERCASE_REGEX.test(newPassword)) {
		return {
			success: false,
			error: "Password must contain at least one uppercase letter",
		};
	}
	if (!DIGIT_REGEX.test(newPassword)) {
		return {
			success: false,
			error: "Password must contain at least one number",
		};
	}
	if (!SPECIAL_CHAR_REGEX.test(newPassword)) {
		return {
			success: false,
			error: "Password must contain at least one special character",
		};
	}

	// Hash the new password
	const passwordHash = await hashPassword(newPassword);

	// Update the user's password and clear the reset token
	await prismaNew.user.update({
		where: { id: validation.userId },
		data: {
			passwordHash,
			passwordAlgorithm: "argon2id",
			passwordResetToken: null,
			passwordResetExpires: null,
		},
	});

	// Update the attempt record to mark as successful
	await prismaNew.passwordResetAttempt.updateMany({
		where: {
			email: validation.email.toLowerCase(),
			successful: false,
		},
		data: {
			successful: true,
		},
	});

	await logSecurityEvent({
		eventType: "password_reset_completed",
		userId: validation.userId,
		ipAddress,
		userAgent: userAgent ?? null,
	});

	return { success: true };
}

/**
 * Clean up expired password reset tokens and old attempt records.
 * This should be called periodically (e.g., via a cron job).
 */
export async function cleanupExpiredTokens(): Promise<{
	clearedTokens: number;
	clearedAttempts: number;
}> {
	// Clear expired reset tokens
	const tokenResult = await prismaNew.user.updateMany({
		where: {
			passwordResetExpires: { lt: new Date() },
			passwordResetToken: { not: null },
		},
		data: {
			passwordResetToken: null,
			passwordResetExpires: null,
		},
	});

	// Clear old attempt records (older than 24 hours)
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const attemptResult = await prismaNew.passwordResetAttempt.deleteMany({
		where: {
			attemptedAt: { lt: oneDayAgo },
		},
	});

	return {
		clearedTokens: tokenResult.count,
		clearedAttempts: attemptResult.count,
	};
}
