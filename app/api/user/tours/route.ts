import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { KNOWN_TOUR_IDS, tourCompletionSchema } from "@/lib/schemas/tour";
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
 */
export async function PATCH(req: Request) {
	try {
		const userId = await requireAuth();

		const body = await req.json();
		const parsed = tourCompletionSchema.safeParse(body);

		if (!parsed.success) {
			return apiError(
				validationError(
					`Invalid tour ID. Expected one of: ${KNOWN_TOUR_IDS.join(", ")}`
				)
			);
		}

		const result = await markTourCompleted(userId, parsed.data.tourId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ completedTours: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
