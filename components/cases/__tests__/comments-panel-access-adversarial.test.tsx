import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import {
	ACTING_PERMISSIONS,
	PANEL_ACCESS,
	PANEL_PERMISSIONS,
} from "@/src/__tests__/utils/comment-panel-access-matrix";
import {
	type CommentApiStub,
	changePermissions,
	makeComment,
	makeResolvedComment,
	openPanel,
	resetPanelStore,
	SIGNED_IN_AS,
	SOMEONE_ELSE,
	seedCase,
	stubCommentsApi,
} from "@/src/__tests__/utils/comment-panel-ui-kit";
import CommentsSheet from "../comments-sheet";

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));

const FORM_PLACEHOLDER = "Type your comment here.";
const NO_COMMENTS = "No comments have been added.";

let api: CommentApiStub | undefined;

afterEach(() => {
	api?.restore();
	api = undefined;
	resetPanelStore();
});

async function renderPanel(
	permissions: string | string[] | null,
	existing: CommentResponse[] = []
): Promise<CommentApiStub> {
	seedCase(permissions);
	openPanel();
	api = stubCommentsApi(existing);
	render(<CommentsSheet />);
	await screen.findByText(existing[0]?.content ?? NO_COMMENTS);
	return api;
}

function cardWithText(text: string): HTMLElement {
	const card = screen.getByText(text).closest(".group");
	if (!(card instanceof HTMLElement)) {
		throw new Error(`No comment card holds "${text}"`);
	}
	return card;
}

/** The titles of the buttons offered on a comment, in page order. */
function actionsOn(comment: CommentResponse): string[] {
	return within(cardWithText(comment.content))
		.queryAllByRole("button")
		.map((button) => button.getAttribute("title") ?? "")
		.filter(Boolean);
}

function expectedActions(opts: {
	own: boolean;
	resolve: "Resolve" | "Unresolve" | null;
	topLevel: boolean;
}): string[] {
	return [
		...(opts.topLevel ? ["Reply"] : []),
		...(opts.resolve ? [opts.resolve] : []),
		...(opts.own ? ["Edit", "Delete"] : []),
	];
}

describe("comments panel — the new-comment form follows the access level", () => {
	it.each(
		PANEL_PERMISSIONS
	)("%s access: the form is shown only where the access table says", async (permissions) => {
		await renderPanel(permissions);

		const expected = PANEL_ACCESS[permissions].form ? 1 : 0;
		expect(screen.queryAllByPlaceholderText(FORM_PLACEHOLDER)).toHaveLength(
			expected
		);
		expect(
			screen.queryAllByRole("button", { name: "Add Comment" })
		).toHaveLength(expected);
	});

	it("comment access: the panel invites a new comment", async () => {
		await renderPanel("comment");

		expect(screen.getByRole("heading", { name: "New Comment" })).toBeVisible();
		expect(
			screen.getByText("Add or view comments for this element.")
		).toBeVisible();
	});

	it("view access: the panel says it is for viewing", async () => {
		await renderPanel("view");

		expect(screen.getByRole("heading", { name: "Comments" })).toBeVisible();
		expect(screen.getByText("View comments for this element.")).toBeVisible();
	});

	it("view access: every comment is readable and none carries an action", async () => {
		const reply = makeComment(3, SOMEONE_ELSE);
		const theirs = makeComment(1, SOMEONE_ELSE);
		const mine = makeComment(2, SIGNED_IN_AS, { replies: [reply] });
		await renderPanel("view", [theirs, mine]);

		for (const comment of [theirs, mine, reply]) {
			expect(screen.getByText(comment.content)).toBeVisible();
			expect(actionsOn(comment)).toEqual([]);
		}
	});

	it("access rising from view to comment brings the form in, and falling takes it out", async () => {
		await renderPanel("view");
		expect(screen.queryByPlaceholderText(FORM_PLACEHOLDER)).toBeNull();

		act(() => changePermissions("comment"));
		expect(screen.getByPlaceholderText(FORM_PLACEHOLDER)).toBeVisible();

		act(() => changePermissions("view"));
		expect(screen.queryByPlaceholderText(FORM_PLACEHOLDER)).toBeNull();
	});
});

describe("comments panel — a commenter posts a comment", () => {
	it("posts the typed text to the element's comments and shows it", async () => {
		const user = userEvent.setup();
		const stub = await renderPanel("comment");

		await user.type(
			screen.getByPlaceholderText(FORM_PLACEHOLDER),
			"A first thought"
		);
		await user.click(screen.getByRole("button", { name: "Add Comment" }));

		expect(await screen.findByText("A first thought")).toBeVisible();
		expect(stub.writes).toEqual([
			{
				method: "POST",
				url: "/api/elements/7/comments",
				body: { content: "A first thought" },
			},
		]);
		expect(screen.getByPlaceholderText(FORM_PLACEHOLDER)).toHaveValue("");
		expect(screen.queryByText(NO_COMMENTS)).toBeNull();
	});

	it("submits from the keyboard once the text is typed", async () => {
		const user = userEvent.setup();
		const stub = await renderPanel("comment");

		await user.click(screen.getByPlaceholderText(FORM_PLACEHOLDER));
		await user.keyboard("Typed without a mouse");
		await user.tab();
		expect(screen.getByRole("button", { name: "Add Comment" })).toHaveFocus();
		await user.keyboard("{Enter}");

		expect(await screen.findByText("Typed without a mouse")).toBeVisible();
		expect(stub.writes).toHaveLength(1);
	});

	it("does not post an empty comment", async () => {
		const user = userEvent.setup();
		const stub = await renderPanel("comment");

		await user.click(screen.getByRole("button", { name: "Add Comment" }));

		expect(stub.writes).toEqual([]);
	});

	it("offers the commenter Resolve on the comment they just posted", async () => {
		const user = userEvent.setup();
		await renderPanel("comment");

		await user.type(screen.getByPlaceholderText(FORM_PLACEHOLDER), "Mine now");
		await user.click(screen.getByRole("button", { name: "Add Comment" }));
		await screen.findByText("Mine now");

		expect(
			actionsOn(makeComment(99, SIGNED_IN_AS, { content: "Mine now" }))
		).toEqual(
			expectedActions({ topLevel: true, own: true, resolve: "Resolve" })
		);
	});
});

describe("comments panel — who is offered Resolve", () => {
	it.each(
		ACTING_PERMISSIONS
	)("%s access: a top-level comment by someone else gets Resolve only where the table says", async (permissions) => {
		const theirs = makeComment(1, SOMEONE_ELSE);
		await renderPanel(permissions, [theirs]);

		expect(actionsOn(theirs)).toEqual(
			expectedActions({
				topLevel: true,
				own: false,
				resolve: PANEL_ACCESS[permissions].resolveOthers ? "Resolve" : null,
			})
		);
	});

	it.each(
		ACTING_PERMISSIONS
	)("%s access: a top-level comment the viewer wrote gets Resolve only where the table says", async (permissions) => {
		const mine = makeComment(1, SIGNED_IN_AS);
		await renderPanel(permissions, [mine]);

		expect(actionsOn(mine)).toEqual(
			expectedActions({
				topLevel: true,
				own: true,
				resolve: PANEL_ACCESS[permissions].resolveOwn ? "Resolve" : null,
			})
		);
	});

	it.each(
		ACTING_PERMISSIONS
	)("%s access: no reply is ever offered Resolve, whoever wrote it", async (permissions) => {
		const nested = makeComment(4, SOMEONE_ELSE);
		const mineWithNested = makeComment(3, SIGNED_IN_AS, { replies: [nested] });
		const theirReply = makeComment(2, SOMEONE_ELSE);
		const thread = makeComment(1, SOMEONE_ELSE, {
			replies: [theirReply, mineWithNested],
		});
		await renderPanel(permissions, [thread]);

		const resolveOnThread = PANEL_ACCESS[permissions].resolveOthers;
		expect(actionsOn(thread)).toEqual(
			expectedActions({
				topLevel: true,
				own: false,
				resolve: resolveOnThread ? "Resolve" : null,
			})
		);
		expect(actionsOn(theirReply)).toEqual([]);
		expect(actionsOn(mineWithNested)).toEqual(["Edit", "Delete"]);
		expect(actionsOn(nested)).toEqual([]);
		expect(screen.queryAllByTitle("Resolve")).toHaveLength(
			resolveOnThread ? 1 : 0
		);
	});

	it("comment access: replies on a commenter's own comment do not take Resolve away from it", async () => {
		const reply = makeComment(2, SOMEONE_ELSE);
		const mine = makeComment(1, SIGNED_IN_AS, { replies: [reply] });
		await renderPanel("comment", [mine]);

		expect(actionsOn(mine)).toEqual(
			expectedActions({ topLevel: true, own: true, resolve: "Resolve" })
		);
		expect(actionsOn(reply)).toEqual([]);
	});

	it("comment access: with several top-level comments Resolve sits only on the commenter's own", async () => {
		const first = makeComment(1, SOMEONE_ELSE);
		const second = makeComment(2, SIGNED_IN_AS);
		const third = makeComment(3, SOMEONE_ELSE);
		await renderPanel("comment", [first, second, third]);

		expect(actionsOn(first)).not.toContain("Resolve");
		expect(actionsOn(second)).toContain("Resolve");
		expect(actionsOn(third)).not.toContain("Resolve");
		expect(screen.queryAllByTitle("Resolve")).toHaveLength(1);
	});

	it.each([
		"edit",
		"manage",
	] as const)("%s access: Resolve is on every top-level comment, not only the viewer's own", async (permissions) => {
		const comments = [
			makeComment(1, SOMEONE_ELSE),
			makeComment(2, SIGNED_IN_AS),
			makeComment(3, SOMEONE_ELSE),
		];
		await renderPanel(permissions, comments);

		expect(screen.queryAllByTitle("Resolve")).toHaveLength(3);
	});
});

describe("comments panel — Unresolve follows the same rule as Resolve", () => {
	it("comment access: a resolved comment the viewer wrote can be reopened", async () => {
		const mine = makeResolvedComment(1, SIGNED_IN_AS);
		await renderPanel("comment", [mine]);

		expect(actionsOn(mine)).toEqual(
			expectedActions({ topLevel: true, own: true, resolve: "Unresolve" })
		);
	});

	it("comment access: a resolved comment by someone else cannot be reopened", async () => {
		const theirs = makeResolvedComment(1, SOMEONE_ELSE);
		await renderPanel("comment", [theirs]);

		expect(actionsOn(theirs)).toEqual(
			expectedActions({ topLevel: true, own: false, resolve: null })
		);
	});

	it.each([
		"edit",
		"manage",
	] as const)("%s access: a resolved comment by someone else can be reopened", async (permissions) => {
		const theirs = makeResolvedComment(1, SOMEONE_ELSE);
		await renderPanel(permissions, [theirs]);

		expect(actionsOn(theirs)).toEqual(
			expectedActions({ topLevel: true, own: false, resolve: "Unresolve" })
		);
	});
});

describe("comments panel — resolving sends the request and flips the button", () => {
	it.each([
		["comment", SIGNED_IN_AS],
		["edit", SOMEONE_ELSE],
		["manage", SOMEONE_ELSE],
	] as const)("%s access: Resolve then Unresolve on a comment by %s", async (permissions, author) => {
		const user = userEvent.setup();
		const target = makeComment(1, author);
		const stub = await renderPanel(permissions, [target]);

		await user.click(
			within(cardWithText(target.content)).getByTitle("Resolve")
		);
		await within(cardWithText(target.content)).findByTitle("Unresolve");
		await user.click(
			within(cardWithText(target.content)).getByTitle("Unresolve")
		);
		await within(cardWithText(target.content)).findByTitle("Resolve");

		expect(stub.writes).toEqual([
			{ method: "PATCH", url: "/api/comments/c1", body: { resolved: true } },
			{ method: "PATCH", url: "/api/comments/c1", body: { resolved: false } },
		]);
	});
});

describe("comments panel — Resolve follows a change of access while the panel is open", () => {
	it("an editor dropped to comment loses Resolve on others' comments, and gets it back", async () => {
		const theirs = makeComment(1, SOMEONE_ELSE);
		await renderPanel("edit", [theirs]);
		expect(actionsOn(theirs)).toContain("Resolve");

		act(() => changePermissions("comment"));
		expect(actionsOn(theirs)).not.toContain("Resolve");

		act(() => changePermissions("manage"));
		expect(actionsOn(theirs)).toContain("Resolve");
	});
});

describe("comments panel — permission values outside the four", () => {
	it("with no case loaded, Resolve is offered on the viewer's own comment and not on anyone else's", async () => {
		const theirs = makeComment(1, SOMEONE_ELSE);
		const mine = makeComment(2, SIGNED_IN_AS);
		await renderPanel(null, [theirs, mine]);

		expect(actionsOn(theirs)).not.toContain("Resolve");
		expect(actionsOn(mine)).toContain("Resolve");
	});

	it.each([
		"admin",
		"review",
		"",
	])("an unrecognised permission %j never gives Resolve on someone else's comment", async (permissions) => {
		const theirs = makeComment(1, SOMEONE_ELSE);
		await renderPanel(permissions, [theirs]);

		expect(actionsOn(theirs)).not.toContain("Resolve");
	});
});
