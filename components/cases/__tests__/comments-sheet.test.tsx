import { render, screen } from "@testing-library/react";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import CommentsSheet from "../comments-sheet";

// The live-update subscription is unrelated to who sees the form.
vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const node: Node = {
	id: "node-1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: { id: 1, name: "Goal 1" },
};

function openSheetWithPermission(permissions: string): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		},
		nodeComments: [],
		commentsSheetOpen: true,
		commentsSheetNode: node,
	});
	render(<CommentsSheet />);
}

describe("CommentsSheet — who sees the new-comment form", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		"comment",
		"edit",
		"manage",
	])("shows the form to someone with %s access", async (permissions) => {
		openSheetWithPermission(permissions);

		expect(
			await screen.findByRole("button", { name: "Add Comment" })
		).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Type your comment here.")
		).toBeInTheDocument();
		expect(
			screen.getByText("Add or view comments for this element.")
		).toBeInTheDocument();
	});

	it("shows comments but no form to someone with view access", async () => {
		openSheetWithPermission("view");

		expect(
			await screen.findByText("No comments have been added.")
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Add Comment" })
		).not.toBeInTheDocument();
		expect(
			screen.queryByPlaceholderText("Type your comment here.")
		).not.toBeInTheDocument();
		expect(
			screen.getByText("View comments for this element.")
		).toBeInTheDocument();
	});
});
