import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { suspendIntegration } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/suspend
 *
 * Suspends an active integration.
 * Every token it has issued stops authenticating while it stays suspended.
 * Nothing is deleted, and `POST .../reactivate` reverses the suspension.
 * Only the owner can suspend an integration.
 *
 * @description Suspends an active integration so that none of its tokens authenticate until it is reactivated; a revoked integration cannot be suspended (409).
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The suspended integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @response 409 - The integration is revoked, which is final, so it cannot be suspended
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

		const result = await suspendIntegration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
