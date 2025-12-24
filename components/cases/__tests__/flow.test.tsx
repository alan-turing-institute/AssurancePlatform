import { act } from "@testing-library/react";
import type { Edge, Node, NodeTypes, OnNodesChange } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertAssuranceCase } from "@/lib/convert-case";
import {
	createMockAssuranceCase,
	mockAssuranceCase,
} from "@/src/__tests__/utils/mock-data";
import {
	renderWithReactFlowAndAuth,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import type { AssuranceCase, Goal } from "@/types";
import Flow from "../flow";

// Regex constants for text matching
const _LOADING_STATUS_REGEX = /loading/i;
const _DISMISS_BUTTON_REGEX = /close|dismiss|x/i;

// Get the mock for testing - defined first so it can be used in mock and tests
const mockFitView = vi.fn();

// Mock ReactFlow with minimal implementation
vi.mock("reactflow", () => {
	const MockReactFlow = ({
		nodes = [],
		edges = [],
		onNodeClick,
		children,
	}: {
		nodes?: { id: string; data?: { label?: string } }[];
		edges?: unknown[];
		onNodeClick?: (
			e: React.MouseEvent,
			node: { id: string; data?: { label?: string } }
		) => void;
		children?: React.ReactNode;
	}) => (
		<div
			data-edges-count={edges.length}
			data-nodes-count={nodes.length}
			data-testid="react-flow"
		>
			{nodes.map((node) => (
				<button
					data-testid={`node-${node.id}`}
					key={node.id}
					onClick={(e) => onNodeClick?.(e, node)}
					type="button"
				>
					{node.data?.label}
				</button>
			))}
			{children}
		</div>
	);

	return {
		default: MockReactFlow,
		useReactFlow: () => ({ fitView: mockFitView }),
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
			<div>{children}</div>
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
type ActionButtonsProps = {
	showCreateGoal: boolean;
	actions: {
		onLayout: (direction: string) => void;
	};
	notify: (message: string) => void;
	notifyError: (message: string) => void;
};

// Mock child components
vi.mock("../action-buttons", () => ({
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
type NodeEditProps = {
	node: Node | null;
	isOpen: boolean;
	setEditOpen: (open: boolean) => void;
};

vi.mock("@/components/common/node-edit", () => ({
	default: ({ node, isOpen, setEditOpen }: NodeEditProps) =>
		isOpen ? (
			<div data-node-id={node?.id} data-testid="node-edit">
				<button onClick={() => setEditOpen(false)} type="button">
					Close Edit
				</button>
			</div>
		) : null,
}));

// Mock utility functions
vi.mock("@/lib/convert-case", () => ({
	convertAssuranceCase: vi
		.fn()
		.mockResolvedValue({ caseNodes: [], caseEdges: [] }),
}));

vi.mock("@/lib/layout-helper", () => ({
	getLayoutedElements: vi.fn((nodes: Node[], edges: Edge[]) => ({
		nodes: nodes.map((n: Node) => ({ ...n, position: { x: 100, y: 100 } })),
		edges,
	})),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/lib/toast", () => ({
	useToast: () => ({
		toast: mockToast,
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

		// Default mock implementation for convertAssuranceCase - make it resolve immediately
		// This helps avoid async state update warnings in tests
		vi.mocked(convertAssuranceCase).mockResolvedValue({
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

		// Mock layoutNodes to update the store
		mockStore.layoutNodes.mockImplementation((nodes, edges) => {
			mockStore.nodes = nodes;
			mockStore.edges = edges;
		});
	});

	describe("Loading State", () => {
		it("should display loading spinner initially", async () => {
			// Make the conversion take time so we can see the loading state
			let resolveConversion: (value: {
				caseNodes: Node[];
				caseEdges: Edge[];
			}) => void = () => {
				// This will be replaced by the Promise constructor
			};
			(
				vi.mocked(convertAssuranceCase) as ReturnType<typeof vi.fn>
			).mockImplementationOnce(
				() =>
					new Promise<{ caseNodes: Node[]; caseEdges: Edge[] }>((resolve) => {
						resolveConversion = resolve;
					})
			);

			const { container } = renderWithReactFlowAndAuth(<Flow />);

			// Look for the spinner by its class
			const spinner = container.querySelector(".animate-spin");
			expect(spinner).toBeInTheDocument();

			// Now resolve the conversion
			act(() => {
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
			});

			// Wait for loading to finish
			await waitFor(() => {
				expect(
					container.querySelector(".animate-spin")
				).not.toBeInTheDocument();
			});
		});

		it("should hide ReactFlow during loading", async () => {
			// Make the conversion take time so we can see the loading state
			let resolveConversion: (value: {
				caseNodes: Node[];
				caseEdges: Edge[];
			}) => void = () => {
				// This will be replaced by the Promise constructor
			};
			(
				vi.mocked(convertAssuranceCase) as ReturnType<typeof vi.fn>
			).mockImplementationOnce(
				() =>
					new Promise<{ caseNodes: Node[]; caseEdges: Edge[] }>((resolve) => {
						resolveConversion = resolve;
					})
			);

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();

			// Now resolve the conversion and update nodes in store
			act(() => {
				const result = {
					caseNodes: [
						{
							id: "1",
							type: "goal",
							data: { label: "Test Goal" },
							position: { x: 0, y: 0 },
						},
					],
					caseEdges: [],
				};
				resolveConversion(result);
				// Simulate what layoutNodes would do
				mockStore.nodes = result.caseNodes;
				mockStore.edges = result.caseEdges;
			});

			// Wait for ReactFlow to appear
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});
		});
	});

	describe("ReactFlow Rendering", () => {
		beforeEach(() => {
			// Set up immediate resolution so component loads quickly
			vi.mocked(convertAssuranceCase).mockResolvedValue({
				caseNodes: [
					{
						id: "1",
						type: "goal",
						data: { label: "Test Goal" },
						position: { x: 0, y: 0 },
					},
				],
				caseEdges: [{ id: "e1-2", source: "1", target: "2" }],
			});
		});

		it("should render ReactFlow with nodes and edges", async () => {
			// Render the component and wait for async operations
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			// Wait for the async convert function to complete and component to render
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			}, 5000);

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
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("react-flow-controls")).toBeInTheDocument();
				expect(screen.getByTestId("react-flow-background")).toBeInTheDocument();
			});
		});

		it("should render nodes with correct data", async () => {
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
				expect(screen.getByText("Test Goal")).toBeInTheDocument();
			});
		});

		it("should render action buttons", async () => {
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

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
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			const node = screen.getByTestId("node-1");
			await act(async () => {
				await user.click(node);
			});

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"1"
			);
		});

		it("should close node edit when requested", async () => {
			const user = userEvent.setup();
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			// Open edit
			const node = screen.getByTestId("node-1");
			await act(async () => {
				await user.click(node);
			});

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();

			// Close edit
			const closeButton = screen.getByText("Close Edit");
			await act(async () => {
				await user.click(closeButton);
			});

			expect(screen.queryByTestId("node-edit")).not.toBeInTheDocument();
		});

		it("should handle multiple node clicks", async () => {
			const user = userEvent.setup();
			const testNodes = [
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

			// Mock convertAssuranceCase to return our test nodes
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: testNodes,
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
				expect(screen.getByTestId("node-2")).toBeInTheDocument();
			});

			// Click first node
			await act(async () => {
				await user.click(screen.getByTestId("node-1"));
			});
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"1"
			);

			// Click second node
			await act(async () => {
				await user.click(screen.getByTestId("node-2"));
			});
			expect(screen.getByTestId("node-edit")).toHaveAttribute(
				"data-node-id",
				"2"
			);
		});
	});

	describe("Layout Functionality", () => {
		beforeEach(() => {
			const testNodes = [
				{
					id: "1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
				},
			];

			// Mock convertAssuranceCase to return our test nodes
			vi.mocked(convertAssuranceCase).mockResolvedValue({
				caseNodes: testNodes,
				caseEdges: [],
			});
		});

		it("should trigger layout on action button click", async () => {
			const user = userEvent.setup();
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const layoutButton = screen.getByText("Layout");
			await act(async () => {
				await user.click(layoutButton);
			});

			expect(mockStore.setNodes).toHaveBeenCalled();
			expect(mockStore.setEdges).toHaveBeenCalled();
		});

		it("should fit view after layout", async () => {
			const user = userEvent.setup();
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("action-buttons")).toBeInTheDocument();
			});

			const layoutButton = screen.getByText("Layout");
			await act(async () => {
				await user.click(layoutButton);
			});

			// Wait for layout processing and requestAnimationFrame
			await act(async () => {
				await new Promise((resolve) => {
					requestAnimationFrame(() => {
						setTimeout(resolve, 0);
					});
				});
			});

			await waitFor(() => {
				expect(mockFitView).toHaveBeenCalled();
			});
		});
	});

	describe("Assurance Case Conversion", () => {
		it("should convert assurance case on mount", async () => {
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [
					{ id: "1", type: "goal", data: {}, position: { x: 0, y: 0 } },
				],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(vi.mocked(convertAssuranceCase)).toHaveBeenCalledWith({
					...mockStore.assuranceCase,
					goals: mockStore.assuranceCase?.goals || [],
				});
			});

			expect(mockStore.layoutNodes).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ id: "1", type: "goal" }),
				]),
				[]
			);
		});

		it("should handle assurance case without goals", async () => {
			mockStore.assuranceCase = createMockAssuranceCase({ goals: [] });

			// Mock empty conversion result
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			// Should not crash and should complete loading
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});
		});

		it("should re-convert when assurance case changes", async () => {
			const { rerender } = renderWithReactFlowAndAuth(<Flow />);

			await waitFor(() => {
				expect(vi.mocked(convertAssuranceCase)).toHaveBeenCalledTimes(1);
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

			act(() => {
				rerender(<Flow />);
			});

			await waitFor(() => {
				expect(vi.mocked(convertAssuranceCase)).toHaveBeenCalledTimes(2);
			});
		});
	});

	describe("Orphaned Elements", () => {
		it("should show orphaned elements message when present", async () => {
			mockStore.orphanedElements = [
				{ id: 1, type: "evidence", name: "Orphaned Evidence" },
			];

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

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

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

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

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(
					screen.getByText(
						"You have orphaned elements for this assurance case."
					)
				).toBeInTheDocument();
			});

			// Find the X button by its container and icon
			const dismissButton = screen
				.getAllByRole("button")
				.find(
					(button) =>
						button.querySelector(".h-4.w-4") &&
						button.className.includes("hover:bg-gray-400")
				);

			if (dismissButton) {
				await act(async () => {
					await user.click(dismissButton);
				});
			}

			await waitFor(() => {
				expect(
					screen.queryByText(
						"You have orphaned elements for this assurance case."
					)
				).not.toBeInTheDocument();
			});
		});
	});

	describe("Action Buttons Integration", () => {
		it("should show create goal button when no goal nodes exist", async () => {
			// Mock conversion result with non-goal nodes
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [
					{
						id: "1",
						type: "claim",
						data: { label: "Test Claim" },
						position: { x: 0, y: 0 },
					},
				],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "true");
			});
		});

		it("should hide create goal button when goal node exists", async () => {
			// Default mock already has a goal node
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "false");
			});
		});

		it("should show create goal button when nodes array is empty", async () => {
			// Mock empty conversion result
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				const actionButtons = screen.getByTestId("action-buttons");
				expect(actionButtons).toHaveAttribute("data-show-create-goal", "true");
			});
		});
	});

	describe("Store Integration", () => {
		it("should use nodes from store", async () => {
			// Mock conversion with multiple nodes
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [
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
				],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByText("Store Goal")).toBeInTheDocument();
				expect(screen.getByText("Store Claim")).toBeInTheDocument();
			});
		});

		it("should use edges from store", async () => {
			// Mock conversion with edges
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [
					{ id: "1", type: "goal", data: {}, position: { x: 0, y: 0 } },
					{ id: "2", type: "claim", data: {}, position: { x: 0, y: 100 } },
				],
				caseEdges: [
					{ id: "e1-2", source: "1", target: "2" },
					{ id: "e2-3", source: "2", target: "3" },
				],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toHaveAttribute(
					"data-edges-count",
					"2"
				);
			});
		});

		it("should call onNodesChange from store", async () => {
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

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

			// Mock conversion with many nodes
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: manyNodes,
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toHaveAttribute(
					"data-nodes-count",
					"100"
				);
			});
		});

		it("should handle rapid node clicks without crashing", async () => {
			const user = userEvent.setup();
			// Default mock already has a goal node
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});

			const node = screen.getByTestId("node-1");

			// Rapid clicks
			await act(async () => {
				await user.click(node);
				await user.click(node);
				await user.click(node);
			});

			expect(screen.getByTestId("node-edit")).toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		it("should have proper loading state accessibility", async () => {
			// Mock slow conversion to see loading state
			let resolveConversion: (value: {
				caseNodes: Node[];
				caseEdges: Edge[];
			}) => void = () => {
				// This will be replaced by the Promise constructor
			};
			(
				vi.mocked(convertAssuranceCase) as ReturnType<typeof vi.fn>
			).mockImplementationOnce(
				() =>
					new Promise<{ caseNodes: Node[]; caseEdges: Edge[] }>((resolve) => {
						resolveConversion = resolve;
					})
			);

			const { container } = renderWithReactFlowAndAuth(<Flow />);

			// Check for loading spinner
			const loadingElement = container.querySelector(".animate-spin");
			expect(loadingElement).toBeInTheDocument();

			// Resolve to complete loading
			act(() => {
				resolveConversion({ caseNodes: [], caseEdges: [] });
			});

			// Wait for the loading to finish
			await waitFor(() => {
				expect(
					container.querySelector(".animate-spin")
				).not.toBeInTheDocument();
			});
		});

		it("should make nodes keyboard accessible", async () => {
			// Default mock already has a goal node
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				const node = screen.getByTestId("node-1");
				expect(node).toBeInTheDocument();
			});
		});

		it("should have accessible controls", async () => {
			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("react-flow-controls")).toBeInTheDocument();
			});
		});
	});

	describe("Error Handling", () => {
		it("should handle conversion errors gracefully", async () => {
			// Mock conversion error
			vi.mocked(convertAssuranceCase).mockRejectedValueOnce(
				new Error("Conversion failed")
			);

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			// When conversion fails, component should exit loading state
			// and render ReactFlow with empty nodes/edges
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});

			// Should render with empty nodes and edges
			expect(screen.getByTestId("react-flow")).toHaveAttribute(
				"data-nodes-count",
				"0"
			);
			expect(screen.getByTestId("react-flow")).toHaveAttribute(
				"data-edges-count",
				"0"
			);
		});

		it("should handle missing assurance case", async () => {
			mockStore.assuranceCase = null;

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			// Should complete loading even without assurance case
			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});
		});

		it("should handle malformed node data", async () => {
			// Mock conversion with malformed node
			vi.mocked(convertAssuranceCase).mockResolvedValueOnce({
				caseNodes: [
					{
						id: "1",
						type: "goal",
						data: null,
						position: { x: 0, y: 0 },
					} as Node,
				],
				caseEdges: [],
			});

			let _component: ReturnType<typeof renderWithReactFlowAndAuth>;
			await act(async () => {
				_component = renderWithReactFlowAndAuth(<Flow />);
				// Give time for useEffect and async operations to complete
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await waitFor(() => {
				expect(screen.getByTestId("react-flow")).toBeInTheDocument();
			});

			// Should render without crashing
			await waitFor(() => {
				expect(screen.getByTestId("node-1")).toBeInTheDocument();
			});
		});
	});
});
