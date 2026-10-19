import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { revokeIntegration } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/revoke
 *
 * Revokes an integration permanently and revokes every token it still has, in
 * one step.
 * Revocation is final: a revoked integration cannot be reactivated.
 * Only the owner can revoke an integration.
 *
 * @description Revokes an integration permanently, together with all of its tokens that are still valid; a revoked integration cannot be reactivated.
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The revoked integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @add 404
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid integration id"));
		}

		const result = await revokeIntegration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
