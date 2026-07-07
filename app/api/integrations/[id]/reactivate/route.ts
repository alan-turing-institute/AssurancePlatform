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
 * Reverses `suspend` (SUSPENDED → ACTIVE). Owner-only, audited.
 *
 * @description REVOKED stays terminal — reactivating a revoked integration
 * is a 409, never a resurrection. Reactivating an already-ACTIVE
 * integration is also a 409 (no-op success would hide a caller mistake).
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The reactivated integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
 * @response 409 - The integration is REVOKED, or already ACTIVE
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
