import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { uuidSchema } from "@/lib/schemas/base";
import { removeArchivedCopy } from "@/lib/services/case-trash-service";

/**
 * Remove one of the caller's archived Discover copies
 *
 * @description Permanently removes one of the caller's archived Discover copies.
 * The author can take an archived copy down at any time, including after
 * the case itself has been permanently deleted. Only the copy's owner may
 * remove it; a missing id and someone else's copy return the same response,
 * so it cannot be used to enumerate other users' archived copies.
 *
 * @pathParam publishedId - Published copy ID (UUID)
 * @response 200 - { success: true }
 * @response 401 - Unauthorised
 * @response 404 - Archived copy not found, or not owned by the caller
 * @auth bearer
 * @tag Cases
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ publishedId: string }> }
) {
	try {
		const userId = await requireAuth();
		const { publishedId } = await params;

		const idResult = uuidSchema.safeParse(publishedId);
		if (!idResult.success) {
			return apiError(serviceErrorToAppError("Archived copy not found"));
		}

		const result = await removeArchivedCopy(userId, idResult.data);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
