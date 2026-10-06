import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMigrationModal } from "@/hooks/use-migration-modal";
import { resetTourControls, useTourControls } from "@/lib/tours/tour-controls";
import CheckTour from "../check-tour";

const markTourCompleted = vi.fn();
const fetchCompletedTours = vi.fn();

vi.mock("@/actions/tours", () => ({
	markTourCompleted: (id: string) => markTourCompleted(id),
	fetchCompletedTours: () => fetchCompletedTours(),
}));

const startTour = vi.fn();

function setWidth(width: number): void {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: width,
	});
}

async function flush(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

describe("CheckTour", () => {
	beforeEach(() => {
		markTourCompleted.mockReset().mockResolvedValue([]);
		fetchCompletedTours.mockReset().mockResolvedValue([]);
		startTour.mockReset();
		resetTourControls();
		useTourControls.setState({ startTour, ready: true });
		setWidth(1280);
	});

	afterEach(() => {
		resetTourControls();
	});

	it("starts a tour the user has not completed", async () => {
		render(<CheckTour completedTours={[]} tourId="dashboard" />);
		await flush();

		expect(startTour).toHaveBeenCalledWith("dashboard");
	});

	it("starts once the tour provider becomes ready, not before", async () => {
		resetTourControls();
		render(<CheckTour completedTours={[]} tourId="dashboard" />);
		await flush();
		expect(startTour).not.toHaveBeenCalled();

		act(() => useTourControls.setState({ startTour, ready: true }));
		await flush();

		expect(startTour).toHaveBeenCalledWith("dashboard");
	});

	it("does not start the tour while the migration notice is due and not yet shown", async () => {
		useMigrationModal.setState({ isOpen: false });
		render(
			<CheckTour
				completedTours={[]}
				tourId="dashboard"
				waitForMigrationNotice
			/>
		);
		await flush();

		expect(startTour).not.toHaveBeenCalled();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("starts the tour after the migration notice has opened and closed", async () => {
		useMigrationModal.setState({ isOpen: false });
		render(
			<CheckTour
				completedTours={[]}
				tourId="dashboard"
				waitForMigrationNotice
			/>
		);
		act(() => useMigrationModal.setState({ isOpen: true }));
		await flush();
		expect(startTour).not.toHaveBeenCalled();

		act(() => useMigrationModal.setState({ isOpen: false }));
		await flush();

		expect(startTour).toHaveBeenCalledWith("dashboard");
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("starts the tour at once when the migration notice is not due", async () => {
		useMigrationModal.setState({ isOpen: false });
		render(<CheckTour completedTours={[]} tourId="dashboard" />);
		await flush();

		expect(startTour).toHaveBeenCalledWith("dashboard");
	});

	it("does not start a tour the user has completed", async () => {
		render(<CheckTour completedTours={["dashboard"]} tourId="dashboard" />);
		await flush();

		expect(startTour).not.toHaveBeenCalled();
	});

	it("looks the completed tours up when none are passed in", async () => {
		fetchCompletedTours.mockResolvedValue(["case-canvas"]);
		render(<CheckTour tourId="case-canvas" />);
		await flush();

		expect(startTour).not.toHaveBeenCalled();
	});

	it("neither starts nor completes the tour on a window narrower than minWidth", async () => {
		setWidth(900);
		render(
			<CheckTour completedTours={[]} minWidth={1024} tourId="dashboard" />
		);
		await flush();

		expect(startTour).not.toHaveBeenCalled();
		expect(markTourCompleted).not.toHaveBeenCalled();
	});

	it("holds back while disabled", async () => {
		render(
			<CheckTour completedTours={[]} enabled={false} tourId="dashboard" />
		);
		await flush();

		expect(startTour).not.toHaveBeenCalled();
	});

	it("records completion once the tour has been shown and then closed", async () => {
		render(<CheckTour completedTours={[]} tourId="dashboard" />);
		await flush();
		expect(markTourCompleted).not.toHaveBeenCalled();

		act(() => {
			useTourControls.setState({
				activeTour: "dashboard",
				isTourVisible: true,
			});
		});
		expect(markTourCompleted).not.toHaveBeenCalled();

		act(() => {
			useTourControls.setState({ activeTour: null, isTourVisible: false });
		});
		await flush();

		expect(markTourCompleted).toHaveBeenCalledWith("dashboard");
	});
});
