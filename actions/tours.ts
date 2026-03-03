"use server";

import { validateSession } from "@/lib/auth/validate-session";
import {
	getCompletedTours,
	markTourCompleted as markTourCompletedService,
} from "@/lib/services/tour-service";

/**
 * Fetches the list of completed tour IDs for the current user.
 * Returns an empty array if the user is not authenticated or not found.
 */
export async function fetchCompletedTours(): Promise<string[]> {
	const validated = await validateSession();
	if (!validated) {
		return [];
	}

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

	const result = await markTourCompletedService(validated.userId, tourId);
	if ("error" in result) {
		return null;
	}
	return result.data;
}
