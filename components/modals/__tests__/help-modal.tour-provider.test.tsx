import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Regression coverage for the "Something went wrong" crash that hit every
// route (fixed by nesting `<ModalProvider />` inside `<TourProvider>` in
// `app/layout.tsx`, and by wrapping `<HelpModal />` in an `ErrorBoundary`
// inside `providers/modal-provider.tsx`). `help-modal.test.tsx` mocks
// `nextstepjs` outright, which is why it never caught this: `HelpModal`
// calls the real `useNextStep()` hook, and that hook throws unless a real
// `NextStepProvider` (supplied by `TourProvider`) is an ancestor. This file
// deliberately leaves `nextstepjs` unmocked, and un-mocks the real
// `ModalProvider` (globally stubbed to `() => null` in
// `src/__tests__/setup/framework-mocks.tsx` to keep other tests light), so
// the assertions below exercise the actual provider wiring.
vi.unmock("@/providers/modal-provider");
vi.mock("@/hooks/modal-hooks", async () => {
	const actual = await vi.importActual<typeof import("@/hooks/modal-hooks")>(
		"@/hooks/modal-hooks"
	);
	return {
		...actual,
		useHelpModal: () => ({
			isOpen: true,
			onClose: vi.fn(),
			onOpen: vi.fn(),
		}),
	};
});

const { ModalProvider } = await import("@/providers/modal-provider");
const { TourProvider } = await import("@/providers/tour-provider");
const { HelpModal } = await import("../help-modal");

const SOMETHING_WENT_WRONG_PATTERN = /something went wrong/i;

describe("HelpModal provider wiring (nextstepjs unmocked)", () => {
	it("renders the sheet when ModalProvider is nested inside TourProvider, matching app/layout.tsx's current wiring", async () => {
		render(
			<TourProvider>
				<ModalProvider />
			</TourProvider>
		);

		expect(
			await screen.findByRole(
				"heading",
				{ level: 2, name: "Help" },
				{ timeout: 3000 }
			)
		).toBeInTheDocument();
	});

	it("contains the failure to the Help modal, instead of crashing the whole tree, when ModalProvider is a sibling of TourProvider — the pre-fix app/layout.tsx wiring", async () => {
		render(
			<>
				<TourProvider>{null}</TourProvider>
				<ModalProvider />
			</>
		);

		expect(
			await screen.findByText(
				SOMETHING_WENT_WRONG_PATTERN,
				{},
				{ timeout: 3000 }
			)
		).toBeInTheDocument();
	});

	it("throws when HelpModal is rendered without any NextStepProvider ancestor, proving the assertions above exercise the real hook", () => {
		expect(() => render(<HelpModal />)).toThrow(
			"useNextStep must be used within a NextStepProvider"
		);
	});
});
