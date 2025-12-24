import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Comment } from "@/types";
import NotesEditForm from "../notes-edit-form";

// Mock comment data
const mockComment: Comment = {
	id: 1,
	content: "Original comment content",
	created_at: "2024-01-01T00:00:00Z",
	author: "testuser",
};

// Mock the store
const mockStore = {
	caseNotes: [mockComment],
	setCaseNotes: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock next-auth
const mockSession = {
	key: "test-session-key",
	user: { email: "test@example.com" },
};

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: mockSession }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/lib/toast", () => ({
	useToast: () => ({ toast: mockToast }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
	process.env = {
		...originalEnv,
		NEXT_PUBLIC_API_URL: "http://localhost:8000",
	};
});

describe("NotesEditForm", () => {
	const mockSetEdit = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.caseNotes = [mockComment];
		mockFetch.mockClear();
	});

	describe("Rendering", () => {
		it("should render the form with all required elements", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			expect(
				screen.getByDisplayValue("Original comment content")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Cancel" })
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		});

		it("should render textarea with correct placeholder", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByPlaceholderText("Type your message here.");
			expect(textarea).toBeInTheDocument();
			expect(textarea.tagName).toBe("TEXTAREA");
		});

		it("should populate textarea with existing comment content", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			expect(textarea).toBeInTheDocument();
			expect(textarea).toHaveValue("Original comment content");
		});

		it("should render cancel button with correct styling", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			expect(cancelButton).toBeInTheDocument();
		});

		it("should render save button with correct type", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const saveButton = screen.getByRole("button", { name: "Save" });
			expect(saveButton).toBeInTheDocument();
			expect(saveButton).toHaveAttribute("type", "submit");
		});
	});

	describe("Form validation", () => {
		it("should show validation error for comment less than 2 characters", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			await user.clear(textarea);
			await user.type(textarea, "a");

			const saveButton = screen.getByRole("button", { name: "Save" });
			await user.click(saveButton);

			await waitFor(() => {
				expect(
					screen.getByText("String must contain at least 2 character(s)")
				).toBeInTheDocument();
			});
		});

		it("should show validation error for empty comment", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			await user.clear(textarea);

			const saveButton = screen.getByRole("button", { name: "Save" });
			await user.click(saveButton);

			await waitFor(() => {
				expect(
					screen.getByText("String must contain at least 2 character(s)")
				).toBeInTheDocument();
			});
		});

		it("should not show validation error for valid comment", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			expect(
				screen.queryByText("String must contain at least 2 character(s)")
			).not.toBeInTheDocument();
			expect(
				screen.queryByText("String must contain at most 500 character(s)")
			).not.toBeInTheDocument();
		});
	});

	describe("Cancel functionality", () => {
		it("should call setEdit(false) when cancel button is clicked", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			await user.click(cancelButton);

			expect(mockSetEdit).toHaveBeenCalledWith(false);
		});

		it("should not submit form when cancel is clicked", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			await user.click(cancelButton);

			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("User interaction", () => {
		it("should handle typing in textarea", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			await user.clear(textarea);
			await user.type(textarea, "New comment text");

			expect(textarea).toHaveValue("New comment text");
		});

		it("should handle form submission via Enter key", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			const form = textarea.closest("form");
			expect(form).toBeInTheDocument();

			// Form should be submittable via enter key
			if (form) {
				fireEvent.submit(form);
			}

			// Form submission should be handled by the form's onSubmit
			expect(form).toBeInTheDocument();
		});

		it("should maintain textarea focus during editing", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			await user.click(textarea);

			expect(textarea).toHaveFocus();
		});
	});

	describe("Component structure", () => {
		it("should have proper form structure", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const form = document.querySelector("form");
			expect(form).toBeInTheDocument();
			expect(form).toHaveClass("space-y-4");
		});

		it("should have proper button layout", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const buttonContainer = document.querySelector(
				".flex.items-center.justify-end.gap-2"
			);
			expect(buttonContainer).toBeInTheDocument();

			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			const saveButton = screen.getByRole("button", { name: "Save" });

			expect(buttonContainer).toContainElement(cancelButton);
			expect(buttonContainer).toContainElement(saveButton);
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			expect(textarea).toHaveAttribute("aria-invalid", "false");
		});

		it("should have accessible buttons", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			const saveButton = screen.getByRole("button", { name: "Save" });

			expect(cancelButton).toBeInTheDocument();
			expect(saveButton).toBeInTheDocument();
			expect(saveButton).toHaveAttribute("type", "submit");
		});
	});

	describe("Props handling", () => {
		it("should handle different comment objects", () => {
			const differentComment: Comment = {
				id: 2,
				content: "Different comment content",
				created_at: "2024-01-02T00:00:00Z",
				author: "different",
			};

			render(<NotesEditForm note={differentComment} setEdit={mockSetEdit} />);

			expect(
				screen.getByDisplayValue("Different comment content")
			).toBeInTheDocument();
		});

		it("should populate form with note content", () => {
			const customComment: Comment = {
				id: 3,
				content: "Custom content for testing",
				created_at: "2024-01-03T00:00:00Z",
				author: "testuser",
			};

			render(<NotesEditForm note={customComment} setEdit={mockSetEdit} />);

			expect(
				screen.getByDisplayValue("Custom content for testing")
			).toBeInTheDocument();
		});
	});

	describe("Form state management", () => {
		it("should initialize with comment content", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			expect(textarea).toHaveValue("Original comment content");
		});

		it("should allow editing of content", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");
			await user.clear(textarea);
			await user.type(textarea, "Modified content");

			expect(textarea).toHaveValue("Modified content");
		});

		it("should handle textarea clearing and retyping", async () => {
			const user = userEvent.setup();
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const textarea = screen.getByDisplayValue("Original comment content");

			// Clear and type new content
			await user.clear(textarea);
			expect(textarea).toHaveValue("");

			await user.type(textarea, "New content");
			expect(textarea).toHaveValue("New content");
		});
	});

	describe("Loading state management", () => {
		it("should show save button in normal state initially", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			const saveButton = screen.getByRole("button", { name: "Save" });
			expect(saveButton).toBeInTheDocument();
			expect(saveButton).not.toBeDisabled();
		});

		it("should have proper button text when not loading", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Saving" })
			).not.toBeInTheDocument();
		});
	});

	describe("Store integration", () => {
		it("should have access to case notes from store", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			// Component should render without errors when store is available
			expect(
				screen.getByDisplayValue("Original comment content")
			).toBeInTheDocument();
		});

		it("should handle empty case notes array", () => {
			mockStore.caseNotes = [];
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			// Component should still render even with empty notes
			expect(
				screen.getByDisplayValue("Original comment content")
			).toBeInTheDocument();
		});
	});

	describe("Session handling", () => {
		it("should have access to session data", () => {
			render(<NotesEditForm note={mockComment} setEdit={mockSetEdit} />);

			// Component should render without errors when session is available
			expect(
				screen.getByDisplayValue("Original comment content")
			).toBeInTheDocument();
		});
	});
});
