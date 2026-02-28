import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { KNOWN_TOUR_IDS, tourCompletionSchema } from "@/lib/schemas/tour";

/**
 * GET /api/user/tours
 * Returns the list of completed tour IDs for the current user.
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const { prisma } = await import("@/lib/prisma");

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { completedTours: true },
		});

		return apiSuccess({ completedTours: user?.completedTours ?? [] });
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

		const { tourId } = parsed.data;
		const { prisma } = await import("@/lib/prisma");

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { completedTours: true },
		});

		if (!user) {
			return apiSuccess({ completedTours: [] });
		}

		// Idempotent: if already completed, just return current state
		if (user.completedTours.includes(tourId)) {
			return apiSuccess({ completedTours: user.completedTours });
		}

		const updated = await prisma.user.update({
			where: { id: userId },
			data: {
				completedTours: {
					push: tourId,
				},
			},
			select: { completedTours: true },
		});

		return apiSuccess({ completedTours: updated.completedTours });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
