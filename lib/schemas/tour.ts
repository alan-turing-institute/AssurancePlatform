import { z } from "zod";

/**
 * Known tour IDs in the platform.
 * Matches the list used in `app/api/user/tours/route.ts`.
 */
export const KNOWN_TOUR_IDS = [
	"dashboard",
	"case-canvas",
	"demo-case",
] as const;

export type TourId = (typeof KNOWN_TOUR_IDS)[number];

/**
 * Schema for marking a tour as completed.
 */
export const tourCompletionSchema = z.object({
	tourId: z.enum(KNOWN_TOUR_IDS, {
		errorMap: () => ({
			message: `Invalid tour ID. Expected one of: ${KNOWN_TOUR_IDS.join(", ")}`,
		}),
	}),
});

export type TourCompletionInput = z.input<typeof tourCompletionSchema>;
export type TourCompletionOutput = z.output<typeof tourCompletionSchema>;
