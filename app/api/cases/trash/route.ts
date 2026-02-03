import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { listTrashedCases } from "@/lib/services/case-trash-service";

/**
 * List cases in the user's trash
 *
 * @description Returns all soft-deleted cases owned by the current user.
 * Only case owners can view their deleted cases; collaborators cannot see
 * deleted cases they were shared with.
 *
 * @response 200 - Array of trashed cases with deletion info
 * @response 401 - Unauthorised
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const result = await listTrashedCases(userId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data?.cases ?? []);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
