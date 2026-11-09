import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommentsSheet from "@/components/cases/comments-sheet";
import { PANEL_ACCESS } from "@/src/__tests__/utils/comment-panel-access-matrix";
import {
	type CommentApiStub,
	makeComment,
	resetPanelStore,
	SOMEONE_ELSE,
	seedCase,
	stubCommentsApi,
} from "@/src/__tests__/utils/comment-panel-ui-kit";
import useStore from "@/store/store";
import NodeActionGroup from "../node-action-group";
import NodeOptionsMenu from "../node-options-menu";

// Same local stand-in the options-menu tests use: this render tree calls
// `useNodes` and `useEdges`, which the shared reactflow mock does not provide.
vi.mock("reactflow", () => ({
	ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
	useNodes: () => [],
	useEdges: () => [],
}));

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));

const ELEMENT: Node = {
	id: "strategy-7",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: { id: 7, type: "strategy", name: "S1", description: "A strategy" },
};

let api: CommentApiStub | undefined;

afterEach(() => {
	api?.restore();
	api = undefined;
	resetPanelStore();
});

function renderActionGroup(onEditClick = vi.fn()) {
	return render(
		<NodeActionGroup
			addPopover={<button type="button">Add element</button>}
			node={ELEMENT}
			nodeType="strategy"
			onEditClick={onEditClick}
			showToggle={false}
		/>
	);
}

describe("element actions — a commenter sees what a viewer sees", () => {
	it.each([
		"view",
		"comment",
	])("%s access: no Add, no options menu, Edit reads View details", (permissions) => {
		seedCase(permissions);
		renderActionGroup();

		expect(screen.queryByRole("button", { name: "Add element" })).toBeNull();
		expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Edit element" })).toBeNull();
		expect(screen.getByRole("button", { name: "View details" })).toBeVisible();
	});

	it.each([
		"edit",
		"manage",
	])("%s access: Add, the options menu and Edit element are all offered", (permissions) => {
		seedCase(permissions);
		renderActionGroup();

		expect(screen.getByRole("button", { name: "Add element" })).toBeVisible();
		expect(screen.getByRole("button", { name: "More options" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Edit element" })).toBeVisible();
		expect(screen.queryByRole("button", { name: "View details" })).toBeNull();
	});

	it.each([
		"view",
		"comment",
	])("%s access: the options menu renders nothing on its own", (permissions) => {
		seedCase(permissions);
		const { container } = render(
			<NodeOptionsMenu node={ELEMENT} nodeType="strategy" />
		);

		expect(container).toBeEmptyDOMElement();
	});

	it("comment access: the comments button is there and still opens the panel for this element", async () => {
		seedCase("comment");
		renderActionGroup();

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: "View comments" }));

		expect(useStore.getState().commentsSheetOpen).toBe(true);
		expect(useStore.getState().commentsSheetNode?.id).toBe(ELEMENT.id);
	});
});

describe("element actions — from the element to the first comment", () => {
	it.each([
		["comment", PANEL_ACCESS.comment.form],
		["view", PANEL_ACCESS.view.form],
	])("%s access: opening the panel from the element shows the form: %s", async (permissions, formShown) => {
		const user = userEvent.setup();
		seedCase(permissions);
		api = stubCommentsApi([makeComment(1, SOMEONE_ELSE)]);
		render(
			<>
				<NodeActionGroup
					node={ELEMENT}
					nodeType="strategy"
					onEditClick={vi.fn()}
					showToggle={false}
				/>
				<CommentsSheet />
			</>
		);

		await user.click(screen.getByRole("button", { name: "View comments" }));
		await screen.findByText("Comment number 1");

		expect(
			screen.queryAllByPlaceholderText("Type your comment here.")
		).toHaveLength(formShown ? 1 : 0);
		expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
	});
});
