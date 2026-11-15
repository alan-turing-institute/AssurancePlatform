import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentResponse } from "@/lib/services/comment-service";
import useStore from "@/store/store";
import NotesFeed from "../notes-feed";

const sessionUser = vi.hoisted(() => ({
	current: { id: "u1", name: "Jane Doe", email: "jane@example.com" },
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: { user: sessionUser.current },
		status: "authenticated",
	}),
}));

const fetchCaseComments = vi.hoisted(() => vi.fn());
vi.mock("@/actions/cases", () => ({ fetchCaseComments }));

function note(overrides: Partial<CommentResponse>): CommentResponse {
	return {
		id: "n1",
		author: "jane",
		authorId: "u1",
		content: "A note",
		createdAt: "2026-01-02T00:00:00.000Z",
		replies: [],
		...overrides,
	};
}

async function renderNotes(
	notes: CommentResponse[],
	permissions = "comment"
): Promise<void> {
	fetchCaseComments.mockResolvedValue(notes);
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		},
		caseNotes: [],
	});
	render(<NotesFeed />);
	await screen.findByText(notes[0]?.content ?? "");
	await waitFor(() => expect(fetchCaseComments).toHaveBeenCalled());
}

describe("NotesFeed — recognising your own note after a Google or GitHub sign-in", () => {
	beforeEach(() => {
		sessionUser.current = {
			id: "u1",
			name: "Jane Doe",
			email: "jane@example.com",
		};
	});

	it("offers Edit note and Delete note on a note whose author id is the signed-in user's", async () => {
		await renderNotes([note({ author: "jane", authorId: "u1" })]);

		expect(screen.getByLabelText("Edit note")).toBeInTheDocument();
		expect(screen.getByLabelText("Delete note")).toBeInTheDocument();
	});

	it("offers neither when the author matches the display name but the id is someone else's", async () => {
		await renderNotes([note({ author: "Jane Doe", authorId: "u2" })]);

		expect(screen.queryByLabelText("Edit note")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Delete note")).not.toBeInTheDocument();
	});

	it("falls back to the name when the note has no author id", async () => {
		sessionUser.current = {
			id: "u1",
			name: "jane",
			email: "jane@example.com",
		};
		await renderNotes([note({ author: "jane", authorId: undefined })]);

		expect(screen.getByLabelText("Edit note")).toBeInTheDocument();
	});
});
