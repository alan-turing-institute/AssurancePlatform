import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAssuranceCase, updateAssuranceCaseNode } from "@/lib/case";
import { AssuranceCaseFactory } from "@/src/__tests__/utils/test-factories";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import EditForm from "../edit-form";

// Regex constants
const DESCRIPTION_REGEX = /description/i;
const UPDATE_REGEX = /update/i;
const EVIDENCE_URL_REGEX = /evidence url/i;
const UPDATE_STRATEGY_REGEX = /update strategy/i;

// Mock the store
const mockStore: {
	assuranceCase: { id: number; permissions: string | string[] } | null;
	setAssuranceCase: ReturnType<typeof vi.fn>;
} = {
	assuranceCase: {
		id: 1,
		permissions: "manage",
	},
	setAssuranceCase: vi.fn(),
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock case helper functions
vi.mock("@/lib/case", () => ({
	updateAssuranceCaseNode: vi.fn().mockResolvedValue(true),
	updateAssuranceCase: vi.fn().mockResolvedValue({
		id: 1,
		goals: [],
	}),
}));

// Get the mocked functions
const mockUpdateAssuranceCaseNode = vi.mocked(updateAssuranceCaseNode);
const mockUpdateAssuranceCase = vi.mocked(updateAssuranceCase);

describe("EditForm", () => {
	const mockOnClose = vi.fn();
	const mockSetUnresolvedChanges = vi.fn();

	const createMockNode = (overrides: Partial<Node> = {}): Node => ({
		id: "1",
		type: "goal",
		position: { x: 0, y: 0 },
		data: {
			id: 1,
			name: "G1",
			short_description: "Test goal description",
			description: "Test goal description", // Form expects this field
			type: "goal",
			...overrides.data,
		},
		...overrides,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.setAssuranceCase.mockClear();
		mockUpdateAssuranceCaseNode.mockClear();
		mockUpdateAssuranceCase.mockClear();
		mockStore.assuranceCase = AssuranceCaseFactory.create({
			id: 1,
			permissions: "manage" as const,
		});
		// Reset to default implementations
		mockUpdateAssuranceCaseNode.mockResolvedValue(true);
		mockUpdateAssuranceCase.mockResolvedValue(
			AssuranceCaseFactory.create({
				id: 1,
				goals: [],
			})
		);
	});

	describe("Form Rendering", () => {
		it("should render form with description field", () => {
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText(DESCRIPTION_REGEX)).toBeInTheDocument();
			expect(
				screen.getByDisplayValue("Test goal description")
			).toBeInTheDocument();
		});

		it("should render update button for manageable cases", () => {
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: UPDATE_REGEX })
			).toBeInTheDocument();
		});

		it("should not render update button for read-only cases", () => {
			const node = createMockNode();
			mockStore.assuranceCase = AssuranceCaseFactory.create({
				id: 1,
				permissions: "view" as const,
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.queryByRole("button", { name: UPDATE_REGEX })
			).not.toBeInTheDocument();
		});

		it("should render URL field for evidence nodes", () => {
			const evidenceNode = createMockNode({
				type: "evidence",
				data: {
					id: 1,
					name: "E1",
					short_description: "Test evidence",
					description: "Test evidence",
					URL: "https://example.com",
					type: "evidence",
				},
			});

			renderWithAuth(
				<EditForm
					node={evidenceNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText(EVIDENCE_URL_REGEX)).toBeInTheDocument();
			expect(
				screen.getByDisplayValue("https://example.com")
			).toBeInTheDocument();
		});

		it("should not render URL field for non-evidence nodes", () => {
			const goalNode = createMockNode({
				type: "goal",
			});

			renderWithAuth(
				<EditForm
					node={goalNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.queryByLabelText(EVIDENCE_URL_REGEX)
			).not.toBeInTheDocument();
		});
	});

	describe("Read-Only State", () => {
		it("should show read-only indicators for view permissions", () => {
			const node = createMockNode();
			mockStore.assuranceCase = AssuranceCaseFactory.create({
				id: 1,
				permissions: "view" as const,
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByTitle("Read Only")).toBeInTheDocument();
			expect(screen.getByDisplayValue("Test goal description")).toHaveAttribute(
				"readonly"
			);
		});

		it("should allow editing for manage permissions", () => {
			const node = createMockNode();
			mockStore.assuranceCase = AssuranceCaseFactory.create({
				id: 1,
				permissions: "manage" as const,
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.queryByTitle("Read Only")).not.toBeInTheDocument();
			expect(
				screen.getByDisplayValue("Test goal description")
			).not.toHaveAttribute("readonly");
		});
	});

	describe("Form Validation", () => {
		it("should require minimum 2 characters for description", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(DESCRIPTION_REGEX);
			await user.clear(descriptionInput);
			await user.type(descriptionInput, "A");

			const updateButton = screen.getByRole("button", { name: UPDATE_REGEX });
			await user.click(updateButton);

			await waitFor(() => {
				expect(
					screen.getByText("Description must be atleast 2 characters")
				).toBeInTheDocument();
			});
		});

		it("should accept valid form data", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(DESCRIPTION_REGEX);
			await user.clear(descriptionInput);
			await user.type(descriptionInput, "Updated description");

			const updateButton = screen.getByRole("button", { name: UPDATE_REGEX });
			await user.click(updateButton);

			// Should not show validation error
			expect(
				screen.queryByText("Description must be atleast 2 characters")
			).not.toBeInTheDocument();
		});
	});

	describe("Form Submission", () => {
		it("should show loading state during submission", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			// Mock slow API call
			mockUpdateAssuranceCaseNode.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", { name: UPDATE_REGEX });
			await user.click(updateButton);

			// Check if button is disabled during submission
			await waitFor(() => {
				expect(updateButton).toBeDisabled();
			});
		});

		it("should handle form submission", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const updateButton = screen.getByRole("button", { name: UPDATE_REGEX });
			await user.click(updateButton);

			await waitFor(() => {
				expect(mockOnClose).toHaveBeenCalled();
			});
		});
	});

	describe("Change Tracking", () => {
		it("should track changes to description field", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(DESCRIPTION_REGEX);
			await user.type(descriptionInput, " Modified");

			await waitFor(() => {
				expect(mockSetUnresolvedChanges).toHaveBeenCalledWith(true);
			});
		});

		it("should track changes to URL field", async () => {
			const user = userEvent.setup();
			const evidenceNode = createMockNode({
				type: "evidence",
				data: {
					id: 1,
					name: "E1",
					description: "Test evidence",
					URL: "https://example.com",
					type: "evidence",
				},
			});

			renderWithAuth(
				<EditForm
					node={evidenceNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const urlInput = screen.getByLabelText(EVIDENCE_URL_REGEX);
			await user.type(urlInput, "/modified");

			await waitFor(() => {
				expect(mockSetUnresolvedChanges).toHaveBeenCalledWith(true);
			});
		});
	});

	describe("Node Type Handling", () => {
		it("should display correct node type in button text", () => {
			const strategyNode = createMockNode({
				type: "strategy",
				data: { id: 1, name: "S1", type: "strategy" },
			});

			renderWithAuth(
				<EditForm
					node={strategyNode}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByRole("button", { name: UPDATE_STRATEGY_REGEX })
			).toBeInTheDocument();
		});
	});

	describe("Form Default Values", () => {
		it("should populate form with existing node data", () => {
			const node = createMockNode({
				data: {
					id: 1,
					name: "G1",
					short_description: "Existing description",
					description: "Existing description",
					type: "goal",
				},
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(
				screen.getByDisplayValue("Existing description")
			).toBeInTheDocument();
		});

		it("should handle missing node data gracefully", () => {
			const node = createMockNode({
				data: undefined,
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Should use default values
			const descriptionInput = screen.getByLabelText(DESCRIPTION_REGEX);
			expect(descriptionInput).toHaveValue("");
		});
	});

	describe("Accessibility", () => {
		it("should have proper form labels", () => {
			const node = createMockNode();

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			expect(screen.getByLabelText(DESCRIPTION_REGEX)).toBeInTheDocument();
		});

		it("should have proper button states for disabled form", () => {
			const node = createMockNode();
			mockStore.assuranceCase = AssuranceCaseFactory.create({
				id: 1,
				permissions: "view" as const,
			});

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Should not have update button in read-only mode
			expect(
				screen.queryByRole("button", { name: UPDATE_REGEX })
			).not.toBeInTheDocument();
		});
	});

	describe("Edge Cases", () => {
		it("should handle null assurance case", () => {
			const node = createMockNode();
			mockStore.assuranceCase = null;

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			// Should show update button when assurance case is null (since readOnly check is for view/review permissions)
			expect(
				screen.getByRole("button", { name: UPDATE_REGEX })
			).toBeInTheDocument();
		});

		it("should handle very long description input", async () => {
			const user = userEvent.setup();
			const node = createMockNode();
			const longDescription = "A".repeat(100);

			renderWithAuth(
				<EditForm
					node={node}
					onClose={mockOnClose}
					setUnresolvedChanges={mockSetUnresolvedChanges}
				/>
			);

			const descriptionInput = screen.getByLabelText(DESCRIPTION_REGEX);
			await user.clear(descriptionInput);
			await user.type(descriptionInput, longDescription);

			expect(descriptionInput).toHaveValue(longDescription);
		});
	});
});
