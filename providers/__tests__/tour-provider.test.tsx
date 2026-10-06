import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTourControls } from "@/lib/tours/tour-controls";
import { TourProvider } from "../tour-provider";

vi.mock("@/lib/tours/resolve-tour", () => ({
	resolveTour: vi.fn((tour: unknown) => Promise.resolve(tour)),
}));

const { resolveTour } = await import("@/lib/tours/resolve-tour");

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

	it("marks the provider ready on mount and not ready on unmount", () => {
		const { unmount } = render(<TourProvider>{null}</TourProvider>);
		expect(useTourControls.getState().ready).toBe(true);

		unmount();

		expect(useTourControls.getState().ready).toBe(false);
	});

	it("shows the trimmed tour on the card, counting only the steps kept", async () => {
		vi.mocked(resolveTour).mockResolvedValueOnce({
			tour: "dashboard",
			steps: [{ title: "Only step", content: "Just this one." }],
		} as never);
		render(<TourProvider>{null}</TourProvider>);

		await act(() => {
			useTourControls.getState().startTour("dashboard");
			return Promise.resolve();
		});

		expect(await screen.findByText("1 of 1")).toBeTruthy();
		expect(screen.getByText("Only step")).toBeTruthy();
	});

	it("drops a start that resolves after the user has navigated away", async () => {
		let release: (tour: unknown) => void = () => undefined;
		vi.mocked(resolveTour).mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve;
			}) as never
		);
		const tour = (await import("@/lib/tours")).getTour("dashboard");
		render(<TourProvider>{null}</TourProvider>);

		act(() => useTourControls.getState().startTour("dashboard"));
		window.location.pathname = "/somewhere-else";
		await act(async () => {
			release(tour);
			await Promise.resolve();
		});
		window.location.pathname = "/";

		expect(useTourControls.getState().isTourVisible).toBe(false);
	});

	it("lets only the latest of two overlapping starts reach the library", async () => {
		const tour = (await import("@/lib/tours")).getTour("dashboard");
		const releases: Array<(tour: unknown) => void> = [];
		vi.mocked(resolveTour).mockImplementation(
			() =>
				new Promise((resolve) => {
					releases.push(resolve);
				}) as never
		);
		render(<TourProvider>{null}</TourProvider>);

		act(() => {
			useTourControls.getState().startTour("dashboard");
			useTourControls.getState().startTour("dashboard");
		});
		await act(async () => {
			releases[0]?.(tour);
			await Promise.resolve();
		});
		expect(useTourControls.getState().isTourVisible).toBe(false);

		await act(async () => {
			releases[1]?.(tour);
			await Promise.resolve();
		});
		expect(useTourControls.getState().isTourVisible).toBe(true);

		vi.mocked(resolveTour).mockImplementation(((t: unknown) =>
			Promise.resolve(t)) as never);
	});

	it("returns focus to the named fallback once the starting control is gone", async () => {
		const fallback = document.createElement("button");
		fallback.id = "fallback";
		document.body.appendChild(fallback);
		const origin = document.createElement("button");
		origin.dataset.tourReturnFocus = "#fallback";
		document.body.appendChild(origin);
		origin.focus();
		render(<TourProvider>{null}</TourProvider>);

		await act(() => {
			useTourControls.getState().startTour("dashboard");
			return Promise.resolve();
		});
		expect(useTourControls.getState().isTourVisible).toBe(true);
		origin.remove();
		await act(() => {
			document
				.querySelector<HTMLButtonElement>('[aria-label="Close tour"]')
				?.click();
			return Promise.resolve();
		});

		expect(useTourControls.getState().isTourVisible).toBe(false);
		expect(document.activeElement).toBe(fallback);
		fallback.remove();
	});
});
