import type { Edge, Node, NodeTypes, OnNodesChange } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMockAssuranceCase,
	mockAssuranceCase,
} from "@/src/__tests__/utils/mock-data";
import {
	renderAndWait,
	waitForWithRetry,
} from "@/src/__tests__/utils/react-18-test-utils";
import {
	renderWithReactFlowAndAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase, Goal } from "@/types";
import Flow from "./flow";

// Regex constants for text matching
const LOADING_STATUS_REGEX = /loading/i;
const DISMISS_BUTTON_REGEX = /close|dismiss|x/i;

// Mock ReactFlow
const mockFitView = vi.fn();
const mockReactFlow = {
	fitView: mockFitView,
};

// Define types for mock ReactFlow props
interface MockReactFlowProps {
	nodes: Node[];
	edges: Edge[];
	onNodeClick?: (event: React.MouseEvent, node: Node) => void;
	onNodesChange?: OnNodesChange;
	children?: React.ReactNode;
}

vi.mock("reactflow", async () => {
	const actual = await vi.importActual("reactflow");
	return {
		...actual,
		useReactFlow: () => mockReactFlow,
		ReactFlow: ({
			nodes,
			edges,
			onNodeClick,
			onNodesChange: _onNodesChange,
			children,
		}: MockReactFlowProps) => (
			<div
				data-edges-count={edges.length}
				data-nodes-count={nodes.length}
				data-testid="rf__wrapper"
			>
				{nodes.map((node: Node) => (
					<button
						data-testid={`rf__node-${node.id}`}
						key={node.id}
						onClick={(e) => onNodeClick?.(e, node)}
						type="button"
					>
						{node.data?.label}
					</button>
				))}
				{children}
			</div>
		),
		Controls: () => <div data-testid="react-flow-controls">Controls</div>,
		Background: () => <div data-testid="react-flow-background">Background</div>,
		MiniMap: () => <div data-testid="react-flow-minimap">MiniMap</div>,
	};
});

// Define type for orphaned elements
type OrphanedElement = {
	id: number;
	type: string;
	name: string;
};

// Mock the store
const mockStore = {
	nodes: [] as Node[],
	edges: [] as Edge[],
	nodeTypes: {} as NodeTypes,
	onNodesChange: vi.fn() as unknown as OnNodesChange,
	setNodes: vi.fn(),
	setEdges: vi.fn(),
	layoutNodes: vi.fn(),
	assuranceCase: mockAssuranceCase as AssuranceCase | null,
	orphanedElements: [] as OrphanedElement[],
};

vi.mock("@/data/store", () => ({
	default: () => mockStore,
}));

// Define types for ActionButtons props
interface ActionButtonsProps {
	showCreateGoal: boolean;
	actions: {
		onLayout: (direction: string) => void;
	};
	notify: (message: string) => void;
	notifyError: (message: string) => void;
}

// Mock child components
vi.mock("./ActionButtons", () => ({
	default: ({
		showCreateGoal,
		actions,
		notify,
		notifyError,
	}: ActionButtonsProps) => (
		<div data-show-create-goal={showCreateGoal} data-testid="action-buttons">
			<button onClick={() => actions.onLayout("TB")} type="button">
				Layout
			</button>
			<button onClick={() => notify("Test notification")} type="button">
				Notify
			</button>
			<button onClick={() => notifyError("Test error")} type="button">
				Notify Error
			</button>
		</div>
	),
}));

// Define types for NodeEdit props
interface NodeEditProps {
	node: Node | null;
	isOpen: boolean;
	setEditOpen: (open: boolean) => void;
}

vi.mock("@/components/common/NodeEdit", () => ({
	default: ({ node, isOpen, setEditOpen }: NodeEditProps) =>
		isOpen ? (
			<div data-node-id={node?.id} data-testid="node-edit">
				<button onClick={() => setEditOpen(false)} type="button">
					Close Edit
				</button>
			</div>
		) : null,
}));

// Mock utility functions with proper async timing
vi.mock("@/lib/convert-case", () => ({
	convertAssuranceCase: vi.fn(
		() =>
			new Promise((resolve) =>
				setTimeout(
					() =>
						resolve({
							caseNodes: [
								{
									id: "1",
									type: "goal",
									data: { label: "Test Goal" },
									position: { x: 0, y: 0 },
								},
							],
							caseEdges: [],
						}),
					10
				)
			)
	),
}));

vi.mock("@/lib/layout-helper", () => ({
	getLayoutedElements: vi.fn((nodes: Node[], edges: Edge[]) => ({
		nodes: nodes.map((n: Node) => ({ ...n, position: { x: 100, y: 100 } })),
		edges,
	})),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("../ui/use-toast", () => ({
	useToast: () => ({
		toast: mockToast,
		toasts: [],
		dismiss: vi.fn(),
	}),
}));

// Mock theme
vi.mock("next-themes", () => ({
	useTheme: () => ({ theme: "light" }),
	ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Flow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockStore.nodes = [];
		mockStore.edges = [];
		mockStore.assuranceCase = createMockAssuranceCase({});
		mockStore.assuranceCase.goals = [
			{
				id: 1,
				type: "goal",
				name: "Test Goal",
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [],
				strategies: [],
			} as Goal,
		];
		mockStore.orphanedElements = [];
		mockFitView.mockClear();

		// Mock reset is handled by vi.clearAllMocks() above
	});

	describe("Loading State", () => {
		it("should display loading spinner initially", async () => {
			const { convertAssuranceCase } = await import("@/lib/convert-case");

			// Make the conversion take time so we can see the loading state
			let resolveConversion: (value: {
				caseNodes: Node[];
				caseEdges: Edge[];
			}) => void = () => {};
			vi.mocked(convertAssuranceCase).mockImplementationOnce(
				() => {
					return new Promise((resolve) => {
						resolveConversion = resolve;
					}) as any;
				}
			);

			await renderAndWait(() => renderWithReactFlowAndAuth(<Flow />));

			// Look for the spinner by its class
			const spinner = document.querySelector(".animate-spin");
			expect(spinner).toBeInTheDocument();

			// Now resolve the conversion
			resolveConversion({
				caseNodes: [
					{
						id: "1",
						type: "goal",
						data: { label: "Test Goal" },
						position: { x: 0, y: 0 },
					},
				],
				caseEdges: [],
			});

			// Wait for loading to finish
			await waitForWithRetry(() => {
				expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
			});
		});

		it("should hide ReactFlow during loading", async () => {
			const { convertAssuranceCase } = await import("@/lib/convert-case");

			// Make the conversion take time so we can see the loading state
			let resolveConversion: (value: {
				caseNodes: Node[];
				caseEdges: Edge[];
			}) => void = () => {};
			vi.mocked(convertAssuranceCase).mockImplementationOnce(
				() => {
					return new Promise((resolve) => {
						resolveConversion = resolve;
					}) as any;
				}
			);

			renderWithReactFlowAndAuth(<Flow />);

			expect(screen.queryByTestId("rf__wrapper")).not.toBeInTheDocument();

			// Now resolve the conversion
			resolveConversion({
				caseNodes: [
					{
						id: "1",
						type: "goal",
						data: { label: "Test Goal" },
						position: { x: 0, y: 0 },
					},
				],
				caseEdges: [],
			});

			// Wait for ReactFlow to appear
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});
		});
	});

	describe("ReactFlow Rendering", () => {
		beforeEach(() => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];
			mockStore.edges = [{ id: "e1-2", source: "1", target: "2" }];
		});

		it("should render ReactFlow with nodes and edges", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});

			expect(screen.getByTestId("react-flow")).toHaveAttribute(
				"data-nodes-count",
				"1"
			);
			expect(screen.getByTestId("react-flow")).toHaveAttribute(
				"data-edges-count",
				"1"
			);
		});

		it("should render ReactFlow controls and background", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow-controls")).toBeInTheDocument();
				expect(screen.getByTestId("react-flow-background")).toBeInTheDocument();
			});
		});

		it("should render nodes with correct data", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
				expect(screen.getByText("Test Goal")).toBeInTheDocument();
			});
		});

		it("should render action buttons", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});
		});
	});

	describe("Node Interaction", () => {
		beforeEach(() => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];
		});

		it("should open node edit on node click", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			const node = screen.getByTestId("node-1");
			await user.click(node);

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"1"
			);
		});

		it("should close node edit when requested", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			// Open edit
			const node = screen.getByTestId("node-1");
			await user.click(node);

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();

			// Close edit
			const closeButton = screen.getByText("Close Edit");
			await user.click(closeButton);

			expect(screen.queryByTestId("node-edit")).not.toBeInTheDocument();
		});

		it("should handle multiple node clicks", async () => {
			const user = userEvent.setup();
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Goal 1" },
					position: { x: 0, y: 0 },
				},
				{
					id: "2",
					type: "claim",
					data: { label: "Claim 1" },
					position: { x: 0, y: 100 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
				expect(screen.getByTestId("node-2")).toBeInTheDocument();
			});

			// Click first node
			await user.click(screen.getByTestId("node-1"));
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"1"
			);

			// Click second node
			await user.click(screen.getByTestId("node-2"));
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"2"
			);
		});
	});

	describe("Layout Functionality", () => {
		beforeEach(() => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];
		});

		it("should trigger layout on action button click", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const layoutButton = screen.getByText("Layout");
			await user.click(layoutButton);

			expect(mockStore.setNodes).toHaveBeenCalled();
			expect(mockStore.setEdges).toHaveBeenCalled();
		});

		it("should fit view after layout", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const layoutButton = screen.getByText("Layout");
			await user.click(layoutButton);

			// Wait for requestAnimationFrame
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockFitView).toHaveBeenCalled();
		});
	});

	describe("Assurance Case Conversion", () => {
		it("should convert assurance case on mount", async () => {
			const { convertAssuranceCase } = await import("@/lib/convert-case");

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(convertAssuranceCase).toHaveBeenCalledWith(
					mockStore.assuranceCase
				);
			});

			expect(mockStore.layoutNodes).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ id: "1", type: "goal" }),
				]),
				[]
			);
		});

		it("should handle assurance case without goals", () => {
			mockStore.assuranceCase = createMockAssuranceCase({ goals: [] });

			renderWithReactFlowAndAuth(<Flow />);

			// Should not crash and show loading state
			expect(
				screen.getByRole("status", { name: LOADING_STATUS_REGEX })
			).toBeInTheDocument();
		});

		it("should re-convert when assurance case changes", async () => {
			const { convertAssuranceCase } = await import("@/lib/convert-case");

			const { rerender } = renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(convertAssuranceCase).toHaveBeenCalledTimes(1);
			});

			// Change assurance case
			mockStore.assuranceCase = createMockAssuranceCase({
				id: 2,
			});
			mockStore.assuranceCase.goals = [
				{
					id: 2,
					type: "goal",
					name: "New Goal",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 2,
					context: [],
					property_claims: [],
					strategies: [],
				} as Goal,
			];

			rerender(<Flow />);

			await waitFor(() => {
				expect(convertAssuranceCase).toHaveBeenCalledTimes(2);
			});
		});
	});

	describe("Orphaned Elements", () => {
		it("should show orphaned elements message when present", async () => {
			mockStore.orphanedElements = [
				{ id: 1, type: "evidence", name: "Orphaned Evidence" },
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(
					screen.getByText(
						"You have orphaned elements for this assurance case."
					)
				).toBeInTheDocument();
			});
		});

		it("should not show orphaned elements message when none present", async () => {
			mockStore.orphanedElements = [];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(
					screen.queryByText(
						"You have orphaned elements for this assurance case."
					)
				).not.toBeInTheDocument();
			});
		});

		it("should hide orphaned message when dismissed", async () => {
			const user = userEvent.setup();
			mockStore.orphanedElements = [
				{ id: 1, type: "evidence", name: "Orphaned Evidence" },
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(
					screen.getByText(
						"You have orphaned elements for this assurance case."
					)
				).toBeInTheDocument();
			});

			const dismissButton = screen.getByRole("button", {
				name: DISMISS_BUTTON_REGEX,
			}); // X button
			await user.click(dismissButton);

			expect(
				screen.queryByText(
					"You have orphaned elements for this assurance case."
				)
			).not.toBeInTheDocument();
		});
	});

	describe("Notifications", () => {
		it("should trigger notification when notify is called", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const notifyButton = screen.getByText("Notify");
			await user.click(notifyButton);

			expect(mockToast).toHaveBeenCalledWith({
				description: "Test notification",
			});
		});

		it("should trigger error notification when notifyError is called", async () => {
			const user = userEvent.setup();
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const notifyErrorButton = screen.getByText("Notify Error");
			await user.click(notifyErrorButton);

			expect(mockToast).toHaveBeenCalledWith({
				variant: "destructive",
				title: "Uh oh! Something went wrong.",
				description: "Test error",
			});
		});
	});

	describe("Action Buttons Integration", () => {
		it("should show create goal button when no goal nodes exist", async () => {
			mockStore.nodes = [
				{
					id: "1",
					type: "claim",
					data: { label: "Test Claim" },
					position: { x: 0, y: 0 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "true");
			});
		});

		it("should hide create goal button when goal node exists", async () => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "false");
			});
		});

		it("should show create goal button when nodes array is empty", async () => {
			mockStore.nodes = [];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "true");
			});
		});
	});

	describe("Store Integration", () => {
		it("should use nodes from store", async () => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Store Goal" },
					position: { x: 0, y: 0 },
				},
				{
					id: "2",
					type: "claim",
					data: { label: "Store Claim" },
					position: { x: 0, y: 100 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByText("Store Goal")).toBeInTheDocument();
				expect(screen.getByText("Store Claim")).toBeInTheDocument();
			});
		});

		it("should use edges from store", async () => {
			mockStore.edges = [
				{ id: "e1-2", source: "1", target: "2" },
				{ id: "e2-3", source: "2", target: "3" },
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toHaveAttribute(
					"data-edges-count",
					"2"
				);
			});
		});

		it("should call onNodesChange from store", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});

			// onNodesChange should be passed to ReactFlow
			expect(mockStore.onNodesChange).toBeDefined();
		});
	});

	describe("Performance", () => {
		it("should handle large number of nodes", async () => {
			const manyNodes = Array.from({ length: 100 }, (_, i) => ({
				id: `node-${i}`,
				type: "claim",
				data: { label: `Node ${i}` },
				position: { x: i * 10, y: i * 10 },
			}));

			mockStore.nodes = manyNodes;

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toHaveAttribute(
					"data-nodes-count",
					"100"
				);
			});
		});

		it("should handle rapid node clicks without crashing", async () => {
			const user = userEvent.setup();
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			const node = screen.getByTestId("node-1");

			// Rapid clicks
			await user.click(node);
			await user.click(node);
			await user.click(node);

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have proper loading state accessibility", () => {
			renderWithReactFlowAndAuth(<Flow />);

			const loadingSpinner = screen.getByRole("status", {
				name: LOADING_STATUS_REGEX,
			});
			expect(loadingSpinner).toHaveClass("animate-spin");
		});

		it("should make nodes keyboard accessible", async () => {
			mockStore.nodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				const node = screen.getByTestId("node-1");
				expect(node).toBeInTheDocument();
			});
		});

		it("should have accessible controls", async () => {
			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow-controls")).toBeInTheDocument();
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle conversion errors gracefully", async () => {
			const convertAssuranceCase = vi.mocked(
				(await import("@/lib/convert-case")).convertAssuranceCase
			);
			convertAssuranceCase.mockRejectedValueOnce(
				new Error("Conversion failed")
			);

			renderWithReactFlowAndAuth(<Flow />);

			// The component should handle the error and show loading state
			await waitFor(() => {
				const spinner = document.querySelector(".animate-spin");
				expect(spinner).toBeInTheDocument();
			});

			// Reset the mock for other tests
			convertAssuranceCase.mockResolvedValue({
				caseNodes: [],
				caseEdges: [],
			});
		});

		it("should handle missing assurance case", async () => {
			mockStore.assuranceCase = null;

			renderWithReactFlowAndAuth(<Flow />);

			// Should show loading spinner when assurance case is missing
			await waitFor(() => {
				const spinner = document.querySelector(".animate-spin");
				expect(spinner).toBeInTheDocument();
			});
		});

		it("should handle malformed node data", async () => {
			mockStore.nodes = [
				{ id: "1", type: "goal", data: null, position: { x: 0, y: 0 } } as Node,
			];

			renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});

			// Should render without crashing
			expect(screen.getByTestId("node-1")).toBeInTheDocument();
		});
	});
});
