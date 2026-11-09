import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import useStore from "@/store/store";
import CommentsFeed from "../comments-feed";

// The shared next-auth mock signs everyone in as "Test User".
const SIGNED_IN_AUTHOR = "Test User";

const node = { type: "goal", data: { id: 1 } };

const comments: CommentResponse[] = [
	{
		id: "own",
		author: SIGNED_IN_AUTHOR,
		content: "Own comment",
		createdAt: "2026-01-02T00:00:00.000Z",
		replies: [
			{
				id: "own-reply",
				author: SIGNED_IN_AUTHOR,
				content: "Own reply",
				createdAt: "2026-01-03T00:00:00.000Z",
				parentId: "own",
			},
		],
	},
	{
		id: "other",
		author: "Someone Else",
		content: "Other comment",
		createdAt: "2026-01-01T00:00:00.000Z",
		replies: [],
	},
];

function renderFeedWithPermission(permissions: string): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		},
		nodeComments: comments,
	});
	render(<CommentsFeed node={node} />);
}

function cardFor(content: string): HTMLElement {
	const card = screen.getByText(content).closest<HTMLElement>(".group");
	if (!card) {
		throw new Error(`No comment card found for "${content}"`);
	}
	return card;
}

describe("CommentsFeed — who can resolve a thread", () => {
	beforeEach(() => {
		useStore.setState({ nodeComments: [] });
	});

	it("offers Resolve to a commenter on their own comment only", () => {
		renderFeedWithPermission("comment");

		expect(
			within(cardFor("Own comment")).getByTitle("Resolve")
		).toBeInTheDocument();
		expect(
			within(cardFor("Other comment")).queryByTitle("Resolve")
		).not.toBeInTheDocument();
		// The commenter's own reply is not a thread, so it has no Resolve either.
		expect(screen.getAllByTitle("Resolve")).toHaveLength(1);
	});

	it.each([
		"edit",
		"manage",
	])("offers Resolve on every top-level comment to someone with %s access", (permissions) => {
		renderFeedWithPermission(permissions);

		expect(
			within(cardFor("Own comment")).getByTitle("Resolve")
		).toBeInTheDocument();
		expect(
			within(cardFor("Other comment")).getByTitle("Resolve")
		).toBeInTheDocument();
		expect(screen.getAllByTitle("Resolve")).toHaveLength(2);
	});

	it("leaves a commenter's Reply, Edit and Delete as they were", () => {
		renderFeedWithPermission("comment");

		const own = within(cardFor("Own comment"));
		expect(own.getByTitle("Reply")).toBeInTheDocument();
		expect(own.getByTitle("Edit")).toBeInTheDocument();
		expect(own.getByTitle("Delete")).toBeInTheDocument();

		const other = within(cardFor("Other comment"));
		expect(other.getByTitle("Reply")).toBeInTheDocument();
		expect(other.queryByTitle("Edit")).not.toBeInTheDocument();
		expect(other.queryByTitle("Delete")).not.toBeInTheDocument();
	});

	it("offers no comment actions to someone with view access", () => {
		renderFeedWithPermission("view");

		expect(screen.queryByTitle("Resolve")).not.toBeInTheDocument();
		expect(screen.queryByTitle("Reply")).not.toBeInTheDocument();
	});
});
