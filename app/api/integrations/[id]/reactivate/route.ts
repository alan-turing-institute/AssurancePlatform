import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { reactivateIntegration } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/reactivate
 *
 * Reverses a suspension, so the integration's tokens authenticate again.
 * Only the owner can reactivate an integration.
 *
 * @description Reactivates a suspended integration; a revoked integration cannot be reactivated, and reactivating one that is already active is a 409.
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The reactivated integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @response 409 - The integration is revoked, or already active
 * @add 404,409
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

		const result = await reactivateIntegration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
