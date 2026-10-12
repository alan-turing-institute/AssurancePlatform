import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/services/security-audit-service";

// ============================================
// TYPES
// ============================================

export interface RateLimitConfig {
	readonly endpoint: string;
	readonly limits: ReadonlyArray<{
		readonly identifierType: "ip" | "email" | "user_id";
		readonly maxAttempts: number;
		readonly windowMs: number; // Time window in milliseconds
	}>;
}

export interface RateLimitIdentifiers {
	email?: string;
	ipAddress?: string;
	userId?: string;
}

export interface RateLimitCheckResult {
	allowed: boolean;
	reason?: string;
	retryAfterMs?: number;
}

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
	/**
	 * Failed `/api/machine/*` bearer-token auth attempts (ADR 0002 v2 §2.4).
	 * `identifierType: "ip"` only — the identifier union has no token variant,
	 * and a garbage/unknown token resolves to no user to key on. Only failed
	 * attempts consume this budget (see integration-registry-service.ts); a
	 * validly authenticated integration polling frequently never touches it.
	 */
	machineAuth: {
		endpoint: "machine_auth",
		limits: [
			{
				identifierType: "ip" as const,
				maxAttempts: 20,
				windowMs: 15 * 60 * 1000,
			},
		],
	},
	/**
	 * Calls the server makes to a model provider on a user's behalf: a
	 * connection test, a search check and quick setup share one budget per user.
	 */
	modelCalls: {
		endpoint: "model_calls",
		limits: [
			{
				identifierType: "user_id" as const,
				maxAttempts: 20,
				windowMs: 10 * 60 * 1000,
			},
		],
	},
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

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

		const attemptCount = await prisma.rateLimitAttempt.count({
			where: {
				endpoint: config.endpoint,
				identifier,
				identifierType: limit.identifierType,
				attemptedAt: { gte: windowStart },
			},
		});

		if (attemptCount >= limit.maxAttempts) {
			// Find oldest attempt to calculate retry time
			const oldestAttempt = await prisma.rateLimitAttempt.findFirst({
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
		await prisma.rateLimitAttempt.createMany({ data: records });
	}
}

/**
 * Spends one attempt of the budget if there is one left. Unlike `checkRateLimit`
 * followed by `recordAttempt`, the count and the record happen together under a
 * lock held for each identifier, so requests that arrive at the same moment
 * cannot all see room and all go ahead. An attempt that is refused is not
 * recorded.
 */
export async function takeRateLimitSlot(
	config: RateLimitConfig,
	identifiers: RateLimitIdentifiers
): Promise<RateLimitCheckResult> {
	const applicable = config.limits.flatMap((limit) => {
		const identifier = getIdentifierValue(limit.identifierType, identifiers);
		return identifier ? [{ limit, identifier }] : [];
	});
	if (applicable.length === 0) {
		return { allowed: true };
	}
	// Locks are taken in one order, so two requests that share identifiers
	// cannot wait on each other.
	const lockKeys = applicable
		.map(
			({ limit, identifier }) =>
				`${config.endpoint}:${limit.identifierType}:${identifier}`
		)
		.sort();

	return await prisma.$transaction(async (tx) => {
		for (const key of lockKeys) {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
		}
		for (const { limit, identifier } of applicable) {
			const windowStart = new Date(Date.now() - limit.windowMs);
			const within = {
				endpoint: config.endpoint,
				identifier,
				identifierType: limit.identifierType,
				attemptedAt: { gte: windowStart },
			};
			const attemptCount = await tx.rateLimitAttempt.count({ where: within });
			if (attemptCount >= limit.maxAttempts) {
				const oldestAttempt = await tx.rateLimitAttempt.findFirst({
					where: within,
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
		await tx.rateLimitAttempt.createMany({
			data: applicable.map(({ limit, identifier }) => ({
				endpoint: config.endpoint,
				identifier,
				identifierType: limit.identifierType,
				blocked: false,
			})),
		});
		return { allowed: true };
	});
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

		// Record the security event (logs + persists)
		await recordSecurityEvent({
			event: `${config.endpoint}_rate_limited`,
			severity: "medium",
			userId: securityContext?.userId,
			ipAddress: securityContext?.ipAddress ?? identifiers.ipAddress,
			userAgent: securityContext?.userAgent,
			metadata: {
				reason: result.reason,
				identifiers: {
					ip: identifiers.ipAddress,
					email: identifiers.email,
					userId: identifiers.userId,
				},
				securityContext,
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

	const result = await prisma.rateLimitAttempt.deleteMany({
		where: {
			attemptedAt: { lt: cutoffDate },
		},
	});

	return result.count;
}
