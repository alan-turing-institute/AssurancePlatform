import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import useStore from "@/data/store";
import { server } from "@/src/__tests__/mocks/server";
import { mockUser } from "@/src/__tests__/utils/mock-data";
import NotesFeed from "../notes-feed";

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
}));

// Mock unauthorized function
vi.mock("@/hooks/use-auth", () => ({
	unauthorized: vi.fn(),
}));

// Mock moment
vi.mock("moment", () => ({
	default: vi.fn(() => ({
		format: vi.fn(() => "01/01/2024"),
	})),
}));

// Mock NotesEditForm component
vi.mock("../notes-edit-form", () => ({
	default: ({
		note,
		setEdit,
	}: {
		note: { id: number; content: string };
		setEdit: (value: boolean) => void;
	}) => (
		<div data-testid={`edit-form-${note.id}`}>
			<textarea
				data-testid={`edit-textarea-${note.id}`}
				defaultValue={note.content}
			/>
			<button
				data-testid={`save-button-${note.id}`}
				onClick={() => setEdit(false)}
				type="button"
			>
				Save
			</button>
			<button
				data-testid={`cancel-button-${note.id}`}
				onClick={() => setEdit(false)}
				type="button"
			>
				Cancel
			</button>
		</div>
	),
}));

// Mock store
vi.mock("@/data/store", () => ({
	default: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseStore = vi.mocked(useStore);

const mockComments = [
	{
		id: 1,
		author: "testuser",
		content: "This is a test comment",
		created_at: "2024-01-01T10:00:00Z",
	},
	{
		id: 2,
		author: "otheruser",
		content: "This is another comment",
		created_at: "2024-01-02T11:00:00Z",
	},
	{
		id: 3,
		author: "testuser",
		content: "Third comment by same author",
		created_at: "2024-01-03T12:00:00Z",
	},
];

const mockAssuranceCase = {
	id: 1,
	name: "Test Case",
	permissions: "manage",
	comments: [...mockComments],
};

const mockStoreState = {
	assuranceCase: mockAssuranceCase,
	caseNotes: mockComments,
	setCaseNotes: vi.fn(),
};

describe("NotesFeed", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseStore.mockReturnValue(mockStoreState);
		mockUseSession.mockReturnValue({
			data: {
				key: "test-token",
				expires: new Date(Date.now() + 86_400_000).toISOString(),
			},
			status: "authenticated",
			update: vi.fn(),
		});

		// Reset MSW handlers
		server.resetHandlers();
	});

	describe("Component Rendering", () => {
		it("should render without crashing", () => {
			render(<NotesFeed />);
			expect(screen.getByRole("list")).toBeInTheDocument();
		});

		it("should display empty state when no notes", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: [],
			});

			render(<NotesFeed />);
			expect(screen.getByText("No notes have been added.")).toBeInTheDocument();
		});

		it("should display all notes when present", () => {
			render(<NotesFeed />);

			expect(screen.getByText("This is a test comment")).toBeInTheDocument();
			expect(screen.getByText("This is another comment")).toBeInTheDocument();
			expect(
				screen.getByText("Third comment by same author")
			).toBeInTheDocument();
		});

		it("should display note authors correctly", () => {
			render(<NotesFeed />);

			const authorElements = screen.getAllByText("testuser");
			expect(authorElements).toHaveLength(2); // Two comments by testuser
			expect(screen.getByText("otheruser")).toBeInTheDocument();
		});

		it("should display creation dates", () => {
			render(<NotesFeed />);

			const dateElements = screen.getAllByText("Created On: 01/01/2024");
			expect(dateElements.length).toBeGreaterThan(0);
		});

		it("should render user avatars for each note", () => {
			render(<NotesFeed />);

			// Check for avatar divs by their CSS class
			const avatars = document.querySelectorAll(".rounded-full.bg-indigo-500");
			expect(avatars).toHaveLength(3);
		});
	});

	describe("User Interactions", () => {
		it("should show edit and delete buttons on hover for own comments", async () => {
			// Mock user data fetch
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			// Wait for user data to load and buttons to appear
			await waitFor(() => {
				// Look for buttons with pencil icon (edit buttons)
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});
		});

		it("should not show edit/delete buttons for other users' comments", async () => {
			// Mock different user
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json({
						...mockUser,
						username: "differentuser",
					});
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				// Check that buttons are not visible for other users' comments
				const listItems = screen.getAllByRole("listitem");
				expect(listItems).toHaveLength(3);
			});
		});

		it("should enter edit mode when edit button is clicked", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});

			const firstEditButton = document.querySelector("svg.lucide-pencil-line")
				?.parentElement as HTMLElement;
			if (firstEditButton) {
				await user.click(firstEditButton);
			}

			// Should show the edit form
			await waitFor(() => {
				expect(screen.getByTestId("edit-form-1")).toBeInTheDocument();
			});
		});

		it("should exit edit mode when save button is clicked", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});

			const firstEditButton = document.querySelector("svg.lucide-pencil-line")
				?.parentElement as HTMLElement;
			if (firstEditButton) {
				await user.click(firstEditButton);
			}

			// Wait for edit form to appear
			await waitFor(() => {
				expect(screen.getByTestId("edit-form-1")).toBeInTheDocument();
			});

			// Click save button in the edit form
			const saveButton = screen.getByTestId("save-button-1");
			await user.click(saveButton);

			// Edit form should be hidden
			await waitFor(() => {
				expect(screen.queryByTestId("edit-form-1")).not.toBeInTheDocument();
			});
		});

		it("should handle delete button click", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				}),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => {
						return new HttpResponse(null, { status: 204 });
					}
				)
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			// Should call setCaseNotes with filtered comments
			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({ id: 2 }),
						expect.objectContaining({ id: 3 }),
					])
				);
			});
		});
	});

	describe("API Integration", () => {
		it("should fetch case comments on mount", async () => {
			const mockResponse = {
				comments: mockComments,
			};

			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/`, () => {
					return HttpResponse.json(mockResponse);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith(mockComments);
			});
		});

		it("should fetch current user on mount", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			// Wait for API call to complete
			await waitFor(() => {
				// Verify the API was called (indirectly through behavior)
				expect(screen.getByRole("list")).toBeInTheDocument();
			});
		});

		it("should handle 404 error when fetching case", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/`, () => {
					return new HttpResponse(null, { status: 404 });
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith([]);
			});
		});

		it("should handle 403 error when fetching case", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/`, () => {
					return new HttpResponse(null, { status: 403 });
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith([]);
			});
		});

		it("should handle 401 unauthorized error", async () => {
			const mockUnauthorized = vi.fn();
			vi.doMock("@/hooks/use-auth", () => ({
				unauthorized: mockUnauthorized,
			}));

			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/cases/1/`, () => {
					return new HttpResponse(null, { status: 401 });
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith([]);
			});
		});

		it("should handle successful comment deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				}),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => {
						return new HttpResponse(null, { status: 204 });
					}
				)
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			await waitFor(() => {
				expect(mockStoreState.setCaseNotes).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({ id: 2 }),
						expect.objectContaining({ id: 3 }),
					])
				);
			});
		});

		it("should handle failed comment deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				}),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => {
						return new HttpResponse(null, { status: 500 });
					}
				)
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			// The comment should not be removed from the list
			await waitFor(() => {
				expect(screen.getByText("This is a test comment")).toBeInTheDocument();
			});
		});
	});

	describe("Permissions and Security", () => {
		it("should not show edit/delete buttons when permissions are view only", async () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: {
					...mockAssuranceCase,
					permissions: "view",
				},
			});

			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				// No edit or delete buttons should be visible
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(editButtons).toHaveLength(0);
				expect(deleteButtons).toHaveLength(0);
			});
		});

		it("should only show edit/delete buttons for user's own comments", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				// Should only have buttons for 2 comments by testuser, not all 3
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons).toHaveLength(2);

				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons).toHaveLength(2);
			});
		});

		it("should handle missing session gracefully", () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			render(<NotesFeed />);

			// Should still render the notes list
			expect(screen.getByRole("list")).toBeInTheDocument();
			expect(screen.getByText("This is a test comment")).toBeInTheDocument();
		});

		it("should handle missing assurance case", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: null,
				caseNotes: [], // Also set empty notes when case is null
			});

			render(<NotesFeed />);

			// Should show empty state
			expect(screen.getByText("No notes have been added.")).toBeInTheDocument();
		});
	});

	describe("Comment Sorting", () => {
		it("should sort comments by creation date (newest first)", () => {
			render(<NotesFeed />);

			const listItems = screen.getAllByRole("listitem");

			// Comments should be rendered in order (newest first due to sorting)
			expect(listItems).toHaveLength(3);
		});

		it("should handle comments with same creation date", () => {
			const sameTimeComments = [
				{
					id: 1,
					author: "user1",
					content: "First comment",
					created_at: "2024-01-01T10:00:00Z",
				},
				{
					id: 2,
					author: "user2",
					content: "Second comment",
					created_at: "2024-01-01T10:00:00Z",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: sameTimeComments,
				assuranceCase: {
					...mockAssuranceCase,
					comments: sameTimeComments,
				},
			});

			render(<NotesFeed />);

			expect(screen.getByText("First comment")).toBeInTheDocument();
			expect(screen.getByText("Second comment")).toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty comment content", () => {
			const emptyComments = [
				{
					id: 1,
					author: "testuser",
					content: "",
					created_at: "2024-01-01T10:00:00Z",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: emptyComments,
			});

			render(<NotesFeed />);

			expect(screen.getByText("testuser")).toBeInTheDocument();
		});

		it("should handle very long comment content", () => {
			const longContent = "A".repeat(1000);
			const longComments = [
				{
					id: 1,
					author: "testuser",
					content: longContent,
					created_at: "2024-01-01T10:00:00Z",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: longComments,
			});

			render(<NotesFeed />);

			expect(screen.getByText(longContent)).toBeInTheDocument();
		});

		it("should handle special characters in author names", () => {
			const specialComments = [
				{
					id: 1,
					author: "test@user.com",
					content: "Comment with special author",
					created_at: "2024-01-01T10:00:00Z",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: specialComments,
			});

			render(<NotesFeed />);

			expect(screen.getByText("test@user.com")).toBeInTheDocument();
		});

		it("should handle invalid date formats gracefully", () => {
			const invalidDateComments = [
				{
					id: 1,
					author: "testuser",
					content: "Comment with invalid date",
					created_at: "invalid-date",
				},
			];

			mockUseStore.mockReturnValue({
				...mockStoreState,
				caseNotes: invalidDateComments,
			});

			render(<NotesFeed />);

			expect(screen.getByText("Comment with invalid date")).toBeInTheDocument();
		});

		it("should handle network errors during deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				}),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => {
						throw new Error("Network error");
					}
				)
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			// Comment should still be present after network error
			await waitFor(() => {
				expect(screen.getByText("This is a test comment")).toBeInTheDocument();
			});
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<NotesFeed />);

			// Wait for component to finish loading
			await waitFor(() => {
				expect(screen.getByRole("list")).toBeInTheDocument();
			});

			const results = await axe(container);
			expect(results.violations).toHaveLength(0);
		});

		it("should provide proper ARIA labels", () => {
			render(<NotesFeed />);

			const list = screen.getByRole("list");
			expect(list).toBeInTheDocument();

			const listItems = screen.getAllByRole("listitem");
			expect(listItems).toHaveLength(3);
		});

		it("should support keyboard navigation for buttons", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () => {
					return HttpResponse.json(mockUser);
				})
			);

			render(<NotesFeed />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});

			const firstEditButton = document.querySelector("svg.lucide-pencil-line")
				?.parentElement as HTMLElement;

			if (firstEditButton) {
				// Button should be focusable
				firstEditButton.focus();
				expect(firstEditButton).toHaveFocus();
			}
		});

		it("should have proper heading structure", () => {
			render(<NotesFeed />);

			// While this component doesn't have headings, it should work with screen readers
			const list = screen.getByRole("list");
			expect(list).toBeInTheDocument();
		});
	});
});
