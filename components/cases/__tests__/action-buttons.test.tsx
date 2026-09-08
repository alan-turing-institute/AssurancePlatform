import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import ActionButtons from "../action-buttons";

// CaseSettingsPopover pulls in the theme-preset provider/context, which is
// unrelated to the toolbar reachability behaviour under test here — stub it
// out rather than wrapping the whole tree in that provider.
vi.mock("../case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

const onOpenSpy = vi.fn();

vi.mock("@/hooks/modal-hooks", async () => {
	const actual = await vi.importActual<typeof import("@/hooks/modal-hooks")>(
		"@/hooks/modal-hooks"
	);
	return {
		...actual,
		useExportModal: () => ({
			isOpen: false,
			onOpen: vi.fn(),
			onClose: vi.fn(),
		}),
		useHelpModal: () => ({
			isOpen: false,
			onOpen: onOpenSpy,
			onClose: vi.fn(),
		}),
	};
});

function resetStore(): void {
	useStore.setState({ caseDetailsOpen: false });
}

describe("ActionButtons toolbar — Case Information / Help reachability", () => {
	beforeEach(() => {
		resetStore();
		onOpenSpy.mockClear();
	});

	it("renders a Case Information button (ADR 0003 §2 — the repurposed ⓘ button)", () => {
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		expect(screen.getByTestId("toolbar-case-information")).toBeInTheDocument();
		expect(screen.queryByTestId("toolbar-resources")).not.toBeInTheDocument();
	});

	it("opens the case-information sheet (store flag) when the Case Information button is clicked", async () => {
		const user = userEvent.setup();
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		expect(useStore.getState().caseDetailsOpen).toBe(false);
		await user.click(screen.getByTestId("toolbar-case-information"));
		expect(useStore.getState().caseDetailsOpen).toBe(true);
	});

	it("renders a Help button that opens the (relocated) Resources content", async () => {
		const user = userEvent.setup();
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);

		const helpButton = screen.getByTestId("toolbar-help");
		expect(helpButton).toBeInTheDocument();
		await user.click(helpButton);
		expect(onOpenSpy).toHaveBeenCalledTimes(1);
	});
});
