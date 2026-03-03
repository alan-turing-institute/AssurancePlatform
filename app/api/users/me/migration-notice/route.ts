import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { dismissMigrationNotice } from "@/lib/services/user-service";

/**
 * POST /api/users/me/migration-notice
 * Marks the migration notice as seen for the current user.
 * Only succeeds if the user has a valid email address (not a placeholder).
 */
export async function POST() {
	try {
		const userId = await requireAuth();
		const result = await dismissMigrationNotice(userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
