import { create } from "zustand";
import type { TourId } from "./index";

interface TourControlsState {
	/** Id of the tour currently on screen, or null. */
	activeTour: string | null;
	/** Whether a tour card is currently showing. */
	isTourVisible: boolean;
	/**
	 * Starts a tour, dropping any step whose target is not on the page.
	 * A no-op until `TourProvider` is mounted.
	 */
	startTour: (id: TourId) => void;
}

const noopStartTour: TourControlsState["startTour"] = () => undefined;

/**
 * Lets components outside `TourProvider`'s own tree start a tour and see
 * whether one is showing, without depending on the tour library's context.
 * `TourProvider` fills it in while mounted.
 */
export const useTourControls = create<TourControlsState>(() => ({
	activeTour: null,
	isTourVisible: false,
	startTour: noopStartTour,
}));

/** Puts the store back to its initial, inert state. */
export function resetTourControls(): void {
	useTourControls.setState({
		activeTour: null,
		isTourVisible: false,
		startTour: noopStartTour,
	});
}
