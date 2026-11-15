import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import useStore from "@/store/store";
import CommentsEditForm from "../comments-edit-form";
import NotesEditForm from "../notes-edit-form";

const stored: CommentResponse = {
	id: "c1",
	author: "jane",
	authorId: "u1",
	content: "Original",
	createdAt: "2026-01-02T00:00:00.000Z",
	resolved: true,
	resolvedBy: "bob",
	replies: [
		{
			id: "r1",
			author: "bob",
			authorId: "u2",
			content: "A reply",
			createdAt: "2026-01-03T00:00:00.000Z",
			parentId: "c1",
		},
	],
};

const node = { type: "goal", data: { id: 1 } };
const SAVE = /save/i;

describe("edit forms keep the stored comment's state", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					id: "c1",
					content: "Changed",
					author: "jane",
					createdAt: "2026-01-02T00:00:00.000Z",
				}),
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("keeps replies, resolved state and author id after a comment is edited", async () => {
		useStore.setState({ nodeComments: [stored] });
		render(<CommentsEditForm comment={stored} node={node} setEdit={vi.fn()} />);

		await userEvent.click(screen.getByRole("button", { name: SAVE }));

		await waitFor(() =>
			expect(useStore.getState().nodeComments[0].content).toBe("Changed")
		);
		const after = useStore.getState().nodeComments[0];
		expect(after.replies).toHaveLength(1);
		expect(after.resolved).toBe(true);
		expect(after.authorId).toBe("u1");
	});

	it("keeps the author id after a case note is edited", async () => {
		useStore.setState({ caseNotes: [stored] });
		render(<NotesEditForm note={stored} setEdit={vi.fn()} />);

		await userEvent.click(screen.getByRole("button", { name: SAVE }));

		await waitFor(() =>
			expect(useStore.getState().caseNotes[0].content).toBe("Changed")
		);
		expect(useStore.getState().caseNotes[0].authorId).toBe("u1");
	});
});
