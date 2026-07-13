import { z } from "zod";
import { SCOPES } from "@/lib/auth/scopes";
import { optionalString, requiredString, uuidSchema } from "@/lib/schemas/base";

/**
 * Zod schemas for the integration management API (ADR 0002 v2 §2.4, work
 * item 7) — `app/api/integrations/**`. All routes on this surface are
 * human-session (`requireAuth()`), owner-only, and delegate to
 * `lib/services/integration-registry-service.ts`.
 */

// ============================================
// Scopes
// ============================================

const MAX_SCOPES = 20;

/**
 * A single scope string, validated against the CLOSED vocabulary in
 * `lib/auth/scopes.ts` — `SCOPES` is a compile-time `as const` tuple (unlike
 * the plugin manifest, it isn't populated at runtime), so `z.enum` can bind
 * it directly rather than re-checking membership in a `.refine`. An unknown
 * scope is rejected here with a proper 400, before the service layer's own
 * `findUnknownScopes` defence-in-depth check ever runs.
 */
const integrationScopeSchema = z.enum(SCOPES);

/**
 * At least one scope, capped at `MAX_SCOPES` — an integration with zero
 * scopes can authenticate but call nothing, which is never a useful state
 * to register or update into; suspend/revoke are the correct way to
 * disable an integration instead of stripping every scope.
 */
export const integrationScopesSchema = z
	.array(integrationScopeSchema)
	.min(1, "At least one scope is required")
	.max(MAX_SCOPES, `At most ${MAX_SCOPES} scopes are allowed`);

// ============================================
// POST /api/integrations
// ============================================

/**
 * Body schema for registering an integration. `ownerId` is deliberately
 * ABSENT — the service derives it from the session-authenticated actor
 * (`registerIntegration`'s `actorUserId`), so nothing in this body can ever
 * name a different owner (vincent's session-derived-identity trust
 * statement, 2026-07-03).
 */
export const registerIntegrationSchema = z.object({
	name: requiredString("Name", 1, 100),
	description: optionalString(1000),
	scopes: integrationScopesSchema,
});

export type RegisterIntegrationBody = z.infer<typeof registerIntegrationSchema>;

/**
 * The register form's raw field-values shape — react-hook-form +
 * `zodResolver` work with this PRE-transform shape (`description` still
 * allows `null`, `optionalString`'s own input type before its
 * `.transform()` folds `null`/empty into `undefined`), not the parsed
 * `RegisterIntegrationBody` output the resolver hands to `onSubmit`. Same
 * input/output split as `PersonalInfoFormInput`/`Output` in
 * `lib/schemas/user.ts`.
 */
export type RegisterIntegrationFormInput = z.input<
	typeof registerIntegrationSchema
>;

// ============================================
// PATCH /api/integrations/[id]
// ============================================

/**
 * Body schema for updating an integration's description and/or scopes.
 * Both fields optional, but at least one must be present — an empty PATCH
 * is a caller bug, not a no-op success.
 */
// No `z.infer` alias here — nothing currently consumes an updateIntegrationSchema
// type outside the route's own `.safeParse` call. Add one back when an edit UI
// lands and a caller needs the parsed shape by name.
export const updateIntegrationSchema = z
	.object({
		description: optionalString(1000),
		scopes: integrationScopesSchema.optional(),
	})
	.refine(
		(data) => data.description !== undefined || data.scopes !== undefined,
		{ message: "At least one field to update must be provided" }
	);

// ============================================
// POST /api/integrations/[id]/tokens
// ============================================

/**
 * Body schema for issuing a token. `expiresAt` is optional — omitted means
 * never-expiring (see `issueToken`'s doc comment in
 * `integration-registry-service.ts` for why that's the considered default).
 * When present, it must be in the future: the service itself accepts a
 * past `expiresAt` (useful for internal test fixtures), but an API caller
 * asking for an already-dead token is always a mistake worth rejecting at
 * the boundary rather than silently honouring.
 */
// No `z.infer` alias here — nothing currently consumes an issueTokenSchema
// type outside the route's own `.safeParse` call. Add one back when an
// expiry-picker UI lands and a caller needs the parsed shape by name.
export const issueTokenSchema = z.object({
	expiresAt: z.coerce
		.date()
		.refine((date) => date.getTime() > Date.now(), {
			message: "expiresAt must be in the future",
		})
		.optional(),
});

// ============================================
// POST /api/integrations/[id]/case-grants
// ============================================

/**
 * Permission levels grantable to an integration's system user —
 * VIEW/COMMENT/EDIT only, deliberately narrower than the full
 * `permissionLevelSchema` (which also allows ADMIN for human case-sharing).
 * Least privilege: no machine-facing surface in this codebase does anything
 * with case-ADMIN today (team/collaborator management, deletion) that a
 * machine principal has any business doing unattended, so there is nothing
 * for machine-ADMIN to be USED for right now — granting it would be inert
 * capability sitting on a system user, which is a standing risk with no
 * offsetting benefit. A request naming ADMIN is rejected here with a 400
 * validation error, never silently downgraded to EDIT — if machine-ADMIN is
 * ever wanted, that should arrive as its own deliberate, reviewed change,
 * not as a value this schema quietly lets through.
 */
const grantableCasePermissionSchema = z.enum(["VIEW", "COMMENT", "EDIT"], {
	message: "Invalid permission level",
});

/**
 * Body schema for granting an integration's system user access to a case.
 * `permission` is restricted to `grantableCasePermissionSchema`
 * (VIEW/COMMENT/EDIT — see its doc comment for why ADMIN is excluded); there
 * is no `userId` field — the grant always targets the integration's OWN
 * system user, derived server-side in `grantIntegrationCaseAccess`, never a
 * caller-supplied one.
 */
// No `z.infer` alias here — nothing currently consumes a GrantCaseAccessBody
// type outside the route's own `.safeParse` call (file convention — see
// `updateIntegrationSchema`/`issueTokenSchema` above). Add one back when a
// caller needs the parsed shape by name.
export const grantCaseAccessSchema = z.object({
	caseId: uuidSchema,
	permission: grantableCasePermissionSchema,
});

// ============================================
// Response wire shapes — settings UI
// ============================================
//
// These mirror the JSON `GET`/`POST` response bodies from `app/api/
// integrations/**`, not `lib/services/integration-registry-service.ts`'s
// `IntegrationListItem`/`IntegrationTokenSummary` — deliberately hand-written
// here rather than imported from the service, for the same reason
// `PluginSettingsListItem` lives in `lib/schemas/plugin.ts` rather than being
// imported from a service: components/hooks must never import from
// `lib/services/` (house rule — Prisma-touching modules), and the shapes
// actually differ anyway once JSON is in the picture — every `Date` on the
// service type crosses the wire as an ISO string, not a `Date` instance.

/** An integration's lifecycle state (mirrors the Prisma `IntegrationStatus` enum without importing it). */
export type IntegrationStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

/**
 * One issued token's summary as returned by `GET /api/integrations` — never
 * the plaintext secret or hash, only what's needed to identify and manage it.
 * `revokedAt`/`expiresAt` are both nullable and independent: a token can be
 * expired but not revoked, or revoked before its expiry ever arrives.
 */
export interface IntegrationTokenSummary {
	createdAt: string;
	expiresAt: string | null;
	id: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
	tokenPrefix: string;
}

/** A single integration as returned by `GET /api/integrations` — the settings pane's only data source. */
export interface IntegrationListItem {
	createdAt: string;
	description: string | null;
	id: string;
	lastSeenAt: string | null;
	name: string;
	scopes: string[];
	status: IntegrationStatus;
	tokens: IntegrationTokenSummary[];
	updatedAt: string;
}

/** The token summary embedded in an issue/rotate response — a narrower shape than `IntegrationTokenSummary` (no `revokedAt`: a token just issued or rotated in is never revoked). */
export interface IssuedTokenSummary {
	createdAt: string;
	expiresAt: string | null;
	id: string;
	tokenPrefix: string;
}

/**
 * `POST /api/integrations/[id]/tokens` response — the plaintext `secret` is
 * present here and ONLY here. Callers must not persist it in any state that
 * outlives the token-shown-once modal.
 */
export interface IssuedTokenResult {
	secret: string;
	token: IssuedTokenSummary;
}

/**
 * `POST /api/integrations/[id]/tokens/[tokenId]/rotate` response — like
 * `IssuedTokenResult` but also names the token it replaced and the overlap
 * window during which both the old and new secrets still authenticate.
 */
export interface RotatedTokenResult {
	oldTokenId: string;
	overlapUntil: string;
	secret: string;
	token: IssuedTokenSummary;
}

/**
 * Case-grant permission levels a machine principal may hold — mirrors
 * `grantableCasePermissionSchema` above (VIEW/COMMENT/EDIT only, never
 * ADMIN). Kept as its own wire-shape type rather than reusing a
 * `z.infer<typeof grantableCasePermissionSchema>` alias, for the same reason
 * `IntegrationStatus` above doesn't import the Prisma enum: this crosses the
 * wire as a JSON string, and components/hooks must never import from
 * `lib/services/` or reach for a Prisma-derived type.
 */
export type CaseGrantPermission = "COMMENT" | "EDIT" | "VIEW";

/**
 * One case an integration's system user currently has access to, as
 * returned by `GET /api/integrations/[id]/case-grants` and (on success) by
 * `POST .../case-grants`'s `grant` field — mirrors
 * `IntegrationCaseGrant`/`IntegrationCaseGrantResult` in
 * `lib/services/integration-registry-service.ts`, JSON-shaped (`grantedAt`
 * a string, never a `Date`).
 */
export interface IntegrationCaseGrant {
	caseId: string;
	caseName: string;
	grantedAt: string;
	permission: CaseGrantPermission;
}
