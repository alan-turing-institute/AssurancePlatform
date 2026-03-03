import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { restoreCase } from "@/lib/services/case-trash-service";

/**
 * Restore a case from trash
 *
 * @description Restores a soft-deleted case, clearing deletedAt and deletedById fields.
 * Only the case owner can restore their deleted cases.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - { success: true }
 * @response 400 - Case is not in trash
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (owner only)
 * @response 404 - Case not found
 * @auth bearer
 * @tag Cases
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const result = await restoreCase(userId, id);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
