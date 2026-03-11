import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { purgeCase } from "@/lib/services/case-trash-service";

/**
 * Permanently delete a case from trash
 *
 * @description Permanently deletes a soft-deleted case. This action cannot be undone.
 * Only the case owner can purge their deleted cases.
 * The case must be in trash (deletedAt must be set).
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
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const result = await purgeCase(userId, id);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
