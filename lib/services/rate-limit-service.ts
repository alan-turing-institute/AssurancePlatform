"use server";

import { prismaNew } from "@/lib/prisma";

// ============================================
// TYPES
// ============================================

export type RateLimitConfig = {
	readonly endpoint: string;
	readonly limits: ReadonlyArray<{
		readonly identifierType: "ip" | "email" | "user_id";
		readonly maxAttempts: number;
		readonly windowMs: number; // Time window in milliseconds
	}>;
};

export type RateLimitIdentifiers = {
	ipAddress?: string;
	email?: string;
	userId?: string;
};

export type RateLimitCheckResult = {
	allowed: boolean;
	reason?: string;
	retryAfterMs?: number;
};

type SecurityEventParams = {
	eventType: string;
	userId: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata?: Record<string, unknown>;
};

// ============================================
// PREDEFINED CONFIGURATIONS
// ============================================

const ONE_HOUR_MS = 60 * 60 * 1000;

export const RATE_LIMIT_CONFIGS = {
	register: {
		endpoint: "register",
		limits: [
			{
				identifierType: "ip" as const,
				maxAttempts: 5,
				windowMs: ONE_HOUR_MS,
			},
			{
				identifierType: "email" as const,
				maxAttempts: 3,
				windowMs: ONE_HOUR_MS,
			},
		],
	},
	inviteAccept: {
		endpoint: "invite_accept",
		limits: [
			{
				identifierType: "ip" as const,
				maxAttempts: 20,
				windowMs: ONE_HOUR_MS,
			},
			{
				identifierType: "user_id" as const,
				maxAttempts: 10,
				windowMs: ONE_HOUR_MS,
			},
		],
	},
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

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
 * Get the identifier value from the identifiers object based on type.
 */
function getIdentifierValue(
	identifierType: "ip" | "email" | "user_id",
	identifiers: RateLimitIdentifiers
): string | undefined {
	switch (identifierType) {
		case "ip":
			return identifiers.ipAddress;
		case "email":
			return identifiers.email?.toLowerCase();
		case "user_id":
			return identifiers.userId;
		default:
			return;
	}
}

/**
 * Get a human-readable label for the identifier type.
 */
function getIdentifierLabel(
	identifierType: "ip" | "email" | "user_id"
): string {
	switch (identifierType) {
		case "ip":
			return "your network";
		case "email":
			return "this email";
		case "user_id":
			return "your account";
		default:
			return "unknown";
	}
}

// ============================================
// CORE RATE LIMITING FUNCTIONS
// ============================================

/**
 * Check if a request is rate limited based on the configuration.
 */
export async function checkRateLimit(
	config: RateLimitConfig,
	identifiers: RateLimitIdentifiers
): Promise<RateLimitCheckResult> {
	for (const limit of config.limits) {
		const identifier = getIdentifierValue(limit.identifierType, identifiers);

		if (!identifier) {
			continue;
		}

		const windowStart = new Date(Date.now() - limit.windowMs);

		const attemptCount = await prismaNew.rateLimitAttempt.count({
			where: {
				endpoint: config.endpoint,
				identifier,
				identifierType: limit.identifierType,
				attemptedAt: { gte: windowStart },
			},
		});

		if (attemptCount >= limit.maxAttempts) {
			// Find oldest attempt to calculate retry time
			const oldestAttempt = await prismaNew.rateLimitAttempt.findFirst({
				where: {
					endpoint: config.endpoint,
					identifier,
					identifierType: limit.identifierType,
					attemptedAt: { gte: windowStart },
				},
				orderBy: { attemptedAt: "asc" },
			});

			const retryAfterMs = oldestAttempt
				? limit.windowMs - (Date.now() - oldestAttempt.attemptedAt.getTime())
				: limit.windowMs;

			return {
				allowed: false,
				reason: `Too many attempts from ${getIdentifierLabel(limit.identifierType)}. Please try again later.`,
				retryAfterMs: Math.max(0, retryAfterMs),
			};
		}
	}

	return { allowed: true };
}

/**
 * Record an attempt for rate limiting purposes.
 */
export async function recordAttempt(
	config: RateLimitConfig,
	identifiers: RateLimitIdentifiers,
	blocked = false,
	metadata?: Record<string, unknown>
): Promise<void> {
	const records: Array<{
		endpoint: string;
		identifier: string;
		identifierType: string;
		blocked: boolean;
		// biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
		metadata: any;
	}> = [];

	for (const limit of config.limits) {
		const identifier = getIdentifierValue(limit.identifierType, identifiers);

		if (!identifier) {
			continue;
		}

		records.push({
			endpoint: config.endpoint,
			identifier,
			identifierType: limit.identifierType,
			blocked,
			// biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
			metadata: (metadata ?? null) as any,
		});
	}

	if (records.length > 0) {
		await prismaNew.rateLimitAttempt.createMany({ data: records });
	}
}

/**
 * Check rate limit and record the attempt in one operation.
 * Returns the rate limit result and logs security events if blocked.
 */
export async function checkAndRecordRateLimit(
	config: RateLimitConfig,
	identifiers: RateLimitIdentifiers,
	securityContext?: {
		userId?: string;
		ipAddress?: string;
		userAgent?: string;
	}
): Promise<RateLimitCheckResult> {
	const result = await checkRateLimit(config, identifiers);

	if (!result.allowed) {
		// Record the blocked attempt
		await recordAttempt(config, identifiers, true);

		// Log security event
		await logSecurityEvent({
			eventType: `${config.endpoint}_rate_limited`,
			userId: securityContext?.userId ?? null,
			ipAddress: securityContext?.ipAddress ?? null,
			userAgent: securityContext?.userAgent ?? null,
			metadata: {
				reason: result.reason,
				identifiers: {
					ip: identifiers.ipAddress,
					email: identifiers.email,
					userId: identifiers.userId,
				},
			},
		});

		return result;
	}

	// Record the allowed attempt
	await recordAttempt(config, identifiers, false);

	return result;
}

/**
 * Clean up old rate limit attempt records.
 * Should be called periodically via a cron job.
 */
export async function cleanupRateLimitAttempts(
	olderThanHours = 24
): Promise<number> {
	const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

	const result = await prismaNew.rateLimitAttempt.deleteMany({
		where: {
			attemptedAt: { lt: cutoffDate },
		},
	});

	return result.count;
}
