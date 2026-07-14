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
 * Revokes the integration's system user's access to a case, if any is
 * currently granted. Idempotent — revoking a case that was never granted
 * (or already revoked) is a 200 success, not an error. Requires the caller
 * both own the integration and hold ADMIN on the case. Deliberately NOT
 * gated on integration status — revoking a suspended or revoked
 * integration's case access must keep working, since it is the operator's
 * cleanup path (see `revokeIntegrationCaseAccess`'s doc comment in
 * `integration-registry-service.ts`).
 *
 * @pathParam id - Integration ID (UUID)
 * @pathParam caseId - Case ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found, OR case not found, OR caller lacks case ADMIN (identical message/status for all three — no enumeration oracle)
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
