import type { Tour } from "nextstepjs";
import { caseCanvasTour } from "./case-canvas-tour";
import { dashboardTour } from "./dashboard-tour";
import { demoCaseTour } from "./demo-case-tour";

/**
 * Tour identifiers as stored in `users.completed_tours`. The strings are
 * persisted, so renaming one makes every user see that tour again.
 */
export const TOUR_IDS = ["dashboard", "case-canvas", "demo-case"] as const;

export type TourId = (typeof TOUR_IDS)[number];

export const allTours: Tour[] = [dashboardTour, caseCanvasTour, demoCaseTour];

/** Returns the tour with the given id, or undefined if none is registered. */
export function getTour(id: string): Tour | undefined {
	return allTours.find((tour) => tour.tour === id);
}
