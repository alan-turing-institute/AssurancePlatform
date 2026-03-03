import crypto from "node:crypto";
import { logSecurityEvent } from "@/lib/audit/security-log";
import { hashPassword } from "@/lib/auth/password-service";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import { validatePassword } from "@/lib/validation/validators";

// Configuration
const RESET_TOKEN_EXPIRY_MINUTES = 60;
const MAX_ATTEMPTS_PER_EMAIL_PER_HOUR = 3;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 10;

// Types
type RequestResetResult =
	| { data: null }
	| { error: string; rateLimited?: true };

type ValidateTokenResult =
	| { data: { userId: string; email: string } }
	| { error: string };

type ResetPasswordResult = { data: null } | { error: string };

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
	const emailAttempts = await prisma.passwordResetAttempt.count({
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
	const ipAttempts = await prisma.passwordResetAttempt.count({
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
	await prisma.passwordResetAttempt.create({
		data: {
			email: email.toLowerCase(),
			ipAddress,
			successful,
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
		logSecurityEvent({
			event: "password_reset_rate_limited",
			severity: "medium",
			metadata: {
				email: normalizedEmail,
				ipAddress,
				userAgent: userAgent ?? null,
				reason: rateLimitCheck.reason,
			},
		});
		return {
			error: rateLimitCheck.reason ?? "Rate limit exceeded",
			rateLimited: true,
		};
	}

	// Record the attempt
	await recordAttempt(normalizedEmail, ipAddress, false);

	// Look up the user
	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
		select: { id: true, username: true, authProvider: true },
	});

	// If user doesn't exist or uses OAuth, pretend success to prevent enumeration
	if (!user || user.authProvider !== "LOCAL") {
		logSecurityEvent({
			event: "password_reset_requested_invalid_user",
			severity: "low",
			metadata: {
				email: normalizedEmail,
				ipAddress,
				userAgent: userAgent ?? null,
				reason: user ? "oauth_user" : "user_not_found",
			},
		});
		// Return success to prevent user enumeration
		return { data: null };
	}

	// Generate reset token and expiry
	const resetToken = generateResetToken();
	const resetExpires = new Date(
		Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
	);

	// Store the token
	await prisma.user.update({
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

	if ("error" in emailResult) {
		logSecurityEvent({
			event: "password_reset_email_failed",
			severity: "high",
			metadata: {
				userId: user.id,
				ipAddress,
				userAgent: userAgent ?? null,
				error: emailResult.error,
			},
		});
		// Still return success to prevent enumeration
		return { data: null };
	}

	logSecurityEvent({
		event: "password_reset_requested",
		severity: "low",
		metadata: {
			userId: user.id,
			ipAddress,
			userAgent: userAgent ?? null,
			emailSent: true,
		},
	});

	return { data: null };
}

/**
 * Validate a password reset token.
 */
export async function validateResetToken(
	token: string
): Promise<ValidateTokenResult> {
	if (!token || token.length !== 64) {
		return { error: "Invalid reset token" };
	}

	const user = await prisma.user.findFirst({
		where: {
			passwordResetToken: token,
			passwordResetExpires: { gt: new Date() },
		},
		select: { id: true, email: true },
	});

	if (!user) {
		return { error: "Invalid or expired reset token" };
	}

	return { data: { userId: user.id, email: user.email } };
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
	if ("error" in validation) {
		logSecurityEvent({
			event: "password_reset_invalid_token",
			severity: "medium",
			metadata: {
				ipAddress,
				userAgent: userAgent ?? null,
				tokenLength: token?.length,
			},
		});
		return { error: validation.error };
	}

	const { userId, email } = validation.data;

	// Validate password strength
	const passwordValidation = validatePassword(newPassword);
	if (!passwordValidation.valid) {
		return { error: passwordValidation.error };
	}

	// Hash the new password
	const passwordHash = await hashPassword(newPassword);

	// Update the user's password and clear the reset token
	await prisma.user.update({
		where: { id: userId },
		data: {
			passwordHash,
			passwordAlgorithm: "argon2id",
			passwordResetToken: null,
			passwordResetExpires: null,
		},
	});

	// Update the attempt record to mark as successful
	await prisma.passwordResetAttempt.updateMany({
		where: {
			email: email.toLowerCase(),
			successful: false,
		},
		data: {
			successful: true,
		},
	});

	logSecurityEvent({
		event: "password_reset_completed",
		severity: "low",
		metadata: { userId, ipAddress, userAgent: userAgent ?? null },
	});

	return { data: null };
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
	const tokenResult = await prisma.user.updateMany({
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
	const attemptResult = await prisma.passwordResetAttempt.deleteMany({
		where: {
			attemptedAt: { lt: oneDayAgo },
		},
	});

	return {
		clearedTokens: tokenResult.count,
		clearedAttempts: attemptResult.count,
	};
}
