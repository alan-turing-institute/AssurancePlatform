import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { registerIntegrationSchema } from "@/lib/schemas/integration";
import {
	listIntegrationsForOwner,
	registerIntegration,
} from "@/lib/services/integration-registry-service";

/**
 * GET /api/integrations
 *
 * Lists the integrations the signed-in user owns, never anyone else's.
 * Each entry carries a summary of every token issued for it: prefix,
 * timestamps, expiry and revocation state.
 * A token's secret and hash are never returned; the secret is shown once,
 * when the token is issued.
 *
 * @description Lists the integrations the signed-in user owns, each with a summary of its tokens and never a secret.
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
 * Registers an integration. The signed-in user becomes its owner, so the body
 * has no owner field.
 * The response is the integration without a token; issue one with
 * `POST /api/integrations/[id]/tokens`.
 * Every scope must be one the platform defines, and at least one is required.
 *
 * @description Registers an integration owned by the signed-in user and returns it without a token; any signed-in user may register one, and an unknown scope is a 400.
 * @body { name: string, description?: string, scopes: string[] }
 * @response 201 - The created integration (no token)
 * @response 400 - Validation error (including an unknown scope)
 * @response 401 - Unauthorised
 * @response 409 - An integration with this name already exists
 * @response 413 - Payload too large
 * @add 409
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(request: Request) {
	try {
		const userId = await requireAuth();

		const data = await parseJsonBody(request, registerIntegrationSchema);

		const result = await registerIntegration(
			{
				name: data.name,
				description: data.description,
				scopes: data.scopes,
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
