import { z } from "zod";

import { TOUR_IDS } from "@/lib/tours";

/** Known tour IDs in the platform; the list lives in `lib/tours`. */
export const KNOWN_TOUR_IDS = TOUR_IDS;

export type { TourId } from "@/lib/tours";

/**
 * Schema for marking a tour as completed.
 */
export const tourCompletionSchema = z.strictObject({
	tourId: z.enum(KNOWN_TOUR_IDS, {
		message: `Invalid tour ID. Expected one of: ${KNOWN_TOUR_IDS.join(", ")}`,
	}),
});

export type TourCompletionInput = z.input<typeof tourCompletionSchema>;
export type TourCompletionOutput = z.output<typeof tourCompletionSchema>;
