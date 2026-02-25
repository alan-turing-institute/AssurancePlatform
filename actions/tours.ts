"use server";

import { validateSession } from "@/lib/auth/validate-session";

const KNOWN_TOUR_IDS = ["dashboard", "case-canvas", "demo-case"] as const;

type KnownTourId = (typeof KNOWN_TOUR_IDS)[number];

/**
 * Fetches the list of completed tour IDs for the current user.
 * Returns an empty array if the user is not authenticated or not found.
 */
export async function fetchCompletedTours(): Promise<string[]> {
	const validated = await validateSession();
	if (!validated) {
		return [];
	}

	const { prisma } = await import("@/lib/prisma");

	const user = await prisma.user.findUnique({
		where: { id: validated.userId },
		select: { completedTours: true },
	});

	return user?.completedTours ?? [];
}

/**
 * Marks a tour as completed for the current user.
 * Idempotent -- completing an already-completed tour is a no-op.
 * Returns the updated list of completed tours, or null if the tourId is invalid.
 */
export async function markTourCompleted(
	tourId: string
): Promise<string[] | null> {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	if (!KNOWN_TOUR_IDS.includes(tourId as KnownTourId)) {
		return null;
	}

	const { prisma } = await import("@/lib/prisma");

	const user = await prisma.user.findUnique({
		where: { id: validated.userId },
		select: { completedTours: true },
	});

	if (!user) {
		return [];
	}

	// Idempotent: if already completed, return current state
	if (user.completedTours.includes(tourId)) {
		return user.completedTours;
	}

	const updated = await prisma.user.update({
		where: { id: validated.userId },
		data: {
			completedTours: {
				push: tourId,
			},
		},
		select: { completedTours: true },
	});

	return updated.completedTours;
}
