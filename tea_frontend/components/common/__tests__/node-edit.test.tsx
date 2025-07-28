import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "reactflow";
import {
	createMockAssuranceCase,
	mockAssuranceCase,
} from "@/src/__tests__/utils/mock-data";
import {
	renderWithAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase } from "@/types";
import NodeEdit from "../node-edit";

// Mock the store
const mockStore = {
	assuranceCase: mockAssuranceCase as AssuranceCase | null,
	setAssuranceCase: vi.fn(),
	nodes: [] as Node[],
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Mock case helper functions
vi.mock("@/lib/case-helper", () => ({
	updateAssuranceCaseNode: vi.fn().mockResolvedValue(true),
	updateAssuranceCase: vi.fn().mockResolvedValue({ id: 1, goals: [] }),
	deleteAssuranceCaseNode: vi.fn().mockResolvedValue(true),
	removeAssuranceCaseNode: vi.fn().mockResolvedValue({ id: 1, goals: [] }),
	detachCaseElement: vi.fn().mockResolvedValue({ detached: true }),
	findParentNode: vi.fn().mockReturnValue(null),
	caseItemDescription: vi.fn().mockReturnValue("Goal description"),
	extractGoalsClaimsStrategies: vi.fn().mockReturnValue({ claims: [] }),
}));

// Import the mocked functions
import {
	deleteAssuranceCaseNode,
	removeAssuranceCaseNode,
	detachCaseElement,
	findParentNode,
} from "@/lib/case-helper";

// Get the mocked functions
const mockDeleteAssuranceCaseNode = vi.mocked(deleteAssuranceCaseNode);
const mockRemoveAssuranceCaseNode = vi.mocked(removeAssuranceCaseNode);
const mockDetachCaseElement = vi.mocked(detachCaseElement);
const mockFindParentNode = vi.mocked(findParentNode);

// Mock EditSheet component
vi.mock("../../ui/edit-sheet", () => ({
	default: ({ children, isOpen, onChange, onClose, title, description }: any) =>
		isOpen ? (
			<div data-testid="edit-sheet">
				<div>
					<h2>{title}</h2>
					<div>{description}</div>
					<button onClick={() => onChange(false)}>Close Sheet</button>
					<button onClick={onClose}>Force Close</button>
					{children}
				</div>
			</div>
		) : null,
}));

// Mock EditForm component
vi.mock("../edit-form", () => ({
	default: ({ node, onClose, setUnresolvedChanges }: any) => (
		<div data-testid="edit-form">
			<p>Form for {node.data.name}</p>
			<button onClick={onClose}>Form Close</button>
			<button onClick={() => setUnresolvedChanges(true)}>Make Changes</button>
		</div>
	),
}));

// Mock AlertModal component
vi.mock("../../modals/alert-modal", () => ({
	AlertModal: ({ isOpen, onClose, onConfirm, message }: any) => (
		<div data-testid="alert-modal">
			{isOpen && (
				<div>
					<p>{message}</p>
					<button onClick={onClose}>Cancel Alert</button>
					<button onClick={onConfirm}>Confirm Alert</button>
				</div>
			)}
		</div>
	),
}));

describe("NodeEdit", () => {
	const mockSetEditOpen = vi.fn();

	const createMockNode = (overrides: Partial<any> = {}): any => ({
		id: "1",
		type: "goal",
		position: { x: 0, y: 0 },
		data: {
			id: 1,
			name: "G1",
			short_description: "Test goal",
			type: "goal",
			...overrides.data,
		},
		...overrides,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.assuranceCase = createMockAssuranceCase({
			id: 1,
			permissions: "manage",
		});
		mockStore.setAssuranceCase.mockClear();
	});

	describe("Component Mounting", () => {
		it("should not render when isOpen is false", () => {
			renderWithAuth(
				<NodeEdit
					node={createMockNode()}
					isOpen={false}
					setEditOpen={mockSetEditOpen}
				/>
			);

			expect(screen.queryByTestId("edit-sheet")).not.toBeInTheDocument();
		});

		it("should render when mounted and open", async () => {
			renderWithAuth(
				<NodeEdit
					node={createMockNode()}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});

		it("should not render when node is null", async () => {
			renderWithAuth(
				<NodeEdit
					node={null as any}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByTestId("edit-sheet")).not.toBeInTheDocument();
			});
		});
	});

	describe("Sheet Rendering", () => {
		it("should render with correct title for manage permissions", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Editing G1")).toBeInTheDocument();
			});
		});

		it("should render with correct title for view permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Viewing G1")).toBeInTheDocument();
			});
		});

		it("should show description with help tooltip", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Use this form to update your goal.")).toBeInTheDocument();
			});
		});

		it("should show read-only description for view permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("You are viewing a goal.")).toBeInTheDocument();
			});
		});
	});

	describe("EditForm Integration", () => {
		it("should render EditForm with correct props", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-form")).toBeInTheDocument();
			});
		});

		it("should handle EditForm close action", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Form Close")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Form Close"));

			expect(mockSetEditOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Action Buttons", () => {
		it("should show action buttons for manageable nodes", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Actions")).toBeInTheDocument();
			});
		});

		it("should show Manage Context button for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit
					node={goalNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Manage Context")).toBeInTheDocument();
			});
		});

		it("should show Manage Attributes button for non-evidence nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit
					node={goalNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Manage Attributes")).toBeInTheDocument();
			});
		});

		it("should not show Manage Attributes for evidence nodes", async () => {
			const evidenceNode = createMockNode({ type: "evidence" });

			renderWithAuth(
				<NodeEdit
					node={evidenceNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Manage Attributes")).not.toBeInTheDocument();
			});
		});

		it("should show Add New Element button for applicable nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit
					node={goalNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Add New Element")).toBeInTheDocument();
			});
		});

		it("should show Comments button for all nodes", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Comments")).toBeInTheDocument();
			});
		});
	});

	describe("Delete and Detach Actions", () => {
		it("should show delete button for manageable nodes", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Delete")).toBeInTheDocument();
			});
		});

		it("should show detach button for non-goal nodes", async () => {
			const strategyNode = createMockNode({ type: "strategy" });

			renderWithAuth(
				<NodeEdit
					node={strategyNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Detach")).toBeInTheDocument();
			});
		});

		it("should not show detach button for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit
					node={goalNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Detach")).not.toBeInTheDocument();
			});
		});

		it("should not show delete/detach buttons for read-only permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Delete")).not.toBeInTheDocument();
				expect(screen.queryByText("Detach")).not.toBeInTheDocument();
			});
		});
	});

	describe("Delete Functionality", () => {
		it("should open delete confirmation modal when delete is clicked", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Delete")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Delete"));

			await waitFor(() => {
				expect(screen.getByText("Deleting this element will also remove all of the connected child elements. Please detach any child elements that you wish to keep before deleting, as the current action cannot be undone.")).toBeInTheDocument();
			});
		});

		it("should call delete API when confirmed", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Open delete modal
			await user.click(screen.getByText("Delete"));

			await waitFor(() => {
				expect(screen.getByText("Confirm Alert")).toBeInTheDocument();
			});

			// Confirm delete
			await user.click(screen.getByText("Confirm Alert"));

			await waitFor(() => {
				expect(mockDeleteAssuranceCaseNode).toHaveBeenCalledWith(
					"goal",
					1,
					"mock-jwt-token"
				);
			});
		});

		it("should update store and close after successful delete", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await user.click(screen.getByText("Delete"));
			await user.click(screen.getByText("Confirm Alert"));

			await waitFor(() => {
				expect(mockRemoveAssuranceCaseNode).toHaveBeenCalled();
				expect(mockStore.setAssuranceCase).toHaveBeenCalled();
				expect(mockSetEditOpen).toHaveBeenCalledWith(false);
			});
		});
	});

	describe("Detach Functionality", () => {
		it("should call detach API when detach is clicked", async () => {
			const user = userEvent.setup();
			const strategyNode = createMockNode({ type: "strategy" });

			renderWithAuth(
				<NodeEdit
					node={strategyNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Detach")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Detach"));

			await waitFor(() => {
				expect(mockDetachCaseElement).toHaveBeenCalledWith(
					strategyNode,
					"strategy",
					1,
					"mock-jwt-token"
				);
			});
		});

		it("should update store after successful detach", async () => {
			const user = userEvent.setup();
			const strategyNode = createMockNode({ type: "strategy" });

			renderWithAuth(
				<NodeEdit
					node={strategyNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await user.click(screen.getByText("Detach"));

			await waitFor(() => {
				expect(mockRemoveAssuranceCaseNode).toHaveBeenCalled();
				expect(mockStore.setAssuranceCase).toHaveBeenCalled();
				expect(mockSetEditOpen).toHaveBeenCalledWith(false);
			});
		});

		it("should handle detach errors gracefully", async () => {
			const user = userEvent.setup();
			const strategyNode = createMockNode({ type: "strategy" });

			mockDetachCaseElement.mockResolvedValue({ error: "Detach failed" });

			renderWithAuth(
				<NodeEdit
					node={strategyNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await user.click(screen.getByText("Detach"));

			await waitFor(() => {
				// Should handle error and not update store
				expect(mockStore.setAssuranceCase).not.toHaveBeenCalled();
			});
		});
	});

	describe("Parent Node Display", () => {
		it("should show parent description when parent exists", async () => {
			const node = createMockNode({ type: "strategy" });
			const parentNode = createMockNode({
				data: { id: 1, name: "G1", short_description: "Parent goal" },
			});

			mockFindParentNode.mockReturnValue(parentNode);

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Parent Description")).toBeInTheDocument();
				expect(screen.getByText("Identifier: G1")).toBeInTheDocument();
			});
		});

		it("should not show parent description for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit
					node={goalNode}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Parent Description")).not.toBeInTheDocument();
			});
		});
	});

	describe("Unresolved Changes Handling", () => {
		it("should show alert when closing with unresolved changes", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Make changes
			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));

			// Try to close
			await user.click(screen.getByText("Close Sheet"));

			await waitFor(() => {
				expect(screen.getByText("You have changes that have not been updated. Would you like to discard these changes?")).toBeInTheDocument();
			});
		});

		it("should allow closing without alert when no changes", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Close Sheet")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Close Sheet"));

			expect(mockSetEditOpen).toHaveBeenCalledWith(false);
		});
	});

	describe("Edge Cases", () => {
		it("should handle null assurance case", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = null;

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				// Should render without crashing
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});

		it("should handle node without type", async () => {
			const node = createMockNode({ type: undefined });

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Editing G1")).toBeInTheDocument();
			});
		});

		it("should handle missing node data", async () => {
			const node = createMockNode({ data: { id: 1 } });

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});
	});

	describe("Permissions Handling", () => {
		it("should handle review permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "review",
			});

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Viewing G1")).toBeInTheDocument();
				expect(screen.queryByText("Delete")).not.toBeInTheDocument();
			});
		});

		it("should handle undefined permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: undefined,
			});

			renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				// Component currently treats undefined permissions as manage permissions
				expect(screen.getByText("Delete")).toBeInTheDocument();
			});
		});
	});

	describe("Component Lifecycle", () => {
		it("should handle component unmounting gracefully", async () => {
			const node = createMockNode();

			const { unmount } = renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});

			expect(() => unmount()).not.toThrow();
		});

		it("should handle rapid open/close cycles", async () => {
			const node = createMockNode();

			const { rerender } = renderWithAuth(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});

			// Close
			rerender(
				<NodeEdit
					node={node}
					isOpen={false}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Open again
			rerender(
				<NodeEdit
					node={node}
					isOpen={true}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});
	});
});
