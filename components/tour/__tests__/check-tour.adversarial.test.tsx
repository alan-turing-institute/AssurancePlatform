import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTourControls, useTourControls } from "@/lib/tours/tour-controls";

const markTourCompleted = vi.fn(async (_id: string) => [] as string[]);
const fetchCompletedTours = vi.fn(async () => [] as string[]);

vi.mock("@/actions/tours", () => ({
	markTourCompleted: (id: string) => markTourCompleted(id),
	fetchCompletedTours: () => fetchCompletedTours(),
}));

const { default: CheckTour } = await import("../check-tour");

const startTour = vi.fn();
const originalWidth = window.innerWidth;

function show(id: string | null, visible: boolean) {
	act(() => {
		useTourControls.setState({ activeTour: id, isTourVisible: visible });
	});
}

async function settle() {
	await act(async () => {
		await new Promise((r) => setTimeout(r, 30));
	});
}

describe("CheckTour (adversarial)", () => {
	beforeEach(() => {
		markTourCompleted.mockClear();
		fetchCompletedTours.mockReset();
		fetchCompletedTours.mockResolvedValue([]);
		startTour.mockClear();
		resetTourControls();
		useTourControls.setState({ startTour, ready: true });
		window.innerWidth = 1280;
	});

	afterEach(() => {
		window.innerWidth = originalWidth;
	});

	it("does not start when the tour is already completed", async () => {
		render(<CheckTour completedTours={["dashboard"]} tourId="dashboard" />);
		await settle();
		expect(startTour).not.toHaveBeenCalled();
	});

	it("does not start when disabled, and starts once enabled", async () => {
		const { rerender } = render(
			<CheckTour completedTours={[]} enabled={false} tourId="dashboard" />
		);
		await settle();
		expect(startTour).not.toHaveBeenCalled();

		rerender(<CheckTour completedTours={[]} enabled tourId="dashboard" />);
		await waitFor(() => expect(startTour).toHaveBeenCalledWith("dashboard"));
		expect(startTour).toHaveBeenCalledTimes(1);
	});

	it("does not start on a window narrower than minWidth", async () => {
		window.innerWidth = 600;
		render(
			<CheckTour completedTours={[]} minWidth={1024} tourId="dashboard" />
		);
		await settle();
		expect(startTour).not.toHaveBeenCalled();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("does not mark complete on a narrow window even if the tour is shown and hidden by another route", async () => {
		window.innerWidth = 600;
		render(
			<CheckTour completedTours={[]} minWidth={1024} tourId="dashboard" />
		);
		await settle();
		show("dashboard", true);
		show("dashboard", false);
		await settle();
		expect(startTour).not.toHaveBeenCalled();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("starts when the window is at least minWidth", async () => {
		window.innerWidth = 1024;
		render(
			<CheckTour completedTours={[]} minWidth={1024} tourId="dashboard" />
		);
		await waitFor(() => expect(startTour).toHaveBeenCalledWith("dashboard"));
	});

	it("marks complete exactly once after the tour is shown and then hidden", async () => {
		render(<CheckTour completedTours={[]} tourId="demo-case" />);
		await waitFor(() => expect(startTour).toHaveBeenCalled());
		expect(markTourCompleted).not.toHaveBeenCalled();

		show("demo-case", true);
		expect(markTourCompleted).not.toHaveBeenCalled();
		show("demo-case", false);
		await waitFor(() => expect(markTourCompleted).toHaveBeenCalledTimes(1));
		expect(markTourCompleted).toHaveBeenCalledWith("demo-case");

		show("demo-case", true);
		show("demo-case", false);
		await settle();
		expect(markTourCompleted).toHaveBeenCalledTimes(1);
	});

	it("does not mark complete when the tour was never shown", async () => {
		render(<CheckTour completedTours={[]} tourId="demo-case" />);
		await waitFor(() => expect(startTour).toHaveBeenCalled());
		show(null, false);
		await settle();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("does not mark this tour when a different tour is shown and hidden", async () => {
		render(<CheckTour completedTours={[]} tourId="case-canvas" />);
		await waitFor(() => expect(startTour).toHaveBeenCalled());
		show("dashboard", true);
		show("dashboard", false);
		await settle();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("consults the server when completedTours is omitted and does not start if listed", async () => {
		fetchCompletedTours.mockResolvedValue(["case-canvas"]);
		render(<CheckTour tourId="case-canvas" />);
		await waitFor(() => expect(fetchCompletedTours).toHaveBeenCalled());
		await settle();
		expect(startTour).not.toHaveBeenCalled();
	});

	it("starts after the server lookup when the id is not listed", async () => {
		fetchCompletedTours.mockResolvedValue(["dashboard"]);
		render(<CheckTour tourId="case-canvas" />);
		await waitFor(() => expect(startTour).toHaveBeenCalledWith("case-canvas"));
	});

	it("does not start when the server lookup fails", async () => {
		fetchCompletedTours.mockRejectedValue(new Error("down"));
		render(<CheckTour tourId="case-canvas" />);
		await settle();
		expect(startTour).not.toHaveBeenCalled();
	});
});
