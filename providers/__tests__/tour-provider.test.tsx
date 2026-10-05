import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTourControls } from "@/lib/tours/tour-controls";
import { TourProvider } from "../tour-provider";

vi.mock("@/lib/tours/resolve-tour", () => ({
	resolveTour: vi.fn((tour: unknown) => Promise.resolve(tour)),
}));

function initialStartTour() {
	return useTourControls.getInitialState().startTour;
}

describe("TourProvider", () => {
	beforeEach(() => {
		useTourControls.setState(useTourControls.getInitialState());
	});

	it("registers startTour on mount", () => {
		render(<TourProvider>{null}</TourProvider>);

		expect(useTourControls.getState().startTour).not.toBe(initialStartTour());
	});

	it("lets a component outside the provider's children start a tour", async () => {
		render(<TourProvider>{null}</TourProvider>);

		await act(() => {
			useTourControls.getState().startTour("dashboard");
			return Promise.resolve();
		});

		expect(useTourControls.getState()).toMatchObject({
			activeTour: "dashboard",
			isTourVisible: true,
		});
	});

	it("restores the no-op when it unmounts", () => {
		const { unmount } = render(<TourProvider>{null}</TourProvider>);

		unmount();

		expect(useTourControls.getState().startTour).toBe(initialStartTour());
	});
});
