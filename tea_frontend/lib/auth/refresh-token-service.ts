import { randomBytes } from "node:crypto";
import { prismaNew } from "@/lib/prisma-new";

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
 */
export async function validateRefreshToken(
	token: string
): Promise<{ valid: true; userId: string } | { valid: false; reason: string }> {
	const refreshToken = await prismaNew.refreshToken.findUnique({
		where: { token },
		select: {
			id: true,
			userId: true,
			expiresAt: true,
			revokedAt: true,
		},
	});

	if (!refreshToken) {
		return { valid: false, reason: "Token not found" };
	}

	if (refreshToken.revokedAt) {
		return { valid: false, reason: "Token has been revoked" };
	}

	if (refreshToken.expiresAt < new Date()) {
		return { valid: false, reason: "Token has expired" };
	}

	return { valid: true, userId: refreshToken.userId };
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
