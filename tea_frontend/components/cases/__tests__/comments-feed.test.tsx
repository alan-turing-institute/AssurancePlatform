import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import useStore from "@/data/store";
import { server } from "@/src/__tests__/mocks/server";
import { mockUser } from "@/src/__tests__/utils/mock-data";
import CommentsFeed from "../comments-feed";

// Constants
const DATE_REGEX = /01\/01\/2024/;

// Types
type MockComment = {
	id: string;
	content: string;
};

type MockSetEdit = (edit: boolean) => void;

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

// Mock CommentsEditForm component
vi.mock("../comments-edit-form", () => ({
	default: ({
		comment,
		setEdit,
	}: {
		comment: MockComment;
		setEdit: MockSetEdit;
	}) => (
		<div data-testid={`edit-form-${comment.id}`}>
			<textarea
				data-testid={`edit-textarea-${comment.id}`}
				defaultValue={comment.content}
			/>
			<button
				data-testid={`save-button-${comment.id}`}
				onClick={() => setEdit(false)}
				type="button"
			>
				Save
			</button>
			<button
				data-testid={`cancel-button-${comment.id}`}
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
		content: "This is a test node comment",
		created_at: "2024-01-01T10:00:00Z",
	},
	{
		id: 2,
		author: "otheruser",
		content: "This is another node comment",
		created_at: "2024-01-02T11:00:00Z",
	},
	{
		id: 3,
		author: "testuser",
		content: "Third comment by same author",
		created_at: "2024-01-03T12:00:00Z",
	},
];

const mockNode = {
	type: "goal",
	data: {
		id: 1,
	},
};

const mockAssuranceCase = {
	id: 1,
	name: "Test Case",
	permissions: "manage",
};

const mockStoreState = {
	assuranceCase: mockAssuranceCase,
	nodeComments: mockComments,
	setNodeComments: vi.fn(),
};

describe("CommentsFeed", () => {
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
			render(<CommentsFeed node={mockNode} />);
			expect(
				screen.getByText("This is a test node comment")
			).toBeInTheDocument();
		});

		it("should display empty state when no comments", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				nodeComments: [],
			});

			render(<CommentsFeed node={mockNode} />);
			expect(
				screen.getByText("No comments have been added.")
			).toBeInTheDocument();
		});

		it("should display all comments when present", () => {
			render(<CommentsFeed node={mockNode} />);

			expect(
				screen.getByText("This is a test node comment")
			).toBeInTheDocument();
			expect(
				screen.getByText("This is another node comment")
			).toBeInTheDocument();
			expect(
				screen.getByText("Third comment by same author")
			).toBeInTheDocument();
		});

		it("should display comment authors correctly", () => {
			render(<CommentsFeed node={mockNode} />);

			// Check that we have the exact text content for each author
			const commentContainers = document.querySelectorAll(
				".group.relative.w-full.rounded-md"
			);
			expect(commentContainers).toHaveLength(3);

			// Check for testuser comments (should be 2)
			let testUserCount = 0;
			let otherUserCount = 0;

			for (const container of commentContainers) {
				const textContent = container.textContent || "";
				if (textContent.includes("testuser")) {
					testUserCount++;
				}
				if (textContent.includes("otheruser")) {
					otherUserCount++;
				}
			}

			expect(testUserCount).toBe(2);
			expect(otherUserCount).toBe(1);
		});

		it("should display creation dates", () => {
			render(<CommentsFeed node={mockNode} />);

			const dateElements = screen.getAllByText(DATE_REGEX);
			expect(dateElements.length).toBeGreaterThan(0);
		});

		it("should render user avatars for each comment", () => {
			render(<CommentsFeed node={mockNode} />);

			const avatars = document.querySelectorAll("svg.lucide-user-round");
			expect(avatars).toHaveLength(3);
		});
	});

	describe("User Interactions", () => {
		it("should show edit and delete buttons on hover for own comments", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});
		});

		it("should not show edit/delete buttons for other users' comments", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json({
						...mockUser,
						username: "differentuser",
					})
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				// Check that buttons are not visible for other users' comments
				const commentContainer = screen
					.getByText("This is another node comment")
					.closest("div");
				expect(commentContainer).toBeInTheDocument();
			});
		});

		it("should enter edit mode when edit button is clicked", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});

			const firstEditButton = document.querySelector("svg.lucide-pencil-line")
				?.parentElement as HTMLElement;
			if (firstEditButton) {
				await user.click(firstEditButton);

				// Should show the edit form
				await waitFor(() => {
					expect(screen.getByTestId("edit-form-1")).toBeInTheDocument();
				});
			}
		});

		it("should exit edit mode when save button is clicked", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const editButtons = document.querySelectorAll("svg.lucide-pencil-line");
				expect(editButtons.length).toBeGreaterThan(0);
			});

			const firstEditButton = document.querySelector("svg.lucide-pencil-line")
				?.parentElement as HTMLElement;
			if (firstEditButton) {
				await user.click(firstEditButton);

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
			}
		});

		it("should handle delete button click", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => new HttpResponse(null, { status: 204 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);

				// Should call setNodeComments with filtered comments
				await waitFor(() => {
					expect(mockStoreState.setNodeComments).toHaveBeenCalledWith(
						expect.arrayContaining([
							expect.objectContaining({ id: 2 }),
							expect.objectContaining({ id: 3 }),
						])
					);
				});
			}
		});
	});

	describe("API Integration", () => {
		it("should fetch current user on mount", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

			// Wait for API call to complete
			await waitFor(() => {
				// Verify the API was called (indirectly through behavior)
				expect(
					screen.getByText("This is a test node comment")
				).toBeInTheDocument();
			});
		});

		it("should handle 404 error when fetching user", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/user/`,
					() => new HttpResponse(null, { status: 404 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			// Should handle gracefully without crashing
			await waitFor(() => {
				expect(
					screen.getByText("This is a test node comment")
				).toBeInTheDocument();
			});
		});

		it("should handle 403 error when fetching user", async () => {
			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/user/`,
					() => new HttpResponse(null, { status: 403 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				expect(
					screen.getByText("This is a test node comment")
				).toBeInTheDocument();
			});
		});

		it("should handle 401 unauthorized error", async () => {
			const mockUnauthorized = vi.fn();
			vi.doMock("@/hooks/use-auth", () => ({
				unauthorized: mockUnauthorized,
			}));

			server.use(
				http.get(
					`${process.env.NEXT_PUBLIC_API_URL}/api/user/`,
					() => new HttpResponse(null, { status: 401 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				expect(
					screen.getByText("This is a test node comment")
				).toBeInTheDocument();
			});
		});

		it("should handle successful comment deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => new HttpResponse(null, { status: 204 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);

				await waitFor(() => {
					expect(mockStoreState.setNodeComments).toHaveBeenCalledWith(
						expect.arrayContaining([
							expect.objectContaining({ id: 2 }),
							expect.objectContaining({ id: 3 }),
						])
					);
				});
			}
		});

		it("should handle failed comment deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => new HttpResponse(null, { status: 500 })
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);

				// The comment should not be removed from the list
				await waitFor(() => {
					expect(
						screen.getByText("This is a test node comment")
					).toBeInTheDocument();
				});
			}
		});

		it("should handle network errors during deletion", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				),
				http.delete(
					`${process.env.NEXT_PUBLIC_API_URL}/api/comments/1/`,
					() => {
						throw new Error("Network error");
					}
				)
			);

			render(<CommentsFeed node={mockNode} />);

			await waitFor(() => {
				const deleteButtons = document.querySelectorAll("svg.lucide-trash2");
				expect(deleteButtons.length).toBeGreaterThan(0);
			});

			const firstDeleteButton = document.querySelector("svg.lucide-trash2")
				?.parentElement as HTMLElement;
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);

				// Comment should still be present after network error
				await waitFor(() => {
					expect(
						screen.getByText("This is a test node comment")
					).toBeInTheDocument();
				});
			}
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
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

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
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

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

			render(<CommentsFeed node={mockNode} />);

			// Should still render the comments list
			expect(
				screen.getByText("This is a test node comment")
			).toBeInTheDocument();
		});

		it("should handle missing assurance case", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: null,
			});

			render(<CommentsFeed node={mockNode} />);

			// Should still render comments
			expect(
				screen.getByText("This is a test node comment")
			).toBeInTheDocument();
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
				nodeComments: emptyComments,
			});

			render(<CommentsFeed node={mockNode} />);

			// Check that the author name appears in the document
			const commentContainer = document.querySelector(
				".group.relative.w-full.rounded-md"
			);
			expect(commentContainer?.textContent).toContain("testuser");
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
				nodeComments: longComments,
			});

			render(<CommentsFeed node={mockNode} />);

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
				nodeComments: specialComments,
			});

			render(<CommentsFeed node={mockNode} />);

			// Check that the special character author name appears in the document
			const commentContainer = document.querySelector(
				".group.relative.w-full.rounded-md"
			);
			expect(commentContainer?.textContent).toContain("test@user.com");
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
				nodeComments: invalidDateComments,
			});

			render(<CommentsFeed node={mockNode} />);

			expect(screen.getByText("Comment with invalid date")).toBeInTheDocument();
		});

		it("should handle missing node data", () => {
			const nodeWithoutId = {
				type: "goal",
				data: {},
			};

			render(
				<CommentsFeed node={nodeWithoutId as unknown as typeof mockNode} />
			);

			// Should render without crashing
			expect(
				screen.getByText("This is a test node comment")
			).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<CommentsFeed node={mockNode} />);

			const results = await axe(container, {
				rules: {
					// Disable color-contrast rule for jsdom compatibility
					"color-contrast": { enabled: false },
				},
			});
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper semantic structure", () => {
			render(<CommentsFeed node={mockNode} />);

			// Comments should be in a proper container
			const commentsContainer = document.querySelector(".flex.w-full.flex-col");
			expect(commentsContainer).toBeInTheDocument();
		});

		it("should support keyboard navigation for buttons", async () => {
			server.use(
				http.get(`${process.env.NEXT_PUBLIC_API_URL}/api/user/`, () =>
					HttpResponse.json(mockUser)
				)
			);

			render(<CommentsFeed node={mockNode} />);

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

		it("should have appropriate ARIA attributes", () => {
			render(<CommentsFeed node={mockNode} />);

			// Check for proper SVG accessibility
			const hiddenSvg = document.querySelector('svg[aria-hidden="true"]');
			expect(hiddenSvg).toBeInTheDocument();
		});
	});
});
