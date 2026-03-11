/**
 * Tour Service
 *
 * Handles user tour completion state. Tours are lightweight onboarding flows
 * that guide users through core features of the TEA Platform.
 */

const KNOWN_TOUR_IDS = ["dashboard", "case-canvas", "demo-case"] as const;

type KnownTourId = (typeof KNOWN_TOUR_IDS)[number];

export type TourServiceResult = { data: string[] } | { error: string };

/**
 * Validates that a tour ID is one of the known tour identifiers.
 */
export function isKnownTourId(tourId: string): tourId is KnownTourId {
	return KNOWN_TOUR_IDS.includes(tourId as KnownTourId);
}

/**
 * Fetches the list of completed tour IDs for the given user.
 * Returns an empty array if the user is not found.
 */
export async function getCompletedTours(
	userId: string
): Promise<TourServiceResult> {
	const { prisma } = await import("@/lib/prisma");

	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { completedTours: true },
		});

		return { data: user?.completedTours ?? [] };
	} catch (error) {
		console.error("[getCompletedTours]", { userId, error });
		return { error: "Failed to fetch completed tours" };
	}
}

/**
 * Marks a tour as completed for the given user.
 * Idempotent — marking an already-completed tour is a no-op.
 * Returns the updated list of completed tours.
 *
 * Returns an error if the tourId is not a known tour identifier.
 */
export async function markTourCompleted(
	userId: string,
	tourId: string
): Promise<TourServiceResult> {
	if (!isKnownTourId(tourId)) {
		return { error: `Unknown tour ID: ${tourId}` };
	}

	const { prisma } = await import("@/lib/prisma");

	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { completedTours: true },
		});

		if (!user) {
			return { data: [] };
		}

		// Idempotent: if already completed, return current state
		if (user.completedTours.includes(tourId)) {
			return { data: user.completedTours };
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

		return { data: updated.completedTours };
	} catch (error) {
		console.error("[markTourCompleted]", { userId, tourId, error });
		return { error: "Failed to mark tour as completed" };
	}
}
