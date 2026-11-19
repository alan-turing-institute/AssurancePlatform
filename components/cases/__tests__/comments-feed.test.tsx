import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import useStore from "@/store/store";
import CommentsFeed from "../comments-feed";

// The shared next-auth mock signs everyone in as "Test User"; this file's
// mock keeps that default and lets a test sign in as someone else.
const sessionUser = vi.hoisted(() => {
	const defaultUser = {
		id: "1",
		name: "Test User",
		email: "test@example.com",
	};
	return { defaultUser, current: defaultUser };
});

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: { user: sessionUser.current },
		status: "authenticated",
	}),
}));

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

function renderFeedWithPermission(
	permissions: string,
	feed: CommentResponse[] = comments
): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		},
		nodeComments: feed,
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

	it("offers Unresolve to a commenter on their own resolved thread only", () => {
		renderFeedWithPermission("comment", [
			{
				id: "own",
				author: SIGNED_IN_AUTHOR,
				content: "Own comment",
				createdAt: "2026-01-02T00:00:00.000Z",
				resolved: true,
				resolvedBy: SIGNED_IN_AUTHOR,
			},
			{
				id: "other",
				author: "Someone Else",
				content: "Other comment",
				createdAt: "2026-01-01T00:00:00.000Z",
				resolved: true,
				resolvedBy: "Someone Else",
			},
		]);

		expect(
			within(cardFor("Own comment")).getByTitle("Unresolve")
		).toBeInTheDocument();
		expect(
			within(cardFor("Other comment")).queryByTitle("Unresolve")
		).not.toBeInTheDocument();
	});
});

describe("CommentsFeed — recognising your own comment after a Google or GitHub sign-in", () => {
	// These sign-ins carry the provider's display name, not the stored username
	// that a comment's author field holds, so only the user id can match.
	const own: CommentResponse = {
		id: "own",
		author: "jane",
		authorId: "u1",
		content: "Jane's comment",
		createdAt: "2026-01-02T00:00:00.000Z",
		replies: [],
	};

	beforeEach(() => {
		sessionUser.current = {
			id: "u1",
			name: "Jane Doe",
			email: "jane@example.com",
		};
		useStore.setState({ nodeComments: [] });
	});

	afterEach(() => {
		sessionUser.current = sessionUser.defaultUser;
	});

	it("gives them Resolve, Edit and Delete on their own comment, and Reply only on another's", () => {
		renderFeedWithPermission("comment", [
			own,
			{
				id: "other",
				author: "bob",
				authorId: "u2",
				content: "Bob's comment",
				createdAt: "2026-01-01T00:00:00.000Z",
				replies: [],
			},
		]);

		const mine = within(cardFor("Jane's comment"));
		expect(mine.getByTitle("Resolve")).toBeInTheDocument();
		expect(mine.getByTitle("Edit")).toBeInTheDocument();
		expect(mine.getByTitle("Delete")).toBeInTheDocument();

		const theirs = within(cardFor("Bob's comment"));
		expect(theirs.getByTitle("Reply")).toBeInTheDocument();
		expect(theirs.queryByTitle("Resolve")).not.toBeInTheDocument();
		expect(theirs.queryByTitle("Edit")).not.toBeInTheDocument();
		expect(theirs.queryByTitle("Delete")).not.toBeInTheDocument();
	});

	it("does not treat a comment as theirs because its author matches their display name", () => {
		renderFeedWithPermission("comment", [
			{ ...own, author: "Jane Doe", authorId: "u2" },
		]);

		const card = within(cardFor("Jane's comment"));
		expect(card.getByTitle("Reply")).toBeInTheDocument();
		expect(card.queryByTitle("Resolve")).not.toBeInTheDocument();
		expect(card.queryByTitle("Edit")).not.toBeInTheDocument();
		expect(card.queryByTitle("Delete")).not.toBeInTheDocument();
	});

	it("falls back to the name when a comment carries no author id", () => {
		const { authorId: _omitted, ...withoutId } = own;
		renderFeedWithPermission("comment", [
			{ ...withoutId, author: "Jane Doe" },
			{
				...withoutId,
				id: "other",
				author: "bob",
				content: "Bob's comment",
			},
		]);

		const mine = within(cardFor("Jane's comment"));
		expect(mine.getByTitle("Resolve")).toBeInTheDocument();
		expect(mine.getByTitle("Edit")).toBeInTheDocument();
		expect(mine.getByTitle("Delete")).toBeInTheDocument();

		const theirs = within(cardFor("Bob's comment"));
		expect(theirs.queryByTitle("Resolve")).not.toBeInTheDocument();
		expect(theirs.queryByTitle("Edit")).not.toBeInTheDocument();
	});
});
