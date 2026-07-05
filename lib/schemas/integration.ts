import { z } from "zod";
import { SCOPES } from "@/lib/auth/scopes";
import { optionalString, requiredString } from "@/lib/schemas/base";

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

// ============================================
// PATCH /api/integrations/[id]
// ============================================

/**
 * Body schema for updating an integration's description and/or scopes.
 * Both fields optional, but at least one must be present — an empty PATCH
 * is a caller bug, not a no-op success.
 */
export const updateIntegrationSchema = z
	.object({
		description: optionalString(1000),
		scopes: integrationScopesSchema.optional(),
	})
	.refine(
		(data) => data.description !== undefined || data.scopes !== undefined,
		{ message: "At least one field to update must be provided" }
	);

export type UpdateIntegrationBody = z.infer<typeof updateIntegrationSchema>;

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
export const issueTokenSchema = z.object({
	expiresAt: z.coerce
		.date()
		.refine((date) => date.getTime() > Date.now(), {
			message: "expiresAt must be in the future",
		})
		.optional(),
});

export type IssueTokenBody = z.infer<typeof issueTokenSchema>;
