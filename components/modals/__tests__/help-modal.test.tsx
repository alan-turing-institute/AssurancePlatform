import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AUTHORITATIVE_ELEMENT_TYPE_IDS,
	ELEMENT_GUIDE,
} from "@/lib/help/help-guide";
import useStore from "@/store/store";

const onCloseSpy = vi.fn();

vi.mock("@/hooks/modal-hooks", async () => {
	const actual = await vi.importActual<typeof import("@/hooks/modal-hooks")>(
		"@/hooks/modal-hooks"
	);
	return {
		...actual,
		useHelpModal: () => ({
			isOpen: true,
			onClose: onCloseSpy,
			onOpen: vi.fn(),
		}),
	};
});

const READ_MORE_LINK_NAME = /read more in the docs/i;

const startNextStepSpy = vi.fn();

vi.mock("nextstepjs", () => ({
	useNextStep: () => ({ startNextStep: startNextStepSpy }),
}));

// Import after the mocks above so the module under test picks them up.
const { HelpModal } = await import("../help-modal");

function resetStore(): void {
	useStore.setState({ assuranceCase: null });
}

describe("HelpModal", () => {
	beforeEach(() => {
		resetStore();
		onCloseSpy.mockClear();
		startNextStepSpy.mockClear();
	});

	it("opens from the hook and renders the sheet title", () => {
		render(<HelpModal />);

		expect(
			screen.getByRole("heading", { level: 2, name: "Help" })
		).toBeInTheDocument();
	});

	it("has one ELEMENT_GUIDE entry per authoritative element type, and no extras", () => {
		const guideIds = new Set(ELEMENT_GUIDE.map((entry) => entry.id));
		const authoritativeIds = new Set(AUTHORITATIVE_ELEMENT_TYPE_IDS);

		expect(guideIds).toEqual(authoritativeIds);
	});

	it("narrows to matching items and shows a no-match line", async () => {
		const user = userEvent.setup();
		render(<HelpModal />);

		const search = screen.getByLabelText("Search help");
		await user.type(search, "focus");

		expect(screen.getByRole("button", { name: "Focus" })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Goal" })
		).not.toBeInTheDocument();

		await user.clear(search);
		await user.type(search, "zzzznomatch");

		expect(screen.getByText("No matches.")).toBeInTheDocument();
	});

	it("renders docs links with the expected hrefs", async () => {
		const user = userEvent.setup();
		render(<HelpModal />);

		await user.click(screen.getByRole("button", { name: "Goal" }));
		const goalLink = screen.getByRole("link", {
			name: READ_MORE_LINK_NAME,
		});

		expect(goalLink).toHaveAttribute(
			"href",
			"/docs/curriculum/quick-reference/02-element-types#goal-claims"
		);
	});

	it("restarts the tour (picking the demo tour for demo cases) and closes the sheet", async () => {
		const user = userEvent.setup();
		useStore.setState({
			assuranceCase: { id: "1", isDemo: true } as never,
		});
		render(<HelpModal />);

		await user.click(screen.getByRole("button", { name: "Restart the tour" }));

		expect(onCloseSpy).toHaveBeenCalledTimes(1);
		expect(startNextStepSpy).toHaveBeenCalledWith("demo-case");
	});
});
