import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { registerIntegrationSchema } from "@/lib/schemas/integration";
import {
	listIntegrationsForOwner,
	registerIntegration,
} from "@/lib/services/integration-registry-service";

/**
 * GET /api/integrations
 *
 * Lists every integration the SESSION USER owns — never anyone else's
 * (ADR 0002 v2 §2.4, work item 7). Each entry carries a token SUMMARY per
 * issued token (prefix, timestamps, expiry/revocation state); the
 * plaintext secret and hash are never part of this response — issuance
 * (`POST .../tokens`) is the only moment a secret is ever shown.
 *
 * @description Owner-only listing — the caller's own integrations only.
 * @response 200 - `{ integrations: IntegrationListItem[] }`
 * @response 401 - Unauthorised
 * @auth SessionAuth
 * @tag Integrations
 */
export async function GET() {
	try {
		const userId = await requireAuth();

		const result = await listIntegrationsForOwner(userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integrations: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/integrations
 *
 * Registers a new integration owned by the SESSION USER. `ownerId` is not
 * an accepted field — it is always derived from the session, never from
 * the request body (vincent's session-derived-identity trust statement,
 * 2026-07-03), so a caller cannot register on someone else's behalf.
 * Returns the integration only — no token. Issuing a token is a separate,
 * explicit step (`POST /api/integrations/[id]/tokens`).
 *
 * @description Any authenticated user may register an integration; the
 * registrant becomes its owner. `scopes` is validated against the closed
 * vocabulary in `lib/auth/scopes.ts` — an unknown scope is a 400.
 * @body { name: string, description?: string, scopes: string[] }
 * @response 201 - The created integration (no token)
 * @response 400 - Validation error (including an unknown scope)
 * @response 401 - Unauthorised
 * @response 409 - An integration with this name already exists
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(request: Request) {
	try {
		const userId = await requireAuth();

		const parsed = registerIntegrationSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const result = await registerIntegration(
			{
				name: parsed.data.name,
				description: parsed.data.description,
				scopes: parsed.data.scopes,
			},
			userId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data.integration }, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
