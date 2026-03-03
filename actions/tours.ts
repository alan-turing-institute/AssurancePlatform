"use server";

import { z } from "zod";
import { validateSession } from "@/lib/auth/validate-session";

const tourIdSchema = z.string().min(1, "Tour ID is required").max(100);

/**
 * Fetches the list of completed tour IDs for the current user.
 * Returns an empty array if the user is not authenticated or not found.
 */
export async function fetchCompletedTours(): Promise<string[]> {
	const validated = await validateSession();
	if (!validated) {
		return [];
	}

	const { getCompletedTours } = await import("@/lib/services/tour-service");
	const result = await getCompletedTours(validated.userId);
	if ("error" in result) {
		return [];
	}
	return result.data;
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

	const idResult = tourIdSchema.safeParse(tourId);
	if (!idResult.success) {
		return null;
	}

	const { markTourCompleted: markTourCompletedService } = await import(
		"@/lib/services/tour-service"
	);
	const result = await markTourCompletedService(
		validated.userId,
		idResult.data
	);
	if ("error" in result) {
		return null;
	}
	return result.data;
}
