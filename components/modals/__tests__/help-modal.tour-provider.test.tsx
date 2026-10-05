import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Wiring coverage for the Help modal and the tour provider. The modal starts
// a tour through the `useTourControls` store, so it needs no tour-library
// context of its own and renders wherever `ModalProvider` is mounted, with or
// without `TourProvider` above it. `help-modal.test.tsx` fills the store with a
// spy; this file leaves `nextstepjs` unmocked and un-mocks the real
// `ModalProvider` (globally stubbed to `() => null` in
// `src/__tests__/setup/framework-mocks.tsx` to keep other tests light), so the
// assertions below exercise the actual provider wiring.
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

	it("renders the sheet when ModalProvider is a sibling of TourProvider", async () => {
		render(
			<>
				<TourProvider>{null}</TourProvider>
				<ModalProvider />
			</>
		);

		expect(
			await screen.findByRole(
				"heading",
				{ level: 2, name: "Help" },
				{ timeout: 3000 }
			)
		).toBeInTheDocument();
	});

	it("renders with no NextStepProvider ancestor", () => {
		render(<HelpModal />);

		expect(
			screen.getByRole("heading", { level: 2, name: "Help" })
		).toBeInTheDocument();
	});
});
