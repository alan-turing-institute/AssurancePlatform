import { logSecurityEvent } from "@/lib/audit/security-log";
import {
	generateApiTokenSecret,
	hashApiTokenSecret,
	looksLikeApiToken,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import { findUnknownScopes, type Scope } from "@/lib/auth/scopes";
import { addTimingNoise, isTimestampValid } from "@/lib/auth/timing-safe";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
	checkRateLimit,
	RATE_LIMIT_CONFIGS,
	recordAttempt,
} from "@/lib/services/rate-limit-service";
import {
	type ApiToken,
	type Integration,
	type PermissionLevel,
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
 * Authorisation (management API precondition — vincent security review
 * 2026-07-03, finding 3): OWNER-ONLY in 1.0, no admin override — no
 * platform-admin concept exists anywhere in this codebase, and none is
 * invented here. Every mutating operation below verifies, at THIS service
 * boundary (not just in a calling route), that `actorUserId` owns the
 * integration before acting — through exactly ONE of two choke points,
 * chosen by which id the operation is keyed on (vincent MAJOR, review
 * round 2: the single-choke-point claim used to be false — `rotateToken`/
 * `revokeToken` had their own duplicated inline checks — this is now
 * literally true for both families):
 *   - INTEGRATION-keyed ops — `suspendIntegration`, `reactivateIntegration`,
 *     `revokeIntegration`, `issueToken`, `updateIntegration`/
 *     `updateIntegrationScopes`, `reassignIntegrationOwner`,
 *     `deleteIntegrationRegistration`, `listIntegrationCaseGrants`,
 *     `grantIntegrationCaseAccess`, `revokeIntegrationCaseAccess` — go
 *     through `getOwnedIntegrationOrError`.
 *   - TOKEN-keyed ops — `rotateToken`, `revokeToken` — go through
 *     `getOwnedApiTokenOrError`, its symmetrical twin. Ownership rides the
 *     token's OWN integration, not a path-supplied integration id; a caller
 *     may additionally pass `options.integrationId` to also require the
 *     token belong to THAT specific integration (a tokenId that exists,
 *     is owned by the actor, but hangs off a DIFFERENT integration the
 *     actor also owns is rejected identically to a nonexistent tokenId —
 *     deviation-5 fix, work item 2).
 * `registerIntegration` binds the new integration's `ownerId` to
 * `actorUserId` directly (any authenticated user may register; the
 * registrant becomes owner — policy settled by cid, 2026-07-05) — there is
 * no `ownerId` input a caller could use to name a different owner. A
 * non-owner acting on someone else's integration (or token) gets the EXACT
 * SAME error as acting on a nonexistent id — the repo's
 * enumeration-prevention convention (`element-service.ts`'s `getElement`
 * precedent) — never a distinct "Permission denied". `validateApiToken` is
 * the one exception: it has no human actor at all (it authenticates a
 * bearer token), and its semantics are unchanged.
 */

// ============================================
// Types
// ============================================

export interface RegisterIntegrationInput {
	description?: string;
	name: string;
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
 * Loads an `Integration` by id with the given `select`, verifying it both
 * EXISTS and is owned by `actorUserId` — the service-boundary authorisation
 * check every mutating operation below relies on (module doc comment
 * above; vincent security review 2026-07-03, finding 3). Dedupes the "load
 * integration, fail if absent-or-not-mine" boilerplate repeated across the
 * update/suspend/reactivate/revoke/reassign/delete/issue call sites below
 * (fallow clone finding, fix round) — and, just as importantly, makes it
 * structurally impossible for a call site to check existence and ownership
 * as two separate steps with two different error messages, which is
 * exactly how an enumeration oracle gets reintroduced by accident.
 *
 * Returns the SAME "Integration not found" error whether the id doesn't
 * exist at all or exists but belongs to someone else — a caller cannot
 * distinguish "no such integration" from "not yours".
 */
async function getOwnedIntegrationOrError<S extends Prisma.IntegrationSelect>(
	integrationId: string,
	actorUserId: string,
	select: S
): ServiceResult<Prisma.IntegrationGetPayload<{ select: S }>> {
	// Two queries rather than merging `ownerId: true` into the generic `S` at
	// the type level: spreading a generic `Prisma.IntegrationSelect` produces
	// a mapped type Prisma's own conditional types can't statically resolve
	// (tried, `tsc` rejected both the property access and the payload cast
	// below it as "insufficient overlap"). A cheap extra `findUnique` on the
	// non-hot-path owner-only management routes is a better trade than
	// fighting the generated client's types. The two reads are int-generated
	// UUID lookups milliseconds apart, not a meaningful race window, and a
	// row deleted in between resolves to the same generic not-found error.
	const ownerRow = await prisma.integration.findUnique({
		where: { id: integrationId },
		select: { ownerId: true },
	});
	if (!ownerRow || ownerRow.ownerId !== actorUserId) {
		return { error: "Integration not found" };
	}

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

/**
 * Loads an `ApiToken` by id with the given `select`, verifying it both
 * EXISTS and its OWNING INTEGRATION is owned by `actorUserId` — the
 * token-keyed twin of `getOwnedIntegrationOrError` above (vincent MAJOR,
 * review round 2: `rotateToken`/`revokeToken` used to each run their own
 * duplicated inline version of this check; this is now the single choke
 * point for both, matching the module doc comment). A token has no
 * `ownerId` of its own — ownership rides its `integration.ownerId` — so
 * this is a distinct helper, not a generic rename of the integration one.
 *
 * Returns the SAME "Token not found" error whether the id doesn't exist at
 * all or exists but its integration belongs to someone else — a caller
 * cannot distinguish "no such token" from "not yours".
 */
async function getOwnedApiTokenOrError<S extends Prisma.ApiTokenSelect>(
	tokenId: string,
	actorUserId: string,
	select: S
): ServiceResult<Prisma.ApiTokenGetPayload<{ select: S }>> {
	// Same two-query shape as `getOwnedIntegrationOrError`, for the same
	// reason (see its comment): a generic `S` can't be safely merged with
	// the nested `integration.ownerId` select at the type level.
	const ownerRow = await prisma.apiToken.findUnique({
		where: { id: tokenId },
		select: { integration: { select: { ownerId: true } } },
	});
	if (!ownerRow || ownerRow.integration.ownerId !== actorUserId) {
		return { error: "Token not found" };
	}

	const apiToken = await prisma.apiToken.findUnique({
		where: { id: tokenId },
		select,
	});
	if (!apiToken) {
		return { error: "Token not found" };
	}
	// Same `$extends()` static/runtime reconciliation cast as
	// `getOwnedIntegrationOrError` — see its comment for why this is safe.
	return { data: apiToken as Prisma.ApiTokenGetPayload<{ select: S }> };
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
 *
 * `ownerId` is NOT part of `input` — it is `actorUserId`, always. Any
 * authenticated user may register an integration; the registrant becomes
 * its owner, with no way to name a different one (policy settled by cid,
 * 2026-07-05, recorded on the issue). Management is owner-only in 1.0.
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
			where: { id: actorUserId },
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
					ownerId: actorUserId,
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

export interface UpdateIntegrationInput {
	description?: string;
	scopes?: string[];
}

/**
 * Partial update of an integration's description and/or scopes — the
 * general-purpose updater behind `PATCH /api/integrations/[id]`. Same
 * unknown-scope check as registration when `updates.scopes` is provided.
 * Owner-only (`getOwnedIntegrationOrError`).
 */
export async function updateIntegration(
	integrationId: string,
	updates: UpdateIntegrationInput,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		if (updates.scopes) {
			const unknownScopes = findUnknownScopes(updates.scopes);
			if (unknownScopes.length > 0) {
				return { error: `Unknown scope(s): ${unknownScopes.join(", ")}` };
			}
		}

		const existing = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true }
		);
		if ("error" in existing) {
			return existing;
		}

		const integration = await prisma.integration.update({
			where: { id: integrationId },
			data: {
				...(updates.description !== undefined && {
					description: updates.description,
				}),
				...(updates.scopes !== undefined && { scopes: updates.scopes }),
			},
		});

		// `Object.keys(updates)` would report a field as "updated" merely
		// because the route passed the key through with an `undefined` value —
		// filter to fields actually present so the audit trail reflects what
		// changed, not what the caller's object literal happened to mention.
		const updatedFields = (
			Object.keys(updates) as (keyof UpdateIntegrationInput)[]
		).filter((field) => updates[field] !== undefined);

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_updated",
			metadata: { integrationId, updatedFields },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to update integration" };
	}
}

/**
 * Scopes-only convenience wrapper over `updateIntegration` — kept as its
 * own export because `scripts/seed-darter-integration.ts` reconciles ONLY
 * scopes on every re-run.
 */
export function updateIntegrationScopes(
	integrationId: string,
	scopes: string[],
	actorUserId: string
): ServiceResult<Integration> {
	return updateIntegration(integrationId, { scopes }, actorUserId);
}

export async function suspendIntegration(
	integrationId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const existing = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true, status: true }
		);
		if ("error" in existing) {
			return existing;
		}
		// REVOKED is terminal (ADR 0002 v2 §2.4) — without this guard,
		// suspending a revoked integration would silently flip its status back
		// to SUSPENDED, i.e. un-revoke it. `reactivateIntegration` enforces the
		// same rule for the same reason.
		if (existing.data.status === "REVOKED") {
			return { error: "Cannot suspend a revoked integration" };
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
 * Reverses `suspendIntegration` — SUSPENDED → ACTIVE (barret deviation 6,
 * 2026-07-03: suspend was a one-way door until this method existed).
 * REVOKED stays terminal: reactivating a revoked integration is an error,
 * never a resurrection. Owner-only, audited.
 */
export async function reactivateIntegration(
	integrationId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const existing = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true, status: true }
		);
		if ("error" in existing) {
			return existing;
		}
		if (existing.data.status === "REVOKED") {
			return { error: "Cannot reactivate a revoked integration" };
		}
		if (existing.data.status === "ACTIVE") {
			return { error: "Integration is already active" };
		}

		const integration = await prisma.integration.update({
			where: { id: integrationId },
			data: { status: "ACTIVE" },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_reactivated",
			metadata: { integrationId },
		});

		return { data: integration };
	} catch {
		return { error: "Failed to reactivate integration" };
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
		const existing = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true }
		);
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

/**
 * Lists integrations owned by a user — the set that would block their
 * account deletion (`user-management-service.ts`'s `deleteAccount`). NOT
 * itself an authorisation boundary: `ownerId` is trusted as-is, so every
 * caller MUST pass the acting user's own id (never a client-supplied one) —
 * the same discipline `requireAuth()` already enforces at the route layer.
 */
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

/**
 * Counts integrations owned by a user — the cheap existence-and-magnitude
 * check `deleteAccount`'s pre-flight actually needs (vincent minor, work
 * item 7). `deleteAccount` used to call `getIntegrationsOwnedBy` and
 * discard every row but the length, forcing a full `Integration[]` fetch
 * (columns, ORDER BY) to answer a question `COUNT(*)` answers directly.
 * `getIntegrationsOwnedBy` itself is UNCHANGED and kept — other flows still
 * need the actual rows. Same trust contract: `ownerId` must be the
 * caller's own id.
 */
export async function countIntegrationsOwnedBy(
	ownerId: string
): ServiceResult<number> {
	try {
		const count = await prisma.integration.count({ where: { ownerId } });
		return { data: count };
	} catch {
		return { error: "Failed to count owned integrations" };
	}
}

export interface IntegrationTokenSummary {
	createdAt: Date;
	expiresAt: Date | null;
	id: string;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
	tokenPrefix: string;
}

export interface IntegrationListItem {
	createdAt: Date;
	description: string | null;
	id: string;
	lastSeenAt: Date | null;
	name: string;
	scopes: string[];
	status: Integration["status"];
	tokens: IntegrationTokenSummary[];
	updatedAt: Date;
}

/**
 * The `GET /api/integrations` data source: every integration `ownerId`
 * owns, each with a token SUMMARY per issued token — prefix, timestamps,
 * expiry/revocation state — never `tokenHash` or a plaintext secret. This
 * is a `select`, not a post-hoc field strip, so leaking a hash here isn't a
 * "remember to redact" discipline problem, it's structurally impossible:
 * the query never reads the column. Same trust contract as
 * `getIntegrationsOwnedBy` — `ownerId` must be the caller's own id.
 */
export async function listIntegrationsForOwner(
	ownerId: string
): ServiceResult<IntegrationListItem[]> {
	try {
		const integrations = await prisma.integration.findMany({
			where: { ownerId },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				name: true,
				description: true,
				scopes: true,
				status: true,
				createdAt: true,
				updatedAt: true,
				lastSeenAt: true,
				tokens: {
					orderBy: { createdAt: "asc" },
					select: {
						id: true,
						tokenPrefix: true,
						createdAt: true,
						lastUsedAt: true,
						expiresAt: true,
						revokedAt: true,
					},
				},
			},
		});
		return { data: integrations };
	} catch {
		return { error: "Failed to list integrations" };
	}
}

export async function reassignIntegrationOwner(
	integrationId: string,
	newOwnerId: string,
	actorUserId: string
): ServiceResult<Integration> {
	try {
		const [existing, newOwner] = await Promise.all([
			getOwnedIntegrationOrError(integrationId, actorUserId, { id: true }),
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
 * Hard-deletes an integration's registration AND its dedicated system user
 * (cascades the integration's tokens via `ApiToken`'s `onDelete: Cascade`,
 * and the system user's `CasePermission` grants via that relation's own
 * `onDelete: Cascade` — see `prisma/schema.prisma`). Use when reassignment
 * isn't wanted — deleting the row, not just revoking, gives up the
 * integration's own accountability trail, so prefer `revokeIntegration`
 * when that trail matters and this only when a human owner needs the
 * RESTRICT cleared without a new owner to hand off to.
 *
 * Deletion order inside the transaction is load-bearing, not incidental:
 * `Integration.systemUserId`/`ownerId` are BOTH `onDelete: Restrict` FKs
 * onto `User` (migration `20260703000000_extension_foundations`), so the
 * `Integration` row must be gone before its system user can be deleted —
 * deleting the user first would hit the RESTRICT constraint and roll back.
 * `$transaction([...])` (array form) runs its statements sequentially in
 * the order given, so `integration.delete` always precedes `user.delete`.
 *
 * Previously this deleted only the `Integration` row, orphaning the system
 * user: its unique `username`/`email` stuck around forever, permanently
 * blocking same-name re-registration (a fresh `registerIntegration` call
 * collides with the orphan's constraints, and the generic unique-violation
 * catch there misreports it as "An integration with this name already
 * exists"), and its `CasePermission` grants never cascaded away (the
 * cascade is keyed on the USER's delete, which never fired) — the delete
 * dialog's "removes ... its case-access grants" promise wasn't kept for a
 * grant list that referenced no case; the row itself just sat there,
 * masked from `listIntegrationCaseGrants` by "the integration no longer
 * exists" but never actually gone. Both are fixed by deleting the system
 * user in the same transaction (found + fixed 2026-07-14, staging repro).
 */
export async function deleteIntegrationRegistration(
	integrationId: string,
	actorUserId: string
): ServiceResult<true> {
	try {
		const existing = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true, name: true, systemUserId: true }
		);
		if ("error" in existing) {
			return existing;
		}

		await prisma.$transaction([
			prisma.integration.delete({ where: { id: integrationId } }),
			prisma.user.delete({ where: { id: existing.data.systemUserId } }),
		]);

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
		const integration = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ id: true, status: true }
		);
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

export interface TokenScopedOptions {
	/**
	 * The PATH's integration id (e.g. `[id]` in
	 * `/api/integrations/[id]/tokens/[tokenId]/rotate`). When present, the
	 * token must belong to THIS integration or the call fails with the same
	 * generic "Token not found" as a nonexistent tokenId — a caller who owns
	 * BOTH Integration A and Integration B cannot rotate/revoke a token that
	 * actually belongs to B by naming A in the URL (deviation-5 fix, work
	 * item 2). Optional — and left unchecked when omitted — so existing
	 * direct service callers (tests, scripts) that have no "path" concept at
	 * all are unaffected.
	 */
	integrationId?: string;
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
	actorUserId: string,
	options: TokenScopedOptions = {}
): ServiceResult<RotatedToken> {
	try {
		const owned = await getOwnedApiTokenOrError(tokenId, actorUserId, {
			id: true,
			integrationId: true,
			expiresAt: true,
			revokedAt: true,
			integration: { select: { status: true } },
		});
		if ("error" in owned) {
			return owned;
		}
		if (
			options.integrationId &&
			owned.data.integrationId !== options.integrationId
		) {
			return { error: "Token not found" };
		}
		const oldToken = owned.data;

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
	actorUserId: string,
	options: TokenScopedOptions = {}
): ServiceResult<ApiToken> {
	try {
		const owned = await getOwnedApiTokenOrError(tokenId, actorUserId, {
			id: true,
			integrationId: true,
			revokedAt: true,
		});
		if ("error" in owned) {
			return owned;
		}
		if (
			options.integrationId &&
			owned.data.integrationId !== options.integrationId
		) {
			return { error: "Token not found" };
		}
		if (owned.data.revokedAt) {
			return { error: "Token already revoked" };
		}

		const apiToken = await prisma.apiToken.update({
			where: { id: tokenId },
			data: { revokedAt: new Date() },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "token_revoked",
			metadata: { integrationId: owned.data.integrationId, tokenId },
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

// ============================================
// Case-access grants (ADR 0002 v2 — machine-access pillar; TEA — Integration
// case-access grants need a product surface)
// ============================================
//
// A registered integration authenticates fine on its own, but its system
// user starts with ZERO case permissions — nothing granted here means an
// integration that can present a valid bearer token yet touch no case at
// all, with no in-product way to fix that (the gap this section closes).
//
// `grantIntegrationCaseAccess` / `revokeIntegrationCaseAccess` sit on a
// SECOND authorisation axis on top of every other function in this file:
// `getOwnedIntegrationOrError` still gates who may act on the INTEGRATION
// (unchanged), but granting/revoking access to a CASE additionally requires
// the actor hold ADMIN on THAT case. That check reuses `canAccessCase` from
// `lib/permissions.ts` directly rather than `case-permission-service.ts`'s
// own `validateCaseAdmin` — that helper isn't exported, and, more
// importantly, its "Permission denied" error maps to a 403
// (`lib/api-response.ts`'s `ERROR_MAPPINGS`), which here would itself BE an
// enumeration oracle: a caller could distinguish "case doesn't exist" (404)
// from "case exists but you're not its admin" (403). `canAccessCase` already
// collapses both into a single `false` — `getCasePermission` returns
// `hasAccess: false` for a nonexistent case exactly like it does for
// "exists but no permission" (`lib/permissions.ts`) — so every failure here
// is reported as "Case not found", the same substring-matched 404
// `serviceErrorToAppError` already gives "Integration not found". A caller
// therefore cannot tell wrong integration owner, no case-admin, or a
// nonexistent case apart from one another. `requireIntegrationOwnerAndCaseAdmin`
// below is the single choke point both ops go through for this check.
//
// `listIntegrationCaseGrants` is deliberately NOT gated on case-admin the
// same way — it is owner-only, but per-row FILTERS its results to cases the
// ACTOR (not the integration's system user) can currently VIEW, rather than
// requiring admin on every row before returning any of them. An earlier
// version of this comment justified skipping any case-level check at all on
// the theory that a listed grant was "already made through this same
// authorised path" — that reasoning does not survive
// `reassignIntegrationOwner`: ownership can move to a user who was never the
// one who granted any of these permissions and may hold no access at all to
// some of the cases involved, so trusting integration-ownership alone would
// let a newly-assigned owner enumerate case ids/names they cannot otherwise
// see. Filtering by VIEW (not ADMIN) matches what listing actually discloses
// (id + name), not the higher bar granting/revoking requires.
//
// Grant additionally requires the integration be ACTIVE
// (`grantIntegrationCaseAccess`'s own doc comment) — list and revoke do not
// carry that gate; see their doc comments for why leaving them ungated is
// deliberate, not an oversight.

export interface IntegrationCaseGrant {
	caseId: string;
	caseName: string;
	grantedAt: Date;
	permission: PermissionLevel;
}

/**
 * Lists the integration's system user's current case permissions — the
 * `GET /api/integrations/[id]/case-grants` data source. Owner-only at the
 * INTEGRATION level (`getOwnedIntegrationOrError`), but each row is then
 * filtered to cases the ACTOR (the calling human, not the integration's
 * system user) can currently VIEW (`canAccessCase`, per-row) — deliberately
 * NOT a blanket "owner may see every grant" read. Integration ownership can
 * move (`reassignIntegrationOwner`) to a user who never made any of these
 * grants and has no access themselves to some of the cases involved; without
 * this filter, a newly-reassigned owner could learn case ids/names purely by
 * having been handed the integration, which is exactly the kind of
 * enumeration this module otherwise guards against (see the section doc
 * comment above). Not gated on integration status — see
 * `grantIntegrationCaseAccess`'s doc comment for why list/revoke stay
 * ungated while grant does not.
 */
export async function listIntegrationCaseGrants(
	integrationId: string,
	actorUserId: string
): ServiceResult<IntegrationCaseGrant[]> {
	try {
		const integration = await getOwnedIntegrationOrError(
			integrationId,
			actorUserId,
			{ systemUserId: true }
		);
		if ("error" in integration) {
			return integration;
		}

		const grants = await prisma.casePermission.findMany({
			where: { userId: integration.data.systemUserId },
			orderBy: { grantedAt: "desc" },
			include: { case: { select: { id: true, name: true } } },
		});

		const visibility = await Promise.all(
			grants.map((grant) =>
				canAccessCase({ userId: actorUserId, caseId: grant.case.id }, "VIEW")
			)
		);

		return {
			data: grants
				.filter((_grant, index) => visibility[index])
				.map((grant) => ({
					caseId: grant.case.id,
					caseName: grant.case.name,
					permission: grant.permission,
					grantedAt: grant.grantedAt,
				})),
		};
	} catch {
		return { error: "Failed to list case grants" };
	}
}

export interface IntegrationCaseGrantResult {
	alreadyGranted: boolean;
	caseId: string;
	caseName: string;
	grantedAt: Date;
	permission: PermissionLevel;
}

/**
 * Shared preamble for the case-grant family (`grantIntegrationCaseAccess`,
 * `revokeIntegrationCaseAccess`): verifies the actor owns `integrationId`
 * (`getOwnedIntegrationOrError`) AND holds ADMIN on `caseId`
 * (`canAccessCase`) — the second authorisation axis the section doc comment
 * above describes. Both checks collapse to the exact same "Integration not
 * found" / "Case not found" 404 shape their own call sites already produce
 * (never a 403 — see the section comment for why). Returns the
 * integration's `systemUserId` and `status` on success — `status` is
 * fetched here (not by a second `getOwnedIntegrationOrError` call) purely so
 * `grantIntegrationCaseAccess`'s own ACTIVE gate doesn't need a THIRD
 * ownership query; `revokeIntegrationCaseAccess` just ignores it.
 *
 * Deduped from what used to be two independently-maintained copies of this
 * exact block (fallow clone finding) — collapsing them here makes it
 * structurally impossible for grant and revoke to drift onto two different
 * error messages for the same failure, the same reasoning
 * `getOwnedIntegrationOrError`'s own doc comment gives for existing.
 */
async function requireIntegrationOwnerAndCaseAdmin(
	integrationId: string,
	caseId: string,
	actorUserId: string
): ServiceResult<{ status: Integration["status"]; systemUserId: string }> {
	const integration = await getOwnedIntegrationOrError(
		integrationId,
		actorUserId,
		{ systemUserId: true, status: true }
	);
	if ("error" in integration) {
		return integration;
	}

	const hasCaseAdmin = await canAccessCase(
		{ userId: actorUserId, caseId },
		"ADMIN"
	);
	if (!hasCaseAdmin) {
		return { error: "Case not found" };
	}

	return { data: integration.data };
}

/**
 * Upserts a `CasePermission` for the integration's system user — the target
 * userId is NEVER caller-supplied, it is derived server-side from the
 * integration (`integration.data.systemUserId`), so nothing in the request
 * body can ever grant access to an arbitrary user. Requires the actor OWN
 * the integration AND hold ADMIN on `caseId`
 * (`requireIntegrationOwnerAndCaseAdmin`; see the section doc comment above
 * for why both collapse to the same "Case not found" / "Integration not
 * found" 404 shape rather than a 403).
 *
 * Additionally requires the integration be ACTIVE — mirrors `issueToken`'s
 * own guard and error shape ("Cannot grant case access for a non-active
 * integration", mapped to 409 by `lib/api-response.ts`'s `ERROR_MAPPINGS`):
 * handing a suspended or revoked integration's system user MORE case access
 * makes no sense while it can't authenticate (SUSPENDED) or never will again
 * (REVOKED). This check runs after `requireIntegrationOwnerAndCaseAdmin`
 * rather than before — the two conditions are independent, so the ordering
 * doesn't change what any caller can learn: failing case-admin always
 * reports "Case not found" regardless of integration status, and an
 * inactive integration always reports this conflict regardless of case
 * access. `listIntegrationCaseGrants` and `revokeIntegrationCaseAccess`
 * deliberately do NOT carry this gate — listing or revoking a suspended or
 * revoked integration's access is exactly the cleanup path an operator
 * needs after suspending/revoking it, and blocking that would make the
 * suspend/revoke path harder to recover from, not safer.
 *
 * Rejects a soft-deleted (trashed) case identically to a nonexistent one —
 * `deletedAt` is checked locally, in the query below, rather than inside
 * `canAccessCase`/`lib/permissions.ts`: that helper ignoring soft-deletion
 * is a pre-existing, platform-wide gap (tracked separately —
 * "TEA — canAccessCase ignores soft-deleted cases (platform-wide)") that
 * affects every caller of `canAccessCase`, not just this one; fixing it here
 * only would paper over the general problem while leaving every other call
 * site exposed, so this closes just the local hole (granting NEW machine
 * access into trash) and leaves the platform-wide fix to that issue.
 *
 * Granting to a case the system user's integration already has access to
 * never throws a unique-constraint error — it always goes through
 * `upsert`, mirroring `shareByEmail`'s already-shared path. Re-granting the
 * EXACT SAME permission level is idempotent success (`alreadyGranted:
 * true`); re-granting a DIFFERENT level is a real write (the permission is
 * updated) and reports `alreadyGranted: false` — either way it is a normal
 * successful result, never an error. Granting when the system user is somehow already
 * the case's owner (never expected in practice — integrations don't create
 * cases — but checked defensively, same as `shareByEmail`'s owner check) is
 * also idempotent success: the owner already has implicit ADMIN, and
 * writing a `CasePermission` row for them would be a redundant, confusing
 * state.
 *
 * The `assuranceCase` lookup below is a second query even though
 * `canAccessCase` (inside `requireIntegrationOwnerAndCaseAdmin`) already
 * reads the same row internally — folding the two was considered (V6) and
 * NOT done: `canAccessCase` returns only a boolean, never the row, and
 * extending its return shape (or `lib/permissions.ts` generally) is exactly
 * the kind of platform-wide change the soft-delete issue above is already
 * scoped to weigh, not a trivial fold to make incidentally here.
 */
export async function grantIntegrationCaseAccess(
	integrationId: string,
	caseId: string,
	permission: PermissionLevel,
	actorUserId: string
): ServiceResult<IntegrationCaseGrantResult> {
	try {
		const authorised = await requireIntegrationOwnerAndCaseAdmin(
			integrationId,
			caseId,
			actorUserId
		);
		if ("error" in authorised) {
			return authorised;
		}
		if (authorised.data.status !== "ACTIVE") {
			return { error: "Cannot grant case access for a non-active integration" };
		}

		const assuranceCase = await prisma.assuranceCase.findUnique({
			where: { id: caseId },
			select: { id: true, name: true, createdById: true, deletedAt: true },
		});
		if (!assuranceCase || assuranceCase.deletedAt) {
			return { error: "Case not found" };
		}

		const { systemUserId } = authorised.data;

		if (assuranceCase.createdById === systemUserId) {
			return {
				data: {
					alreadyGranted: true,
					caseId,
					caseName: assuranceCase.name,
					permission,
					grantedAt: new Date(),
				},
			};
		}

		const existing = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId, userId: systemUserId } },
		});

		const grant = await prisma.casePermission.upsert({
			where: { caseId_userId: { caseId, userId: systemUserId } },
			create: {
				caseId,
				userId: systemUserId,
				permission,
				grantedById: actorUserId,
			},
			update: { permission, grantedById: actorUserId },
		});

		await writeAuditLog({
			userId: actorUserId,
			eventType: "integration_case_access_granted",
			metadata: { integrationId, caseId, permission },
		});

		return {
			data: {
				alreadyGranted: Boolean(existing && existing.permission === permission),
				caseId,
				caseName: assuranceCase.name,
				permission: grant.permission,
				grantedAt: grant.grantedAt,
			},
		};
	} catch {
		return { error: "Failed to grant case access" };
	}
}

/**
 * Removes the integration's system user's `CasePermission` on `caseId`, if
 * any. Same dual authorisation as `grantIntegrationCaseAccess`
 * (`requireIntegrationOwnerAndCaseAdmin`), but deliberately NOT gated on the
 * integration's status — see `grantIntegrationCaseAccess`'s doc comment for
 * why revoking (and listing) a suspended or revoked integration's case
 * access must keep working: it is the operator's cleanup path, not a
 * privilege grant. Uses `deleteMany` rather than `delete` so revoking an
 * already-absent grant is a no-op success rather than a Prisma "record not
 * found" throw — revoke is idempotent by design here (unlike `revokeToken`,
 * which treats a double-revoke as a 409 conflict: a case grant has no
 * "already revoked" state worth surfacing, it either exists or it doesn't).
 * The audit log write is skipped when nothing was actually removed
 * (`deleteMany`'s count is 0) — a revoke call against a grant that was never
 * there is a real no-op, not an event worth recording in the security audit
 * trail.
 */
export async function revokeIntegrationCaseAccess(
	integrationId: string,
	caseId: string,
	actorUserId: string
): ServiceResult<true> {
	try {
		const authorised = await requireIntegrationOwnerAndCaseAdmin(
			integrationId,
			caseId,
			actorUserId
		);
		if ("error" in authorised) {
			return authorised;
		}

		const { count } = await prisma.casePermission.deleteMany({
			where: { caseId, userId: authorised.data.systemUserId },
		});

		if (count > 0) {
			await writeAuditLog({
				userId: actorUserId,
				eventType: "integration_case_access_revoked",
				metadata: { integrationId, caseId },
			});
		}

		return { data: true };
	} catch {
		return { error: "Failed to revoke case access" };
	}
}
