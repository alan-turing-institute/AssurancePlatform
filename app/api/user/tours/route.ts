import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { tourCompletionSchema } from "@/lib/schemas/tour";
import {
	getCompletedTours,
	markTourCompleted,
} from "@/lib/services/tour-service";

/**
 * GET /api/user/tours
 * Returns the list of completed tour IDs for the current user.
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const result = await getCompletedTours(userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ completedTours: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PATCH /api/user/tours
 * Marks a tour as completed for the current user.
 * Idempotent — completing an already-completed tour returns success.
 * @response 413 - Payload too large
 */
export async function PATCH(req: Request) {
	try {
		const userId = await requireAuth();

		const { tourId } = await parseJsonBody(req, tourCompletionSchema);

		const result = await markTourCompleted(userId, tourId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ completedTours: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
