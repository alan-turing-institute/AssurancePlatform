import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { listArchivedCopies } from "@/lib/services/case-trash-service";

/**
 * List the caller's archived Discover copies
 *
 * @description Returns the caller's own archived Discover copies — copies kept, rather than removed, when their published case moved to trash.
 * Includes copies whose case is still in trash and copies whose case has
 * since been permanently deleted.
 *
 * @response 200 - Array of archived copies
 * @response 401 - Unauthorised
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const result = await listArchivedCopies(userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
