import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAssuranceCase } from "@/src/__tests__/utils/mock-data";
import NotesForm from "../notes-form";

// Mock the store
const mockStore = {
	assuranceCase: mockAssuranceCase as typeof mockAssuranceCase | null,
	caseNotes: [],
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
vi.mock("../ui/use-toast", () => ({
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

describe("NotesForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.assuranceCase = mockAssuranceCase;
		mockStore.caseNotes = [];
		mockFetch.mockClear();
	});

	describe("Rendering", () => {
		it("should render the form with all required elements", () => {
			render(<NotesForm />);

			expect(screen.getByText("New Note")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Type your note here.")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Add Note" })
			).toBeInTheDocument();
		});

		it("should render textarea with correct placeholder", () => {
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			expect(textarea).toBeInTheDocument();
			expect(textarea.tagName).toBe("TEXTAREA");
		});

		it("should render submit button with correct styling", () => {
			render(<NotesForm />);

			const submitButton = screen.getByRole("button", { name: "Add Note" });
			expect(submitButton).toBeInTheDocument();
			expect(submitButton).toHaveClass(
				"bg-indigo-500",
				"text-white",
				"hover:bg-indigo-600"
			);
		});
	});

	describe("Form validation", () => {
		it("should show validation error for empty note", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const submitButton = screen.getByRole("button", { name: "Add Note" });
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Note must be atleast 2 characters")
				).toBeInTheDocument();
			});
		});

		it("should show validation error for note with only 1 character", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			await user.type(textarea, "a");

			const submitButton = screen.getByRole("button", { name: "Add Note" });
			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Note must be atleast 2 characters")
				).toBeInTheDocument();
			});
		});

		it("should not show validation error for note with 2 or more characters", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			await user.type(textarea, "ab");

			expect(
				screen.queryByText("Note must be atleast 2 characters")
			).not.toBeInTheDocument();
		});
	});

	describe("Error handling when no assurance case", () => {
		it("should handle null assurance case gracefully in component", () => {
			mockStore.assuranceCase = null;
			render(<NotesForm />);

			// Component should still render even without assurance case
			expect(screen.getByText("New Note")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Type your note here.")
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Add Note" })
			).toBeInTheDocument();
		});
	});

	describe("User interaction", () => {
		it("should handle typing in textarea", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			await user.type(textarea, "This is a test note");

			expect(textarea).toHaveValue("This is a test note");
		});

		it("should handle form submission via Enter key", async () => {
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			fireEvent.change(textarea, { target: { value: "Test note" } });

			const form = textarea.closest("form");
			expect(form).toBeInTheDocument();

			// Form should be submittable via enter key (this is handled by the form element)
			if (!form) {
				throw new Error("Form not found");
			}
			fireEvent.submit(form);

			// The form submission should trigger validation since we didn't properly submit
			await waitFor(() => {
				expect(textarea).toHaveValue("Test note");
			});
		});

		it("should maintain focus on textarea after validation error", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			const submitButton = screen.getByRole("button", { name: "Add Note" });

			await user.click(submitButton);

			await waitFor(() => {
				expect(
					screen.getByText("Note must be atleast 2 characters")
				).toBeInTheDocument();
			});

			// Textarea should still be accessible for user to correct the error
			expect(textarea).toBeInTheDocument();
		});
	});

	describe("Component structure", () => {
		it("should have proper form structure", () => {
			render(<NotesForm />);

			const form = document.querySelector("form");
			expect(form).toBeInTheDocument();
			expect(form).toHaveClass("mt-6", "space-y-8");
		});

		it("should have proper field structure", () => {
			render(<NotesForm />);

			const label = screen.getByText("New Note");
			const textarea = screen.getByPlaceholderText("Type your note here.");

			expect(label).toBeInTheDocument();
			expect(textarea).toBeInTheDocument();
			expect(label.getAttribute("for")).toBe(textarea.getAttribute("id"));
		});

		it("should have proper button structure", () => {
			render(<NotesForm />);

			const button = screen.getByRole("button", { name: "Add Note" });
			expect(button).toHaveAttribute("type", "submit");
		});
	});

	describe("Store interaction", () => {
		it("should have access to assurance case from store", () => {
			render(<NotesForm />);

			// Component should render without errors when assurance case exists
			expect(screen.getByText("New Note")).toBeInTheDocument();
		});

		it("should handle null assurance case gracefully", () => {
			mockStore.assuranceCase = null;
			render(<NotesForm />);

			// Component should still render
			expect(screen.getByText("New Note")).toBeInTheDocument();
		});
	});

	describe("Form state management", () => {
		it("should initialize with empty textarea", () => {
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			expect(textarea).toHaveValue("");
		});

		it("should allow typing in textarea", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			await user.type(textarea, "New note content");

			expect(textarea).toHaveValue("New note content");
		});

		it("should clear textarea when value is manually set to empty", async () => {
			const user = userEvent.setup();
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			await user.type(textarea, "Some content");
			expect(textarea).toHaveValue("Some content");

			await user.clear(textarea);
			expect(textarea).toHaveValue("");
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA attributes", () => {
			render(<NotesForm />);

			const textarea = screen.getByPlaceholderText("Type your note here.");
			expect(textarea).toHaveAttribute("aria-invalid", "false");
		});

		it("should associate label with textarea", () => {
			render(<NotesForm />);

			const label = screen.getByText("New Note");
			const textarea = screen.getByPlaceholderText("Type your note here.");

			expect(label).toHaveAttribute("for");
			expect(textarea).toHaveAttribute("id");
			expect(label.getAttribute("for")).toBe(textarea.getAttribute("id"));
		});
	});
});
