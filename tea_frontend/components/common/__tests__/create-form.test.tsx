import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import CreateForm from "../create-form";

// Mock the store
const mockStore = {
	assuranceCase: {
		id: 1,
		name: "Test Case",
		goals: [],
	},
	setAssuranceCase: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock case helper functions
vi.mock("@/lib/case-helper", () => ({
	setNodeIdentifier: vi.fn().mockResolvedValue("G1"),
	createAssuranceCaseNode: vi.fn().mockResolvedValue({
		data: {
			id: 1,
			name: "G1",
			short_description: "Test goal",
		},
		error: null,
	}),
	addHiddenProp: vi.fn().mockResolvedValue({
		id: 1,
		goals: [],
	}),
}));

describe("CreateForm", () => {
	const mockOnClose = vi.fn();
	const mockSetUnresolvedChanges = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.setAssuranceCase.mockClear();
	});

	describe("Form Rendering", () => {
		it("should render form with description field", () => {
			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /create goal/i })).toBeInTheDocument();
		});

		it("should render form with proper structure", () => {
			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByRole("textbox")).toBeInTheDocument();
			expect(screen.getByPlaceholderText("Type your message here.")).toBeInTheDocument();
		});

		it("should have empty default values", () => {
			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			expect(descriptionInput).toHaveValue("");
		});
	});

	describe("Form Validation", () => {
		it("should require minimum 2 characters for description", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, "A");

			const createButton = screen.getByRole("button", { name: /create goal/i });
			await user.click(createButton);

			await waitFor(() => {
				expect(
					screen.getByText("Description must be atleast 2 characters")
				).toBeInTheDocument();
			});
		});

		it("should accept valid description input", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, "Valid test description");

			const createButton = screen.getByRole("button", { name: /create goal/i });
			await user.click(createButton);

			// Should not show validation error
			expect(
				screen.queryByText("Description must be atleast 2 characters")
			).not.toBeInTheDocument();
		});
	});

	describe("Form Submission", () => {
		it("should handle form submission successfully", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, "Test goal description");

			const createButton = screen.getByRole("button", { name: /create goal/i });
			await user.click(createButton);

			// The form should submit successfully with mocked functions
			await waitFor(() => {
				expect(mockOnClose).toHaveBeenCalled();
			});
		});

		it("should handle form submission", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, "Test goal description");

			const createButton = screen.getByRole("button", { name: /create goal/i });
			await user.click(createButton);

			await waitFor(() => {
				expect(mockOnClose).toHaveBeenCalled();
			});
		});
	});

	describe("Change Tracking", () => {
		it("should track changes to description field", async () => {
			const user = userEvent.setup();

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, "Test");

			await waitFor(() => {
				expect(mockSetUnresolvedChanges).toHaveBeenCalledWith(true);
			});
		});
	});

	describe("Form Accessibility", () => {
		it("should have proper form labels", () => {
			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			expect(descriptionInput).toBeInTheDocument();
		});

		it("should have proper button states", () => {
			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const createButton = screen.getByRole("button", { name: /create goal/i });
			expect(createButton).toBeEnabled();
			expect(createButton).toHaveClass("bg-indigo-500");
		});
	});

	describe("Edge Cases", () => {
		it("should handle very long descriptions", async () => {
			const user = userEvent.setup();
			const longDescription = "A".repeat(100);

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, longDescription);

			expect(descriptionInput).toHaveValue(longDescription);
		});

		it("should handle special characters in description", async () => {
			const user = userEvent.setup();
			const specialChars = "Test with special chars: !@#$%^&*()";

			renderWithAuth(
				<CreateForm
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(/description/i);
			await user.type(descriptionInput, specialChars);

			expect(descriptionInput).toHaveValue(specialChars);
		});
	});
});
