import { randomBytes } from "node:crypto";
import { prismaNew } from "@/lib/prisma";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

type TokenMetadata = {
	userAgent?: string;
	ipAddress?: string;
};

type RefreshTokenResult = {
	token: string;
	expiresAt: Date;
};

/**
 * Generates a cryptographically secure refresh token.
 */
function generateToken(): string {
	return randomBytes(32).toString("hex");
}

/**
 * Creates a new refresh token for a user.
 */
export async function createRefreshToken(
	userId: string,
	metadata?: TokenMetadata
): Promise<RefreshTokenResult> {
	const token = generateToken();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

	await prismaNew.refreshToken.create({
		data: {
			token,
			userId,
			expiresAt,
			userAgent: metadata?.userAgent,
			ipAddress: metadata?.ipAddress,
		},
	});

	return { token, expiresAt };
}

/**
 * Validates a refresh token and returns the associated user ID if valid.
 * Uses constant-time operations to prevent timing attacks.
 */
export async function validateRefreshToken(
	token: string
): Promise<{ valid: true; userId: string } | { valid: false; reason: string }> {
	const { addTimingNoise, isTimestampValid } = await import(
		"@/lib/auth/timing-safe"
	);

	const refreshToken = await prismaNew.refreshToken.findUnique({
		where: { token },
		select: {
			id: true,
			userId: true,
			expiresAt: true,
			revokedAt: true,
		},
	});

	// Add timing noise to mask database lookup variance
	await addTimingNoise();

	// Evaluate all conditions without early returns to prevent timing leaks
	const tokenExists = refreshToken !== null;
	const notRevoked = tokenExists && refreshToken.revokedAt === null;
	const notExpired =
		tokenExists && isTimestampValid(refreshToken?.expiresAt?.getTime());

	const isValid = tokenExists && notRevoked && notExpired;

	// Determine reason using function to avoid nested ternary
	function getValidationReason(): string {
		if (!tokenExists) {
			return "Token not found";
		}
		if (!notRevoked) {
			return "Token has been revoked";
		}
		if (!notExpired) {
			return "Token has expired";
		}
		return "";
	}

	// Always compute reason regardless of validity (constant-time)
	const reason = getValidationReason();

	if (isValid && refreshToken) {
		return { valid: true, userId: refreshToken.userId };
	}

	return { valid: false, reason: reason || "Token validation failed" };
}

/**
 * Revokes a specific refresh token.
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
	const result = await prismaNew.refreshToken.updateMany({
		where: {
			token,
			revokedAt: null,
		},
		data: {
			revokedAt: new Date(),
		},
	});

	return result.count > 0;
}

/**
 * Revokes all refresh tokens for a user.
 * Useful for logout-all-devices or security incidents.
 */
export async function revokeAllUserTokens(userId: string): Promise<number> {
	const result = await prismaNew.refreshToken.updateMany({
		where: {
			userId,
			revokedAt: null,
		},
		data: {
			revokedAt: new Date(),
		},
	});

	return result.count;
}

/**
 * Rotates a refresh token: revokes the old one and creates a new one.
 * Returns null if the old token is invalid.
 */
export async function rotateRefreshToken(
	oldToken: string,
	metadata?: TokenMetadata
): Promise<RefreshTokenResult | null> {
	const validation = await validateRefreshToken(oldToken);

	if (!validation.valid) {
		return null;
	}

	// Revoke the old token
	await revokeRefreshToken(oldToken);

	// Create a new token
	return createRefreshToken(validation.userId, metadata);
}

/**
 * Cleans up expired and revoked tokens older than the specified days.
 * Should be run periodically via a cron job or similar.
 */
export async function cleanupExpiredTokens(
	olderThanDays = 30
): Promise<number> {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

	const result = await prismaNew.refreshToken.deleteMany({
		where: {
			OR: [
				{ expiresAt: { lt: cutoffDate } },
				{
					revokedAt: { lt: cutoffDate },
				},
			],
		},
	});

	return result.count;
}
