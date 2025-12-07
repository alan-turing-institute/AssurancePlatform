import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import useStore from "@/data/store";
import { updateAssuranceCase, updateAssuranceCaseNode } from "@/lib/case";
import { AssuranceCaseFactory } from "@/src/__tests__/utils/test-factories";
import NodeAttributes from "../node-attributes";

// Regex constants for testing
const ASSUMPTION_REGEX = /assumption/i;
const JUSTIFICATION_REGEX = /justification/i;

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
}));

// Mock store
vi.mock("@/data/store", () => ({
	default: vi.fn(),
}));

// Mock case helper functions
vi.mock("@/lib/case", () => ({
	updateAssuranceCaseNode: vi.fn(),
	updateAssuranceCase: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);
const mockUseStore = vi.mocked(useStore);
const mockUpdateAssuranceCaseNode = vi.mocked(updateAssuranceCaseNode);
const mockUpdateAssuranceCase = vi.mocked(updateAssuranceCase);

const mockNode = {
	id: "node-1",
	type: "strategy", // Change to strategy so justification field is shown
	position: { x: 0, y: 0 },
	data: {
		id: 1,
		assumption: "Initial assumption",
		justification: "Initial justification",
	},
};

const mockNodeWithoutData = {
	id: "node-2",
	type: "strategy",
	position: { x: 0, y: 0 },
	data: {
		id: 2,
	},
};

const mockActions = {
	setSelectedLink: vi.fn(),
	setAction: vi.fn(),
};

const mockAssuranceCase = AssuranceCaseFactory.create({
	id: 1,
	name: "Test Case",
	permissions: "manage",
});

const mockStoreState = {
	assuranceCase: mockAssuranceCase,
	setAssuranceCase: vi.fn(),
};

describe("NodeAttributes", () => {
	const user = userEvent.setup();
	const mockOnClose = vi.fn();
	const mockSetUnresolvedChanges = vi.fn();

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
	});

	describe("Component Rendering", () => {
		it("should render without crashing", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByText(
					"Please use this section to manage attributes for this element."
				)
			).toBeInTheDocument();
		});

		it("should render form fields when node has existing data", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByDisplayValue("Initial assumption")
			).toBeInTheDocument();
			expect(
				screen.getByDisplayValue("Initial justification")
			).toBeInTheDocument();
		});

		it("should render add buttons when node has no existing data", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: ASSUMPTION_REGEX })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: JUSTIFICATION_REGEX })
			).toBeInTheDocument();
		});

		it("should only show justification button for strategy nodes", () => {
			const goalNode = {
				...mockNodeWithoutData,
				type: "goal",
			};

			render(
				<NodeAttributes
					actions={mockActions}
					node={goalNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: ASSUMPTION_REGEX })
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: JUSTIFICATION_REGEX })
			).not.toBeInTheDocument();
		});

		it("should render Cancel and Update buttons", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: "Cancel" })
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Update Attributes" })
			).toBeInTheDocument();
		});

		it("should show loading state on submit button", async () => {
			// Mock slow API response to catch loading state
			mockUpdateAssuranceCaseNode.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			// Should show loading state
			await waitFor(() => {
				expect(
					screen.getByRole("button", { name: "Saving..." })
				).toBeInTheDocument();
			});
		});
	});

	describe("User Interactions", () => {
		it("should toggle assumption field when add button is clicked", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			await user.click(assumptionButton);

			// Should show the assumption textarea
			expect(screen.getByLabelText("Assumption")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Type your assumption here.")
			).toBeInTheDocument();
		});

		it("should toggle justification field when add button is clicked", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const justificationButton = screen.getByRole("button", {
				name: JUSTIFICATION_REGEX,
			});
			await user.click(justificationButton);

			// Should show the justification textarea
			expect(screen.getByLabelText("Justification")).toBeInTheDocument();
			expect(
				screen.getByPlaceholderText("Type your justification here.")
			).toBeInTheDocument();
		});

		it("should change button icon when field is toggled", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});

			// Initially should have plus icon
			expect(document.querySelector("svg.lucide-plus")).toBeInTheDocument();

			await user.click(assumptionButton);

			// After click should have minus icon
			expect(document.querySelector("svg.lucide-minus")).toBeInTheDocument();
		});

		it("should handle form input changes", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			await user.clear(assumptionTextarea);
			await user.type(assumptionTextarea, "Updated assumption");

			expect(
				screen.getByDisplayValue("Updated assumption")
			).toBeInTheDocument();
		});

		it("should handle cancel button click", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Change form data
			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			await user.clear(assumptionTextarea);
			await user.type(assumptionTextarea, "Changed assumption");

			// Click cancel
			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			await user.click(cancelButton);

			// Should reset form and call action functions
			expect(mockActions.setSelectedLink).toHaveBeenCalledWith(false);
			expect(mockActions.setAction).toHaveBeenCalledWith("");
		});

		it("should handle form submission with valid data", async () => {
			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			await user.clear(assumptionTextarea);
			await user.type(assumptionTextarea, "Updated assumption");

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"strategy", // Updated to strategy
					1,
					"test-token",
					{
						assumption: "Updated assumption",
						justification: "Initial justification",
					}
				);
			});

			await waitFor(() => {
				expect(mockOnClose).toHaveBeenCalled();
			});
		});
	});

	describe("Form Validation", () => {
		it("should handle empty form submission", async () => {
			const emptyNode = {
				...mockNodeWithoutData,
				data: { id: 2 },
			};

			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			render(
				<NodeAttributes
					actions={mockActions}
					node={emptyNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"strategy",
					2,
					"test-token",
					{
						assumption: "",
						justification: "",
					}
				);
			});
		});

		it("should handle form with only assumption", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Add assumption field
			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			await user.click(assumptionButton);

			// Fill assumption
			const assumptionTextarea = screen.getByPlaceholderText(
				"Type your assumption here."
			);
			await user.type(assumptionTextarea, "New assumption");

			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"strategy",
					2,
					"test-token",
					{
						assumption: "New assumption",
						justification: "",
					}
				);
			});
		});

		it("should handle form with only justification", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Add justification field
			const justificationButton = screen.getByRole("button", {
				name: JUSTIFICATION_REGEX,
			});
			await user.click(justificationButton);

			// Fill justification
			const justificationTextarea = screen.getByPlaceholderText(
				"Type your justification here."
			);
			await user.type(justificationTextarea, "New justification");

			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"strategy",
					2,
					"test-token",
					{
						assumption: "",
						justification: "New justification",
					}
				);
			});
		});
	});

	describe("API Integration", () => {
		it("should handle successful API update", async () => {
			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockResolvedValue(mockAssuranceCase);

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockStoreState.setAssuranceCase).toHaveBeenCalledWith(
					mockAssuranceCase
				);
				expect(mockOnClose).toHaveBeenCalled();
			});
		});

		it("should handle failed node update", async () => {
			mockUpdateAssuranceCaseNode.mockResolvedValue(false);

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCase).not.toHaveBeenCalled();
				expect(mockOnClose).not.toHaveBeenCalled();
			});
		});

		it("should handle failed assurance case update", async () => {
			mockUpdateAssuranceCaseNode.mockResolvedValue(true);
			mockUpdateAssuranceCase.mockRejectedValue(new Error("Update failed"));

			// Silence console error for this test
			const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
				// Intentionally empty mock implementation
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			await waitFor(() => {
				expect(mockUpdateAssuranceCase).toHaveBeenCalled();
				expect(mockStoreState.setAssuranceCase).not.toHaveBeenCalled();
				expect(mockOnClose).not.toHaveBeenCalled();
			});

			// Restore console.error
			consoleError.mockRestore();
		});

		it("should not submit when required dependencies are missing", async () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: null,
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			expect(mockUpdateAssuranceCaseNode).not.toHaveBeenCalled();
		});

		it("should not submit when session is missing", async () => {
			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			expect(mockUpdateAssuranceCaseNode).not.toHaveBeenCalled();
		});

		it("should not submit when node type is missing", async () => {
			const nodeWithoutType = {
				...mockNode,
				type: undefined,
			};

			render(
				<NodeAttributes
					actions={mockActions}
					node={nodeWithoutType as unknown as typeof mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});
			await user.click(submitButton);

			expect(mockUpdateAssuranceCaseNode).not.toHaveBeenCalled();
		});
	});

	describe("Permissions and Access Control", () => {
		it("should make fields read-only when permissions are view", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: {
					...mockAssuranceCase,
					permissions: "view",
				},
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			const justificationTextarea = screen.getByDisplayValue(
				"Initial justification"
			);

			expect(assumptionTextarea).toHaveAttribute("readonly");
			expect(justificationTextarea).toHaveAttribute("readonly");
		});

		it("should make fields read-only when permissions are review", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: {
					...mockAssuranceCase,
					permissions: "review",
				},
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			const justificationTextarea = screen.getByDisplayValue(
				"Initial justification"
			);

			expect(assumptionTextarea).toHaveAttribute("readonly");
			expect(justificationTextarea).toHaveAttribute("readonly");
		});

		it("should allow editing when permissions are manage", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			const justificationTextarea = screen.getByDisplayValue(
				"Initial justification"
			);

			expect(assumptionTextarea).not.toHaveAttribute("readonly");
			expect(justificationTextarea).not.toHaveAttribute("readonly");
		});

		it("should allow editing when permissions are edit", () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: {
					...mockAssuranceCase,
					permissions: "edit",
				},
			});

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionTextarea = screen.getByDisplayValue("Initial assumption");
			const justificationTextarea = screen.getByDisplayValue(
				"Initial justification"
			);

			expect(assumptionTextarea).not.toHaveAttribute("readonly");
			expect(justificationTextarea).not.toHaveAttribute("readonly");
		});
	});

	describe("Edge Cases", () => {
		it("should handle node with missing data properties", () => {
			const nodeWithPartialData = {
				...mockNode,
				data: {
					id: 1,
					// Missing assumption and justification
				},
			};

			render(
				<NodeAttributes
					actions={mockActions}
					node={nodeWithPartialData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: ASSUMPTION_REGEX })
			).toBeInTheDocument();
		});

		it("should handle very long text inputs", async () => {
			const longText = "A".repeat(1000);

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Add assumption field
			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			await user.click(assumptionButton);

			const assumptionTextarea = screen.getByPlaceholderText(
				"Type your assumption here."
			);
			await user.type(assumptionTextarea, longText);

			expect(assumptionTextarea).toHaveValue(longText);
		});

		it("should handle special characters in input", async () => {
			const specialText =
				"Special chars: àáâãäåæçèéêë & <script>alert('test')</script>";

			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Add assumption field
			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			await user.click(assumptionButton);

			const assumptionTextarea = screen.getByPlaceholderText(
				"Type your assumption here."
			);
			await user.type(assumptionTextarea, specialText);

			expect(assumptionTextarea).toHaveValue(specialText);
		});

		it("should handle rapid button clicking", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});

			// Click multiple times rapidly
			await user.click(assumptionButton); // Show
			await user.click(assumptionButton); // Hide
			await user.click(assumptionButton); // Show

			// Should handle state correctly - final state should be shown (3 clicks = show)
			expect(screen.getByLabelText("Assumption")).toBeInTheDocument();
		});

		it("should handle form reset after partial data entry", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Add and fill assumption field
			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			await user.click(assumptionButton);

			const assumptionTextarea = screen.getByPlaceholderText(
				"Type your assumption here."
			);
			await user.type(assumptionTextarea, "Test assumption");

			// Cancel the form
			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			await user.click(cancelButton);

			// Should reset actions
			expect(mockActions.setSelectedLink).toHaveBeenCalledWith(false);
			expect(mockActions.setAction).toHaveBeenCalledWith("");
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const results = await axe(container, {
				rules: {
					// Disable color-contrast rule for jsdom compatibility
					"color-contrast": { enabled: false },
				},
			});
			expect(results.violations).toHaveLength(0);
		});

		it("should have proper form labels", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText("Assumption")).toBeInTheDocument();
			// Only strategy nodes have justification
			expect(screen.getByLabelText("Justification")).toBeInTheDocument();
		});

		it("should have accessible buttons", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});
			const justificationButton = screen.getByRole("button", {
				name: JUSTIFICATION_REGEX,
			});
			const cancelButton = screen.getByRole("button", { name: "Cancel" });
			const submitButton = screen.getByRole("button", {
				name: "Update Attributes",
			});

			expect(assumptionButton).toBeInTheDocument();
			expect(justificationButton).toBeInTheDocument();
			expect(cancelButton).toBeInTheDocument();
			expect(submitButton).toBeInTheDocument();
		});

		it("should handle keyboard navigation", async () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNodeWithoutData}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const assumptionButton = screen.getByRole("button", {
				name: ASSUMPTION_REGEX,
			});

			// Should be focusable
			assumptionButton.focus();
			expect(assumptionButton).toHaveFocus();

			// Should activate on Enter
			await user.keyboard("{Enter}");
			expect(screen.getByLabelText("Assumption")).toBeInTheDocument();
		});

		it("should provide proper form structure", () => {
			render(
				<NodeAttributes
					actions={mockActions}
					node={mockNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Form should have proper structure for screen readers
			const form = document.querySelector("form");
			expect(form).toBeInTheDocument();
		});
	});
});
