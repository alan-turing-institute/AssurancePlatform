import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetTourControls,
	useTourControls,
} from "@/lib/tours/tour-controls.ts";
import useStore from "@/store/store.ts";

const onClose = vi.fn();

vi.mock("@/hooks/modal-hooks", async () => {
	const actual = await vi.importActual<typeof import("@/hooks/modal-hooks")>(
		"@/hooks/modal-hooks"
	);
	return {
		...actual,
		useHelpModal: () => ({ isOpen: true, onClose, onOpen: vi.fn() }),
	};
});

const { HelpModal } = await import("../help-modal.tsx");

const startTour = vi.fn();
const RESTART = /restart the tour/i;

describe("HelpModal tour restart (adversarial)", () => {
	beforeEach(() => {
		onClose.mockClear();
		startTour.mockClear();
		resetTourControls();
		useTourControls.setState({ startTour });
		useStore.setState({ assuranceCase: null });
	});

	it("renders with no tour-library provider above it", () => {
		expect(() => render(<HelpModal />)).not.toThrow();
		expect(screen.getByRole("button", { name: RESTART })).toBeInTheDocument();
	});

	it("restarts the demo-case tour for a demo case and closes the sheet", async () => {
		useStore.setState({ assuranceCase: { id: 1, isDemo: true } as never });
		render(<HelpModal />);
		await userEvent.click(screen.getByRole("button", { name: RESTART }));
		expect(startTour).toHaveBeenCalledTimes(1);
		expect(startTour).toHaveBeenCalledWith("demo-case");
		expect(onClose).toHaveBeenCalled();
	});

	it("restarts the case-canvas tour for a non-demo case", async () => {
		useStore.setState({ assuranceCase: { id: 2, isDemo: false } as never });
		render(<HelpModal />);
		await userEvent.click(screen.getByRole("button", { name: RESTART }));
		expect(startTour).toHaveBeenCalledWith("case-canvas");
	});

	it("falls back to case-canvas when no case is loaded", async () => {
		render(<HelpModal />);
		await userEvent.click(screen.getByRole("button", { name: RESTART }));
		expect(startTour).toHaveBeenCalledWith("case-canvas");
	});
});
