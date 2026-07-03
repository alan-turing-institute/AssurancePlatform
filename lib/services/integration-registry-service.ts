import { logSecurityEvent } from "@/lib/audit/security-log";
import {
	generateApiTokenSecret,
	hashApiTokenSecret,
	looksLikeApiToken,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import { findUnknownScopes, type Scope } from "@/lib/auth/scopes";
import { addTimingNoise, isTimestampValid } from "@/lib/auth/timing-safe";
import { prisma } from "@/lib/prisma";
import {
	checkRateLimit,
	RATE_LIMIT_CONFIGS,
	recordAttempt,
} from "@/lib/services/rate-limit-service";
import {
	type ApiToken,
	type Integration,
	Prisma,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * Owns the machine-access layer's data: registering/suspending/revoking
 * `Integration`s, issuing/rotating/revoking their `ApiToken`s, and
 * validating a presented bearer token on every `/api/machine/*` request
 * (ADR 0002 v2 §2.4). All Prisma access for this domain lives here — routes
 * and `lib/auth/require-api-token.ts` never import Prisma directly.
 *
 * Authorisation note: this service does not itself enforce WHO may call
 * register/suspend/revoke/issue/rotate — that authority model belongs to
 * the management API + settings UI (issue 7, not yet built). `actorUserId`
 * parameters here are for audit attribution only.
 */

// ============================================
// Types
// ============================================

export interface RegisterIntegrationInput {
	description?: string;
	name: string;
	ownerId: string;
	scopes: string[];
}

export interface RegisteredIntegration {
	integration: Integration;
	systemUserId: string;
}

export interface IssuedToken {
	apiToken: ApiToken;
	/** Plaintext secret — present ONLY on this return value, never persisted or shown again. */
	secret: string;
}

export interface RotatedToken {
	newToken: IssuedToken;
	oldTokenId: string;
	/** When the rotated-out token's brought-forward expiry takes effect. */
	overlapUntil: Date;
}

/**
 * Rotation grace window: the old token keeps authenticating for this long
 * after `rotateToken()` (its expiry is brought forward to `now + this`,
 * unless it already expired sooner). Long enough for a batch/cron-driven
 * integration such as DARTER to pick up the new secret on its own schedule
 * without a hard-cutover outage; short enough that a token being rotated
 * away from doesn't linger for days. Chosen: 24 hours — one deploy cycle.
 */
export const TOKEN_ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000;

// ============================================
// Helpers
// ============================================

function isUniqueConstraintError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	);
}

function slugifyIntegrationName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-+|-+$)/g, "");
}

interface AuditLogInput {
	eventType: string;
	ipAddress?: string | null;
	metadata?: Record<string, unknown>;
	userAgent?: string | null;
	userId?: string | null;
}

/**
 * Records a security-relevant machine-auth event: `logSecurityEvent` for
 * dev-console visibility (existing pattern) plus a persisted
 * `SecurityAuditLog` row (the pattern's call shape has no DB write yet —
 * this service adds one, scoped to its own events, all Prisma access
 * staying inside this service per house rule).
 */
async function writeAuditLog(input: AuditLogInput): Promise<void> {
	logSecurityEvent({
		event: input.eventType,
		severity: "medium",
		metadata: {
			...input.metadata,
			userId: input.userId,
			ipAddress: input.ipAddress,
		},
	});
	await prisma.securityAuditLog.create({
		data: {
			userId: input.userId ?? null,
			eventType: input.eventType,
			ipAddress: input.ipAddress ?? null,
			userAgent: input.userAgent ?? null,
			// biome-ignore lint/suspicious/noExplicitAny: Prisma JSON type requires any
			metadata: (input.metadata ?? null) as any,
		},
	});
}

/**
 * Loads an `Integration` by id with the given `select`, or the shared
 * not-found error. Dedupes the "load integration, fail if absent"
 * boilerplate repeated across the register/suspend/revoke/reassign/
 * delete/issue call sites below (fallow clone finding, fix round).
 */
async function getIntegrationOrError<S extends Prisma.IntegrationSelect>(
	integrationId: string,
	select: S
): ServiceResult<Prisma.IntegrationGetPayload<{ select: S }>> {
	const integration = await prisma.integration.findUnique({
		where: { id: integrationId },
		select,
	});
	if (!integration) {
		return { error: "Integration not found" };
	}
	// `lib/prisma.ts` wraps the client in `$extends()`, which rebinds its
	// InternalArgs — the client-bound result of `findUnique({ select })` and
	// the standalone `Prisma.IntegrationGetPayload<{ select: S }>` type (which
	// defaults to `DefaultArgs`) are two structurally-identical but nominally
	// distinct instantiations of the same generated type. Runtime shape is
	// identical; this cast just reconciles the two static instantiations.
	return { data: integration as Prisma.IntegrationGetPayload<{ select: S }> };
}

function issueTokenRecord(integrationId: string, expiresAt?: Date) {
	const secret = generateApiTokenSecret();
	return {
		secret,
		data: {
			integrationId,
			tokenHash: hashApiTokenSecret(secret),
			tokenPrefix: tokenDisplayPrefix(secret),
			expiresAt,
		},
	};
}

// ============================================
// Registration / lifecycle
// ============================================

/**
 * Registers a new integration: creates its dedicated system `User`
 * (`isSystemUser: true`) and the `Integration` row transactionally.
 * Rejects any scope not in the current registry (`lib/auth/scopes.ts`) —
 * loud failure, never a silent partial save.
 */
export async function registerIntegration(
	input: RegisterIntegrationInput,
	actorUserId: string
): ServiceResult<RegisteredIntegration> {
	try {
		const unknownScopes = findUnknownScopes(input.scopes);
		if (unknownScopes.length > 0) {
			return { error: `Unknown scope(s): ${unknownScopes.join(", ")}` };
		}

		const owner = await prisma.user.findUnique({
			where: { id: input.ownerId },
			select: { id: true },
		});
		if (!owner) {
			return { error: "Owner not found" };
		}

		const slug = slugifyIntegrationName(input.name);
		const result = await prisma.$transaction(async (tx) => {
			const systemUser = await tx.user.create({
				data: {
					email: `integration+${slug}@tea-platform.internal`,
					username: `integration-${slug}`,
					isSystemUser: true,
					authProvider: "SYSTEM",
					emailVerified: true,
				},
				select: { id: true },
			});

			const integration = await tx.integration.create({
				data: {
					name: input.name,
					description: input.description,
					ownerId: input.ownerId,
					systemUserId: systemUser.id,
					scopes: input.scopes,
				},
			});

			return { integration, systemUserId: systemUser.id };
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_registered",
			metadata: {
				integrationId: result.integration.id,
				name: input.name,
				scopes: input.scopes,
			},
		});

		return { data: result };
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return { error: "An integration with this name already exists" };
		}
		return { error: "Failed to register integration" };
	}
}

/** Validates and replaces an integration's scope set. Same registry check as registration. */
export async function updateIntegrationScopes(
	integrationId: string,
	scopes: string[],
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const unknownScopes = findUnknownScopes(scopes);
		if (unknownScopes.length > 0) {
			return { error: `Unknown scope(s): ${unknownScopes.join(", ")}` };
		}

		const existing = await getIntegrationOrError(integrationId, { id: true });
		if ("error" in existing) {
			return existing;
		}

		const integration = await prisma.integration.update({
			where: { id: integrationId },
			data: { scopes },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_scopes_updated",
			metadata: { integrationId, scopes },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to update integration scopes" };
	}
}

export async function suspendIntegration(
	integrationId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const existing = await getIntegrationOrError(integrationId, { id: true });
		if ("error" in existing) {
			return existing;
		}

		const integration = await prisma.integration.update({
			where: { id: integrationId },
			data: { status: "SUSPENDED" },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_suspended",
			metadata: { integrationId },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to suspend integration" };
	}
}

/**
 * Revokes an integration permanently and, in the same transaction, revokes
 * every one of its currently-unrevoked tokens — a revoked integration
 * should not keep authenticating on a token issued before the revocation.
 */
export async function revokeIntegration(
	integrationId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const existing = await getIntegrationOrError(integrationId, { id: true });
		if ("error" in existing) {
			return existing;
		}

		const now = new Date();
		const [integration] = await prisma.$transaction([
			prisma.integration.update({
				where: { id: integrationId },
				data: { status: "REVOKED" },
			}),
			prisma.apiToken.updateMany({
				where: { integrationId, revokedAt: null },
				data: { revokedAt: now },
			}),
		]);

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_revoked",
			metadata: { integrationId },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to revoke integration" };
	}
}

// ============================================
// Owner-deletion flow (ADR 0002 v2 §2.4 — DB RESTRICTs unconditionally;
// this is the humane path layered on top)
// ============================================

/** Lists integrations owned by a user — the set that would block their account deletion. */
export async function getIntegrationsOwnedBy(
	ownerId: string
): ServiceResult<Integration[]> {
	try {
		const integrations = await prisma.integration.findMany({
			where: { ownerId },
			orderBy: { createdAt: "asc" },
		});
		return { data: integrations };
	} catch {
		return { error: "Failed to list owned integrations" };
	}
}

export async function reassignIntegrationOwner(
	integrationId: string,
	newOwnerId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const [existing, newOwner] = await Promise.all([
			getIntegrationOrError(integrationId, { id: true }),
			prisma.user.findUnique({
				where: { id: newOwnerId },
				select: { id: true },
			}),
		]);
		if ("error" in existing || !newOwner) {
			return { error: "Integration not found" };
		}

		const integration = await prisma.integration.update({
			where: { id: integrationId },
			data: { ownerId: newOwnerId },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_owner_reassigned",
			metadata: { integrationId, newOwnerId },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to reassign integration owner" };
	}
}

/**
 * Hard-deletes an integration's registration (cascades its tokens). Use
 * when reassignment isn't wanted — deleting the row, not just revoking,
 * gives up the integration's own accountability trail, so prefer
 * `revokeIntegration` when that trail matters and this only when a human
 * owner needs the RESTRICT cleared without a new owner to hand off to.
 */
export async function deleteIntegrationRegistration(
	integrationId: string,
	actorUserId: string
): ServiceResult<true> {
	try {
		const existing = await getIntegrationOrError(integrationId, {
			id: true,
			name: true,
		});
		if ("error" in existing) {
			return existing;
		}

		await prisma.integration.delete({ where: { id: integrationId } });

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_deleted",
			metadata: { integrationId, name: existing.data.name },
		});

		return { data: true };
	} catch {
		return { error: "Failed to delete integration" };
	}
}

// ============================================
// Token issuance / rotation / revocation
// ============================================

/**
 * Issues a new token for an ACTIVE integration.
 *
 * Deliberately no default lifetime: `options.expiresAt` is optional, and an
 * omitted value means the token never expires on its own
 * (`isTimestampValid` treats an absent expiry as always-valid — see
 * `lib/auth/timing-safe.ts`). This is a considered posture, not an
 * oversight — revocation (`revokeToken` / `revokeIntegration`), not
 * expiry, is the primary kill switch for this system: integrations like
 * DARTER are long-lived batch/cron clients with no natural
 * re-authentication moment, so forcing an expiry would just mean building
 * a renewal flow nothing here yet has, whereas revocation is immediate,
 * always available, and already the mechanism suspension/deletion rely on.
 * Callers that DO want a bounded-lifetime token (e.g. a short-lived
 * delegated credential) can still pass `expiresAt` explicitly — nothing
 * about this default forecloses that.
 */
export async function issueToken(
	integrationId: string,
	actorUserId: string,
	options: { expiresAt?: Date } = {}
): ServiceResult<IssuedToken> {
	try {
		const integration = await getIntegrationOrError(integrationId, {
			id: true,
			status: true,
		});
		if ("error" in integration) {
			return integration;
		}
		if (integration.data.status !== "ACTIVE") {
			return { error: "Cannot issue a token for a non-active integration" };
		}

		const { secret, data } = issueTokenRecord(integrationId, options.expiresAt);
		const apiToken = await prisma.apiToken.create({ data });

		await writeAuditLog({
			userId: actorUserId,
			eventType: "token_issued",
			metadata: {
				integrationId,
				tokenId: apiToken.id,
				tokenPrefix: apiToken.tokenPrefix,
			},
		});

		return { data: { apiToken, secret } };
	} catch {
		return { error: "Failed to issue token" };
	}
}

/**
 * Issues a replacement token and brings the old token's expiry forward to
 * `now + TOKEN_ROTATION_OVERLAP_MS` (unless it already expires sooner) —
 * both tokens authenticate during the overlap. Does NOT set `revokedAt` on
 * the old token: that field means "dead immediately" and is reserved for
 * `revokeToken`/`revokeIntegration`; rotation reuses the existing expiry
 * check instead of inventing grace-period semantics on top of `revokedAt`.
 */
export async function rotateToken(
	tokenId: string,
	actorUserId: string
): ServiceResult<RotatedToken> {
	try {
		const oldToken = await prisma.apiToken.findUnique({
			where: { id: tokenId },
			include: { integration: { select: { id: true, status: true } } },
		});
		if (!oldToken) {
			return { error: "Token not found" };
		}
		if (oldToken.revokedAt) {
			return { error: "Cannot rotate a revoked token" };
		}
		if (oldToken.integration.status !== "ACTIVE") {
			return { error: "Cannot rotate a token for a non-active integration" };
		}

		const overlapUntil = new Date(Date.now() + TOKEN_ROTATION_OVERLAP_MS);
		const newExpiresAt =
			oldToken.expiresAt && oldToken.expiresAt < overlapUntil
				? oldToken.expiresAt
				: overlapUntil;

		const { secret, data } = issueTokenRecord(oldToken.integrationId);

		const [, apiToken] = await prisma.$transaction([
			prisma.apiToken.update({
				where: { id: tokenId },
				data: { expiresAt: newExpiresAt },
			}),
			prisma.apiToken.create({ data }),
		]);

		await writeAuditLog({
			userId: actorUserId,
			eventType: "token_rotated",
			metadata: {
				integrationId: oldToken.integrationId,
				oldTokenId: tokenId,
				newTokenId: apiToken.id,
				overlapUntil: overlapUntil.toISOString(),
			},
		});

		return {
			data: {
				newToken: { apiToken, secret },
				oldTokenId: tokenId,
				overlapUntil: newExpiresAt,
			},
		};
	} catch {
		return { error: "Failed to rotate token" };
	}
}

export async function revokeToken(
	tokenId: string,
	actorUserId: string
): ServiceResult<ApiToken> {
	try {
		const existing = await prisma.apiToken.findUnique({
			where: { id: tokenId },
			select: { id: true, revokedAt: true, integrationId: true },
		});
		if (!existing) {
			return { error: "Token not found" };
		}
		if (existing.revokedAt) {
			return { error: "Token already revoked" };
		}

		const apiToken = await prisma.apiToken.update({
			where: { id: tokenId },
			data: { revokedAt: new Date() },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "token_revoked",
			metadata: { integrationId: existing.integrationId, tokenId },
		});

		return { data: apiToken };
	} catch {
		return { error: "Failed to revoke token" };
	}
}

// ============================================
// Auth path — validates a presented bearer token
// ============================================

export interface ValidateApiTokenParams {
	ipAddress: string;
	scope?: Scope;
	token: string | null;
}

export interface ValidatedApiTokenPrincipal {
	integrationId: string;
	integrationName: string;
	scopes: string[];
	systemUserId: string;
	tokenPrefix: string;
}

export type ValidateApiTokenResult =
	| { data: ValidatedApiTokenPrincipal }
	| { error: string; rateLimited?: true };

/** Single generic message for every auth failure — see module doc: no oracle. */
const AUTH_FAILURE_MESSAGE = "Invalid or expired token";

/**
 * Validates a presented bearer token against an optional required scope.
 * Used by `lib/auth/require-api-token.ts` — all Prisma access for the
 * machine-auth request path lives here, not in `lib/auth/`.
 *
 * Every failure mode (missing header, malformed token, unknown hash,
 * revoked, expired, non-ACTIVE integration, missing scope) returns the
 * SAME error message, so a caller cannot use the response to distinguish
 * "no such token" from "revoked" from "wrong scope" (deliberate — ADR 0002
 * v2 §2.4 / feasibility review). Failed attempts are throttled by IP
 * (`RATE_LIMIT_CONFIGS.machineAuth`) and written to `SecurityAuditLog`;
 * successful requests are not — polling with a valid token never spends
 * the throttle budget. `addTimingNoise` masks residual latency
 * differences between the failure branches.
 */
export async function validateApiToken(
	params: ValidateApiTokenParams
): Promise<ValidateApiTokenResult> {
	const { token, scope, ipAddress } = params;

	const throttle = await checkRateLimit(RATE_LIMIT_CONFIGS.machineAuth, {
		ipAddress,
	});
	if (!throttle.allowed) {
		await recordAttempt(RATE_LIMIT_CONFIGS.machineAuth, { ipAddress }, true);
		await writeAuditLog({
			eventType: "machine_auth_rate_limited",
			ipAddress,
			metadata: { reason: throttle.reason },
		});
		return {
			error: throttle.reason ?? "Too many failed attempts",
			rateLimited: true,
		};
	}

	const fail = async (
		reason: string,
		metadata: Record<string, unknown> = {}
	): Promise<ValidateApiTokenResult> => {
		await recordAttempt(RATE_LIMIT_CONFIGS.machineAuth, { ipAddress }, false);
		await writeAuditLog({
			eventType: "machine_auth_failed",
			ipAddress,
			metadata: { reason, ...metadata },
		});
		await addTimingNoise();
		return { error: AUTH_FAILURE_MESSAGE };
	};

	if (!(token && looksLikeApiToken(token))) {
		return fail("malformed_or_missing");
	}

	const tokenHash = hashApiTokenSecret(token);
	const record = await prisma.apiToken.findUnique({
		where: { tokenHash },
		include: {
			integration: {
				select: {
					id: true,
					name: true,
					status: true,
					scopes: true,
					systemUserId: true,
				},
			},
		},
	});

	if (!record) {
		return fail("not_found");
	}
	if (record.revokedAt) {
		return fail("revoked", { tokenId: record.id });
	}
	if (!isTimestampValid(record.expiresAt?.getTime())) {
		return fail("expired", { tokenId: record.id });
	}
	if (record.integration.status !== "ACTIVE") {
		return fail("integration_not_active", {
			integrationId: record.integrationId,
		});
	}
	if (scope && !record.integration.scopes.includes(scope)) {
		return fail("scope_missing", {
			integrationId: record.integrationId,
			scope,
		});
	}

	const now = new Date();
	await prisma.$transaction([
		prisma.apiToken.update({
			where: { id: record.id },
			data: { lastUsedAt: now },
		}),
		prisma.integration.update({
			where: { id: record.integrationId },
			data: { lastSeenAt: now },
		}),
	]);

	await addTimingNoise();

	return {
		data: {
			integrationId: record.integrationId,
			systemUserId: record.integration.systemUserId,
			integrationName: record.integration.name,
			scopes: record.integration.scopes,
			tokenPrefix: record.tokenPrefix,
		},
	};
}
