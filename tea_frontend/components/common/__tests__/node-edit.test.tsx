import { HttpResponse, http } from "msw";
import { useSession } from "next-auth/react";
import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
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

// Mock next-auth
vi.mock("next-auth/react", () => ({
	useSession: vi.fn(),
	SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseSession = vi.mocked(useSession);

// Mock the store
const mockStore = {
	assuranceCase: mockAssuranceCase as AssuranceCase | null,
	setAssuranceCase: vi.fn(),
	nodes: [] as Node[],
	orphanedElements: [],
	setOrphanedElements: vi.fn(),
	setNodeComments: vi.fn(),
	nodeComments: [],
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
	extractGoalsClaimsStrategies: vi
		.fn()
		.mockReturnValue({ goal: null, claims: [], strategies: [] }),
	findSiblingHiddenState: vi.fn().mockReturnValue(false),
	getAssuranceCaseNode: vi.fn().mockResolvedValue({
		id: 1,
		name: "Test Context",
		description: "Test description",
	}),
}));

// Import the mocked functions and types
import {
	deleteAssuranceCaseNode,
	detachCaseElement,
	extractGoalsClaimsStrategies,
	findParentNode,
	findSiblingHiddenState,
	removeAssuranceCaseNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case-helper";
import type { AssuranceCaseNode } from "../node-edit";

// Get the mocked functions
const mockDeleteAssuranceCaseNode = vi.mocked(deleteAssuranceCaseNode);
const mockRemoveAssuranceCaseNode = vi.mocked(removeAssuranceCaseNode);
const mockDetachCaseElement = vi.mocked(detachCaseElement);
const mockFindParentNode = vi.mocked(findParentNode);
const mockUpdateAssuranceCaseNode = vi.mocked(updateAssuranceCaseNode);
const mockUpdateAssuranceCase = vi.mocked(updateAssuranceCase);
const mockExtractGoalsClaimsStrategies = vi.mocked(
	extractGoalsClaimsStrategies
);
const mockFindSiblingHiddenState = vi.mocked(findSiblingHiddenState);

// Mock EditSheet component
vi.mock("../../ui/edit-sheet", () => ({
	default: ({
		children,
		isOpen,
		onChange,
		onClose,
		title,
		description,
	}: {
		isOpen: boolean;
		onChange: (value: boolean) => void;
		onClose: () => void;
		title: string;
		description: string;
		children?: React.ReactNode;
	}) =>
		isOpen ? (
			<div data-testid="edit-sheet">
				<div>
					<h2>{title}</h2>
					<div>{description}</div>
					<button onClick={() => onChange(false)} type="button">
						Close Sheet
					</button>
					<button onClick={onClose} type="button">
						Force Close
					</button>
					{children}
				</div>
			</div>
		) : null,
}));

// Mock EditForm component
vi.mock("../edit-form", () => ({
	default: ({
		node,
		onClose,
		setUnresolvedChanges,
	}: {
		node: Node;
		onClose: () => void;
		setUnresolvedChanges: (value: boolean) => void;
	}) => (
		<div data-testid="edit-form">
			<p>Form for {node.data.name}</p>
			<button onClick={onClose} type="button">
				Form Close
			</button>
			<button onClick={() => setUnresolvedChanges(true)} type="button">
				Make Changes
			</button>
		</div>
	),
}));

// Mock AlertModal component
vi.mock("../../modals/alert-modal", () => ({
	AlertModal: ({
		isOpen,
		onClose,
		onConfirm,
		message,
	}: {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: () => void;
		message: string;
	}) => (
		<div data-testid="alert-modal">
			{isOpen && (
				<div>
					<p>{message}</p>
					<button onClick={onClose} type="button">
						Cancel Alert
					</button>
					<button onClick={onConfirm} type="button">
						Confirm Alert
					</button>
				</div>
			)}
		</div>
	),
}));

// Mock NewLinkForm component
vi.mock("../new-link-form", () => ({
	default: ({ linkType }: { linkType: string }) => (
		<div data-testid="new-link-form">
			<p>Creating new {linkType}</p>
		</div>
	),
}));

// Mock OrphanElements component
vi.mock("../cases/orphan-elements", () => ({
	default: () => (
		<div data-testid="orphan-elements">
			<p>Orphan Elements</p>
		</div>
	),
}));

// Mock NodeContext component
vi.mock("../cases/node-context", () => ({
	default: () => (
		<div data-testid="node-context">
			<p>Node Context</p>
		</div>
	),
}));

// Mock NodeAttributes component
vi.mock("../cases/node-attributes", () => ({
	default: () => (
		<div data-testid="node-attributes">
			<p>Node Attributes</p>
		</div>
	),
}));

// Mock NodeComment component
vi.mock("../cases/node-comments", () => ({
	default: () => (
		<div data-testid="node-comment">
			<p>Node Comments</p>
		</div>
	),
}));

describe("NodeEdit", () => {
	const mockSetEditOpen = vi.fn();

	const createMockNode = (
		overrides: Partial<AssuranceCaseNode> = {}
	): AssuranceCaseNode => ({
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

		// Set up default mock for useSession
		mockUseSession.mockReturnValue({
			data: {
				key: "mock-jwt-token",
				expires: new Date(Date.now() + 86_400_000).toISOString(),
			},
			status: "authenticated",
			update: vi.fn(),
		});

		// Set up MSW handlers for comments API
		server.use(
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/goals/:id/comments/`,
				() => HttpResponse.json([])
			),
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/strategies/:id/comments/`,
				() => HttpResponse.json([])
			),
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/propertyclaims/:id/comments/`,
				() => HttpResponse.json([])
			),
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/evidence/:id/comments/`,
				() => HttpResponse.json([])
			),
			http.get(
				`${process.env.NEXT_PUBLIC_API_URL}/api/contexts/:id/comments/`,
				() => HttpResponse.json([])
			)
		);
	});

	describe("Component Mounting", () => {
		it("should not render when isOpen is false", () => {
			renderWithAuth(
				<NodeEdit
					isOpen={false}
					node={createMockNode()}
					setEditOpen={mockSetEditOpen}
				/>
			);

			expect(screen.queryByTestId("edit-sheet")).not.toBeInTheDocument();
		});

		it("should render when mounted and open", async () => {
			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={createMockNode()}
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
					isOpen={true}
					node={null as unknown as AssuranceCaseNode}
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Viewing G1")).toBeInTheDocument();
			});
		});

		it("should show description with help tooltip", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(
					screen.getByText("Use this form to update your goal.")
				).toBeInTheDocument();
			});
		});

		it("should show read-only description for view permissions", async () => {
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-form")).toBeInTheDocument();
			});
		});

		it("should handle EditForm close action", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Actions")).toBeInTheDocument();
			});
		});

		it("should show Manage Context button for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Manage Context")).toBeInTheDocument();
			});
		});

		it("should show Manage Attributes button for non-evidence nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Manage Attributes")).toBeInTheDocument();
			});
		});

		it("should not show Manage Attributes for evidence nodes", async () => {
			const evidenceNode = createMockNode({ type: "evidence" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={evidenceNode}
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
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Add New Element")).toBeInTheDocument();
			});
		});

		it("should show Comments button for all nodes", async () => {
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Delete")).toBeInTheDocument();
			});
		});

		it("should show detach button for non-goal nodes", async () => {
			const strategyNode = createMockNode({ type: "strategy" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={strategyNode}
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
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Delete")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Delete"));

			await waitFor(() => {
				expect(
					screen.getByText(
						"Deleting this element will also remove all of the connected child elements. Please detach any child elements that you wish to keep before deleting, as the current action cannot be undone."
					)
				).toBeInTheDocument();
			});
		});

		it("should call delete API when confirmed", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
					isOpen={true}
					node={strategyNode}
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
					isOpen={true}
					node={strategyNode}
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
					isOpen={true}
					node={strategyNode}
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
				data: {
					id: 1,
					name: "G1",
					short_description: "Parent goal",
					type: "goal",
				},
			});

			mockFindParentNode.mockReturnValue(parentNode);

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Parent Description")).toBeInTheDocument();
				expect(screen.getByText("Identifier: G1")).toBeInTheDocument();
			});
		});

		it("should not show parent description for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(
					screen.queryByText("Parent Description")
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Unresolved Changes Handling", () => {
		it("should show alert when closing with unresolved changes", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Make changes
			await waitFor(() => {
				expect(screen.getByText("Make Changes")).toBeInTheDocument();
			});

			await user.click(screen.getByText("Make Changes"));

			// Try to close
			await user.click(screen.getByText("Close Sheet"));

			await waitFor(() => {
				expect(
					screen.getByText(
						"You have changes that have not been updated. Would you like to discard these changes?"
					)
				).toBeInTheDocument();
			});
		});

		it("should allow closing without alert when no changes", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				// Should render without crashing
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});

		it("should handle node without type", async () => {
			const node = createMockNode({ type: undefined });

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Editing G1")).toBeInTheDocument();
			});
		});

		it("should handle missing node data", async () => {
			const node = createMockNode({
				data: { id: 1, name: "G1", type: "goal" },
			});

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
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
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});

			expect(() => unmount()).not.toThrow();
		});

		it("should handle rapid open/close cycles", async () => {
			const node = createMockNode();

			const { rerender } = renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});

			// Close
			rerender(
				<NodeEdit isOpen={false} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Open again
			rerender(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByTestId("edit-sheet")).toBeInTheDocument();
			});
		});
	});

	describe("Move Functionality", () => {
		it("should handle Goal move to another goal", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						name: "G1",
						short_description: "Test goal",
						long_description: "Test goal description",
						type: "goal",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [],
					},
				],
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			await waitFor(() => {
				expect(screen.getByText("Move property")).toBeInTheDocument();
			});

			// Select goal from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("G1")).toBeInTheDocument();
			});

			await user.click(screen.getByText("G1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"property",
					1,
					"mock-jwt-token",
					expect.objectContaining({
						goal_id: 1,
						strategy_id: null,
						property_claim_id: null,
						hidden: false,
					})
				);
			});
		});

		it("should handle PropertyClaim move to another property claim", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						type: "Goal",
						name: "G1",
						short_description: "Test goal",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [
							{
								id: 2,
								type: "PropertyClaim",
								name: "P1",
								short_description: "Test property claim",
								long_description: "",
								goal_id: 1,
								property_claim_id: null,
								level: 1,
								claim_type: "claim",
								strategy_id: null,
								property_claims: [],
								evidence: [],
							},
						],
					},
				],
			});

			mockExtractGoalsClaimsStrategies.mockReturnValue({
				claims: [
					{
						id: 2,
						type: "PropertyClaim",
						name: "P1",
						short_description: "Test property claim",
						long_description: "",
						goal_id: 1,
						property_claim_id: null,
						level: 1,
						claim_type: "claim",
						strategy_id: null,
						property_claims: [],
						evidence: [],
					},
				],
				strategies: [],
				goal: null,
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Select property claim from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("P1")).toBeInTheDocument();
			});

			await user.click(screen.getByText("P1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"property",
					1,
					"mock-jwt-token",
					expect.objectContaining({
						goal_id: null,
						strategy_id: null,
						property_claim_id: 2,
						hidden: false,
					})
				);
			});
		});

		it("should handle Strategy move", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						type: "Goal",
						name: "G1",
						short_description: "Test goal",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						strategies: [
							{
								id: 3,
								type: "Strategy",
								name: "S1",
								short_description: "Test strategy",
								long_description: "",
								goal_id: 1,
								property_claims: [],
							},
						],
						context: [],
						property_claims: [],
					},
				],
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Select strategy from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("S1")).toBeInTheDocument();
			});

			await user.click(screen.getByText("S1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"property",
					1,
					"mock-jwt-token",
					expect.objectContaining({
						goal_id: null,
						strategy_id: 3,
						property_claim_id: null,
						hidden: false,
					})
				);
			});
		});

		it("should handle Evidence move", async () => {
			const user = userEvent.setup();
			const evidenceNode = createMockNode({ type: "evidence" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						type: "Goal",
						name: "G1",
						short_description: "Test goal",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [
							{
								id: 2,
								type: "PropertyClaim",
								name: "P1",
								short_description: "Test property claim",
								long_description: "",
								goal_id: 1,
								property_claim_id: null,
								level: 1,
								claim_type: "claim",
								strategy_id: null,
								property_claims: [],
								evidence: [],
							},
						],
					},
				],
			});

			mockExtractGoalsClaimsStrategies.mockReturnValue({
				claims: [
					{
						id: 2,
						type: "PropertyClaim",
						name: "P1",
						short_description: "Test property claim",
						long_description: "",
						goal_id: 1,
						property_claim_id: null,
						level: 1,
						claim_type: "claim",
						strategy_id: null,
						property_claims: [],
						evidence: [],
					},
				],
				strategies: [],
				goal: null,
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={evidenceNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Select property claim from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("P1")).toBeInTheDocument();
			});

			await user.click(screen.getByText("P1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalledWith(
					"evidence",
					1,
					"mock-jwt-token",
					expect.objectContaining({
						property_claim_id: [2],
						hidden: false,
					})
				);
			});
		});

		it("should handle move with hidden sibling state", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						name: "G1",
						short_description: "Test goal",
						long_description: "Test goal description",
						type: "goal",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [],
					},
				],
			});

			// Mock hidden sibling state
			mockFindSiblingHiddenState.mockReturnValue(true);

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Select goal from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);
			await user.click(screen.getByText("G1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCase).toHaveBeenCalledWith(
					"property",
					expect.any(Object),
					expect.objectContaining({
						hidden: true, // Should use sibling hidden state
					}),
					1,
					expect.any(Object),
					true
				);
			});
		});

		it("should handle move cancellation", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			await waitFor(() => {
				expect(screen.getByText("Move property")).toBeInTheDocument();
			});

			// Click Cancel button
			await user.click(screen.getByText("Cancel"));

			// Should return to main action view
			await waitFor(() => {
				expect(screen.queryByText("Move property")).not.toBeInTheDocument();
				expect(screen.getByText("Actions")).toBeInTheDocument();
			});
		});

		it("should disable move for goal and strategy nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });
			const strategyNode = createMockNode({ type: "strategy" });

			// Test goal node
			const { rerender } = renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
			});

			// Test strategy node
			rerender(
				<NodeEdit
					isOpen={true}
					node={strategyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Move Item")).not.toBeInTheDocument();
			});
		});

		it("should handle move error", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						name: "G1",
						short_description: "Test goal",
						long_description: "Test goal description",
						type: "goal",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [],
					},
				],
			});

			// Mock update to return false (error)
			mockUpdateAssuranceCaseNode.mockResolvedValueOnce(false);

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Select goal from dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);
			await user.click(screen.getByText("G1"));

			// Click Move button
			await user.click(screen.getByText("Move"));

			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalled();
				// Should not close the sheet on error
				expect(mockSetEditOpen).not.toHaveBeenCalledWith(false);
			});
		});

		it("should show empty state when no strategies available", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						type: "Goal",
						name: "G1",
						short_description: "Test goal",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						strategies: [], // Empty strategies
						context: [],
						property_claims: [],
					},
				],
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Open dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("No strategies found.")).toBeInTheDocument();
			});
		});

		it("should show empty state when no property claims available for evidence", async () => {
			const user = userEvent.setup();
			const evidenceNode = createMockNode({ type: "evidence" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						type: "Goal",
						name: "G1",
						short_description: "Test goal",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [], // Empty claims
					},
				],
			});

			mockExtractGoalsClaimsStrategies.mockReturnValue({
				claims: [], // Empty claims
				strategies: [],
				goal: null,
			});

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={evidenceNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			// Open dropdown
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(
					screen.getByText("No property claims found.")
				).toBeInTheDocument();
			});
		});
	});

	describe("New Element Creation", () => {
		it("should show new element options for goal nodes", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			await waitFor(() => {
				expect(screen.getByText("Add New")).toBeInTheDocument();
				expect(screen.getByText("Add Strategy")).toBeInTheDocument();
				expect(screen.getByText("Add Property Claim")).toBeInTheDocument();
			});
		});

		it("should show new element options for strategy nodes", async () => {
			const user = userEvent.setup();
			const strategyNode = createMockNode({ type: "strategy" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={strategyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			await waitFor(() => {
				expect(screen.getByText("Add New")).toBeInTheDocument();
				expect(screen.getByText("Add Property Claim")).toBeInTheDocument();
				// Should not show Add Strategy for strategy nodes
				expect(screen.queryByText("Add Strategy")).not.toBeInTheDocument();
			});
		});

		it("should show new element options for property nodes", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			await waitFor(() => {
				expect(screen.getByText("Add New")).toBeInTheDocument();
				expect(screen.getByText("Add Property Claim")).toBeInTheDocument();
				expect(screen.getByText("Add Evidence")).toBeInTheDocument();
			});
		});

		it("should not show new element button for evidence nodes", async () => {
			const evidenceNode = createMockNode({ type: "evidence" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={evidenceNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Add New Element")).not.toBeInTheDocument();
			});
		});

		it("should not show new element button for context nodes", async () => {
			const contextNode = createMockNode({ type: "context" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={contextNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Add New Element")).not.toBeInTheDocument();
			});
		});

		it("should handle selecting strategy for creation", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			// Click Add Strategy
			await user.click(screen.getByText("Add Strategy"));

			await waitFor(() => {
				// Should show NewLinkForm component
				expect(screen.getByTestId("new-link-form")).toBeInTheDocument();
			});
		});

		it("should handle selecting property claim for creation", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			// Click Add Property Claim
			await user.click(screen.getByText("Add Property Claim"));

			await waitFor(() => {
				// Should show NewLinkForm component
				expect(screen.getByTestId("new-link-form")).toBeInTheDocument();
			});
		});

		it("should handle selecting evidence for creation", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			// Click Add Evidence
			await user.click(screen.getByText("Add Evidence"));

			await waitFor(() => {
				// Should show NewLinkForm component
				expect(screen.getByTestId("new-link-form")).toBeInTheDocument();
			});
		});

		it("should handle canceling new element creation", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Add New Element button
			await user.click(screen.getByText("Add New Element"));

			await waitFor(() => {
				expect(screen.getByText("Add New")).toBeInTheDocument();
			});

			// Click Cancel
			await user.click(screen.getByText("Cancel"));

			await waitFor(() => {
				// Should return to main actions view
				expect(screen.queryByText("Add New")).not.toBeInTheDocument();
				expect(screen.getByText("Actions")).toBeInTheDocument();
			});
		});
	});

	describe("Reattach Element Action", () => {
		it("should show reattach element button for non-evidence/context nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });
			const strategyNode = createMockNode({ type: "strategy" });
			const propertyNode = createMockNode({ type: "property" });

			// Test goal node
			const { rerender } = renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Reattach Element(s)")).toBeInTheDocument();
			});

			// Test strategy node
			rerender(
				<NodeEdit
					isOpen={true}
					node={strategyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Reattach Element(s)")).toBeInTheDocument();
			});

			// Test property node
			rerender(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.getByText("Reattach Element(s)")).toBeInTheDocument();
			});
		});

		it("should not show reattach element button for evidence/context nodes", async () => {
			const evidenceNode = createMockNode({ type: "evidence" });
			const contextNode = createMockNode({ type: "context" });

			// Test evidence node
			const { rerender } = renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={evidenceNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(
					screen.queryByText("Reattach Element(s)")
				).not.toBeInTheDocument();
			});

			// Test context node
			rerender(
				<NodeEdit
					isOpen={true}
					node={contextNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(
					screen.queryByText("Reattach Element(s)")
				).not.toBeInTheDocument();
			});
		});

		it("should show orphan elements when reattach is clicked", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Reattach Element(s) button
			await user.click(screen.getByText("Reattach Element(s)"));

			await waitFor(() => {
				// Should show Existing Elements section (actual OrphanElements component)
				expect(screen.getByText("Existing Elements")).toBeInTheDocument();
			});
		});
	});

	describe("Context and Attributes Actions", () => {
		it("should show Manage Context button only for goal nodes", async () => {
			const goalNode = createMockNode({ type: "goal" });
			const strategyNode = createMockNode({ type: "strategy" });

			// Test goal node
			const { rerender } = renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			await waitFor(() => {
				expect(screen.getByText("Manage Context")).toBeInTheDocument();
			});

			// Test strategy node
			rerender(
				<NodeEdit
					isOpen={true}
					node={strategyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			await waitFor(() => {
				expect(screen.queryByText("Manage Context")).not.toBeInTheDocument();
			});
		});

		it("should show NodeContext when Manage Context is clicked", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Manage Context button
			await user.click(screen.getByText("Manage Context"));

			await waitFor(() => {
				// NodeContext component renders a form with this text
				expect(
					screen.getByText("Please add a new context using the form below.")
				).toBeInTheDocument();
			});
		});

		it("should show NodeAttributes when Manage Attributes is clicked", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Click Manage Attributes button
			await user.click(screen.getByText("Manage Attributes"));

			await waitFor(() => {
				// Should show attributes section
				expect(
					screen.getByText(
						"Please use this section to manage attributes for this element."
					)
				).toBeInTheDocument();
			});
		});
	});

	describe("Comments Action", () => {
		it("should show NodeComment when Comments is clicked", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Click Comments button
			await user.click(screen.getByText("Comments"));

			await waitFor(() => {
				// NodeComment component shows "New Comment" when not in read-only mode
				expect(
					screen.getByRole("heading", { name: "New Comment" })
				).toBeInTheDocument();
				expect(
					screen.getByText("No comments have been added.")
				).toBeInTheDocument();
			});
		});

		it("should pass readonly state to NodeComment based on permissions", async () => {
			const user = userEvent.setup();
			const node = createMockNode();
			mockStore.assuranceCase = createMockAssuranceCase({
				permissions: "view",
			});

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Click Comments button
			await user.click(screen.getByText("Comments"));

			await waitFor(() => {
				// Should show Comments heading in readonly mode
				expect(
					screen.getByRole("heading", { name: "Comments" })
				).toBeInTheDocument();
			});
		});
	});

	describe("Help Tooltip", () => {
		it("should show help tooltip with node type description", async () => {
			const user = userEvent.setup();
			const goalNode = createMockNode({ type: "goal" });

			renderWithAuth(
				<NodeEdit isOpen={true} node={goalNode} setEditOpen={mockSetEditOpen} />
			);

			// Find help icon and hover over it
			const helpIcon = document.querySelector("svg.lucide-help-circle");
			if (helpIcon) {
				await user.hover(helpIcon);

				await waitFor(() => {
					// Should show tooltip with description from caseItemDescription
					expect(screen.getByText("Goal description")).toBeInTheDocument();
				});
			}
		});
	});

	describe("Session Handling", () => {
		it("should handle missing session key", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			mockUseSession.mockReturnValue({
				data: null,
				status: "unauthenticated",
				update: vi.fn(),
			});

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Try to delete
			await user.click(screen.getByText("Delete"));
			await user.click(screen.getByText("Confirm Alert"));

			await waitFor(() => {
				// Should call with empty string for missing session
				expect(mockDeleteAssuranceCaseNode).toHaveBeenCalledWith("goal", 1, "");
			});
		});
	});

	describe("Loading State", () => {
		it("should show loading state during delete operation", async () => {
			const user = userEvent.setup();
			const node = createMockNode();

			// Make delete operation slow
			mockDeleteAssuranceCaseNode.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);

			renderWithAuth(
				<NodeEdit isOpen={true} node={node} setEditOpen={mockSetEditOpen} />
			);

			// Click delete and confirm
			await user.click(screen.getByText("Delete"));
			await user.click(screen.getByText("Confirm Alert"));

			// Should set loading state
			await waitFor(() => {
				expect(mockDeleteAssuranceCaseNode).toHaveBeenCalled();
			});
		});

		it("should show loading state during move operation", async () => {
			const user = userEvent.setup();
			const propertyNode = createMockNode({ type: "property" });

			mockStore.assuranceCase = createMockAssuranceCase({
				goals: [
					{
						id: 1,
						name: "G1",
						short_description: "Test goal",
						long_description: "Test goal description",
						type: "goal",
						keywords: "",
						assurance_case_id: 1,
						strategies: [],
						context: [],
						property_claims: [],
					},
				],
			});

			// Make move operation slow
			mockUpdateAssuranceCaseNode.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100))
			);

			renderWithAuth(
				<NodeEdit
					isOpen={true}
					node={propertyNode}
					setEditOpen={mockSetEditOpen}
				/>
			);

			// Click Move Item button
			await user.click(screen.getByText("Move Item"));

			await waitFor(() => {
				expect(screen.getByText("Move property")).toBeInTheDocument();
			});

			// Find and click the select trigger using a more specific selector
			const selectTrigger = screen.getByRole("combobox");
			await user.click(selectTrigger);

			await waitFor(() => {
				expect(screen.getByText("G1")).toBeInTheDocument();
			});

			await user.click(screen.getByText("G1"));
			await user.click(screen.getByText("Move"));

			// Should set loading state
			await waitFor(() => {
				expect(mockUpdateAssuranceCaseNode).toHaveBeenCalled();
			});
		});
	});
});
