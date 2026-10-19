import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { revokeIntegrationCaseAccess } from "@/lib/services/integration-registry-service";

/**
 * DELETE /api/integrations/[id]/case-grants/[caseId]
 *
 * Removes the integration's account access to a case.
 * Removing a grant that does not exist succeeds, so the call can be repeated.
 * The signed-in user must own the integration and hold Admin access to the
 * case.
 * It works for a suspended or revoked integration, so an owner can still clean
 * up its access.
 *
 * @description Removes the integration's access to a case; removing a grant that does not exist succeeds, and it works for a suspended or revoked integration.
 * @pathParam id - Integration ID (UUID)
 * @pathParam caseId - Case ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found, case not found, or the signed-in user lacks Admin on the case, all with the same message
 * @add 404
 * @auth SessionAuth
 * @tag Integrations
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ caseId: string; id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id, caseId } = await params;

		const parsedId = uuidSchema.safeParse(id);
		const parsedCaseId = uuidSchema.safeParse(caseId);
		if (!(parsedId.success && parsedCaseId.success)) {
			return apiError(validationError("Invalid id"));
		}

		const result = await revokeIntegrationCaseAccess(
			parsedId.data,
			parsedCaseId.data,
			userId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
