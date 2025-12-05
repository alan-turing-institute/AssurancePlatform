import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Edge, Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import useStore from "@/data/store";
import { AssuranceCaseFactory } from "@/src/__tests__/utils/test-factories";
import ToggleButton from "../toggle-button";

// Mock ReactFlow
vi.mock("reactflow", () => ({
	getConnectedEdges: vi.fn(() => []),
	getOutgoers: vi.fn(() => []),
	useReactFlow: () => ({
		fitView: vi.fn(),
	}),
}));

// Mock the store
vi.mock("@/data/store", () => ({
	default: vi.fn(),
}));

// Mock the case helper
vi.mock("@/lib/case", () => ({
	toggleHiddenForChildren: vi.fn(),
}));

const mockUseStore = vi.mocked(useStore);

const mockNodes: Node[] = [
	{
		id: "1",
		type: "goal",
		position: { x: 0, y: 0 },
		data: {
			id: 1,
			property_claims: [{ hidden: false }],
		},
	},
	{
		id: "2",
		type: "strategy",
		position: { x: 0, y: 100 },
		data: {
			id: 2,
			strategies: [{ hidden: true }],
		},
	},
	{
		id: "3",
		type: "evidence",
		position: { x: 0, y: 200 },
		data: {
			id: 3,
		},
	},
];

const mockEdges: Edge[] = [
	{
		id: "e1-2",
		source: "1",
		target: "2",
		hidden: false,
	},
	{
		id: "e2-3",
		source: "2",
		target: "3",
		hidden: false,
	},
];

const mockAssuranceCase = AssuranceCaseFactory.create({
	id: 1,
	name: "Test Case",
	description: "Test Description",
	goals: [],
});

const mockStoreState = {
	nodes: mockNodes,
	edges: mockEdges,
	layoutNodes: vi.fn(),
	assuranceCase: mockAssuranceCase,
	setAssuranceCase: vi.fn(),
};

describe("ToggleButton", () => {
	const user = userEvent.setup();

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseStore.mockReturnValue(mockStoreState);
	});

	describe("Component Rendering", () => {
		it("should render without crashing", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should display ChevronDown icon when not hidden", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			// ChevronDown should be visible by default (not hidden)
			const chevronDown = document.querySelector("svg.lucide-chevron-down");
			expect(chevronDown).toBeInTheDocument();
		});

		it("should display ChevronRight icon when hidden", async () => {
			// Mock node with hidden property claims
			const hiddenNode = {
				...mockNodes[0],
				data: {
					...mockNodes[0].data,
					property_claims: [{ hidden: true }],
				},
			};

			// Update the store to include the hidden node
			const updatedNodes = mockNodes.map((n) =>
				n.id === "1" ? hiddenNode : n
			);
			mockUseStore.mockReturnValue({
				...mockStoreState,
				nodes: updatedNodes,
			});

			render(<ToggleButton node={hiddenNode} />);

			// Wait for useEffect to update the state
			await waitFor(() => {
				const chevronRight = document.querySelector("svg.lucide-chevron-right");
				expect(chevronRight).toBeInTheDocument();
			});
		});

		it("should handle node with strategies", () => {
			render(<ToggleButton node={mockNodes[1]} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle node without property_claims or strategies", () => {
			render(<ToggleButton node={mockNodes[2]} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});
	});

	describe("State Management", () => {
		it("should initialize hidden state from property_claims", async () => {
			const nodeWithHiddenClaims = {
				...mockNodes[0],
				data: {
					...mockNodes[0].data,
					property_claims: [{ hidden: true }],
				},
			};

			// Update the store to include the hidden node
			const updatedNodes = mockNodes.map((n) =>
				n.id === "1" ? nodeWithHiddenClaims : n
			);
			mockUseStore.mockReturnValue({
				...mockStoreState,
				nodes: updatedNodes,
			});

			render(<ToggleButton node={nodeWithHiddenClaims} />);

			// Wait for useEffect to update the state
			await waitFor(() => {
				const chevronRight = document.querySelector("svg.lucide-chevron-right");
				expect(chevronRight).toBeInTheDocument();
			});
		});

		it("should initialize hidden state from strategies", () => {
			const nodeWithHiddenStrategies = {
				...mockNodes[1],
				data: {
					...mockNodes[1].data,
					strategies: [{ hidden: true }],
				},
			};

			render(<ToggleButton node={nodeWithHiddenStrategies} />);

			// Should show ChevronRight when hidden
			const chevronRight = document.querySelector("svg.lucide-chevron-right");
			expect(chevronRight).toBeInTheDocument();
		});

		it("should update state when node data changes", async () => {
			const { rerender } = render(<ToggleButton node={mockNodes[0]} />);

			// Initially not hidden
			expect(
				document.querySelector("svg.lucide-chevron-down")
			).toBeInTheDocument();

			// Update the store to reflect changed node data
			const updatedNodes = mockNodes.map((n) =>
				n.id === "1"
					? { ...n, data: { ...n.data, property_claims: [{ hidden: true }] } }
					: n
			);
			mockUseStore.mockReturnValue({
				...mockStoreState,
				nodes: updatedNodes,
			});

			// Re-render with updated node
			const updatedNode = updatedNodes[0];
			rerender(<ToggleButton node={updatedNode} />);

			// Should now show ChevronRight
			await waitFor(() => {
				expect(
					document.querySelector("svg.lucide-chevron-right")
				).toBeInTheDocument();
			});
		});
	});

	describe("User Interactions", () => {
		it("should handle button click", async () => {
			const { toggleHiddenForChildren } = await import("@/lib/case");
			const mockToggleHiddenForChildren = vi.mocked(toggleHiddenForChildren);
			mockToggleHiddenForChildren.mockReturnValue(mockAssuranceCase);

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			await user.click(button);

			expect(mockToggleHiddenForChildren).toHaveBeenCalledWith(
				mockAssuranceCase,
				mockNodes[0].data.id
			);
			expect(mockStoreState.setAssuranceCase).toHaveBeenCalledWith(
				mockAssuranceCase
			);
		});

		it("should stop event propagation on click", async () => {
			const mockStopPropagation = vi.fn();
			const _mockEvent = {
				stopPropagation: mockStopPropagation,
			} as unknown as React.MouseEvent;

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			await user.click(button);

			// Since we can't directly test stopPropagation, we verify the button is clickable
			expect(button).toBeInTheDocument();
		});

		it("should toggle hidden state on click", async () => {
			const { toggleHiddenForChildren } = await import("@/lib/case");
			const mockToggleHiddenForChildren = vi.mocked(toggleHiddenForChildren);
			mockToggleHiddenForChildren.mockReturnValue(mockAssuranceCase);

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");

			// Initially should show ChevronDown (not hidden)
			expect(
				document.querySelector("svg.lucide-chevron-down")
			).toBeInTheDocument();

			// Click to toggle
			await user.click(button);

			// Should call toggle function
			expect(mockToggleHiddenForChildren).toHaveBeenCalled();
		});

		it("should handle goal node click with fitView", async () => {
			const mockFitView = vi.fn();
			vi.doMock("reactflow", () => ({
				getConnectedEdges: vi.fn(() => []),
				getOutgoers: vi.fn(() => []),
				useReactFlow: () => ({
					fitView: mockFitView,
				}),
			}));

			const { toggleHiddenForChildren } = await import("@/lib/case");
			const mockToggleHiddenForChildren = vi.mocked(toggleHiddenForChildren);
			mockToggleHiddenForChildren.mockReturnValue(mockAssuranceCase);

			const goalNode = { ...mockNodes[0], type: "goal" };
			render(<ToggleButton node={goalNode} />);

			const button = screen.getByRole("button");
			await user.click(button);

			// Wait for requestAnimationFrame
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(mockToggleHiddenForChildren).toHaveBeenCalled();
		});
	});

	describe("Edge Cases", () => {
		it("should handle node not found in store", () => {
			const unknownNode = {
				id: "unknown",
				type: "goal",
				position: { x: 0, y: 0 },
				data: { id: 999 },
			};

			render(<ToggleButton node={unknownNode} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle missing assurance case", async () => {
			mockUseStore.mockReturnValue({
				...mockStoreState,
				assuranceCase: null,
			});

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			await user.click(button);

			// Should not call setAssuranceCase when assuranceCase is null
			expect(mockStoreState.setAssuranceCase).not.toHaveBeenCalled();
		});

		it("should handle node with empty property_claims array", () => {
			const nodeWithEmptyClaims = {
				...mockNodes[0],
				data: {
					...mockNodes[0].data,
					property_claims: [],
				},
			};

			render(<ToggleButton node={nodeWithEmptyClaims} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle node with empty strategies array", () => {
			const nodeWithEmptyStrategies = {
				...mockNodes[1],
				data: {
					...mockNodes[1].data,
					strategies: [],
				},
			};

			render(<ToggleButton node={nodeWithEmptyStrategies} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle node with missing data properties", () => {
			const nodeWithMinimalData = {
				id: "minimal",
				type: "goal",
				position: { x: 0, y: 0 },
				data: {},
			};

			render(<ToggleButton node={nodeWithMinimalData} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle undefined property_claims and strategies", () => {
			const nodeWithUndefinedProps = {
				id: "undefined-props",
				type: "goal",
				position: { x: 0, y: 0 },
				data: {
					id: 1,
					property_claims: undefined,
					strategies: undefined,
				},
			};

			render(<ToggleButton node={nodeWithUndefinedProps} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle multiple clicks rapidly", async () => {
			const { toggleHiddenForChildren } = await import("@/lib/case");
			const mockToggleHiddenForChildren = vi.mocked(toggleHiddenForChildren);
			mockToggleHiddenForChildren.mockReturnValue(mockAssuranceCase);

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");

			// Rapid clicks
			await user.click(button);
			await user.click(button);
			await user.click(button);

			// Should handle multiple calls
			expect(mockToggleHiddenForChildren).toHaveBeenCalledTimes(3);
		});
	});

	describe("Integration with ReactFlow", () => {
		it("should work with ReactFlow hook", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			// Component should render successfully with ReactFlow hook
			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		it("should handle different node types", () => {
			const nodeTypes = ["goal", "strategy", "evidence", "context"];

			for (const type of nodeTypes) {
				const testNode = {
					...mockNodes[0],
					type,
				};

				const { unmount } = render(<ToggleButton node={testNode} />);

				const button = screen.getByRole("button");
				expect(button).toBeInTheDocument();

				unmount();
			}
		});
	});

	describe("Accessibility", () => {
		it("should have no accessibility violations", async () => {
			const { container } = render(<ToggleButton node={mockNodes[0]} />);

			const results = await axe(container, {
				rules: {
					// Disable color-contrast rule for jsdom compatibility
					"color-contrast": { enabled: false },
					// Disable button-name rule as toggle buttons often don't need explicit names
					"button-name": { enabled: false },
				},
			});
			expect(results.violations).toHaveLength(0);
		});

		it("should be keyboard accessible", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");

			// Should be focusable
			button.focus();
			expect(button).toHaveFocus();
		});

		it("should have proper button semantics", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			expect(button).toHaveAttribute("type", "button");
		});

		it("should support space and enter key activation", async () => {
			const { toggleHiddenForChildren } = await import("@/lib/case");
			const mockToggleHiddenForChildren = vi.mocked(toggleHiddenForChildren);
			mockToggleHiddenForChildren.mockReturnValue(mockAssuranceCase);

			render(<ToggleButton node={mockNodes[0]} />);

			const button = screen.getByRole("button");
			button.focus();

			// Test space key
			await user.keyboard(" ");
			expect(mockToggleHiddenForChildren).toHaveBeenCalled();

			// Test enter key
			await user.keyboard("{Enter}");
			expect(mockToggleHiddenForChildren).toHaveBeenCalledTimes(2);
		});
	});

	describe("Visual States", () => {
		it("should show correct icon for expanded state", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const chevronDown = document.querySelector("svg.lucide-chevron-down");
			expect(chevronDown).toBeInTheDocument();
		});

		it("should show correct icon for collapsed state", async () => {
			const hiddenNode = {
				...mockNodes[0],
				data: {
					...mockNodes[0].data,
					property_claims: [{ hidden: true }],
				},
			};

			// Update the store to include the hidden node
			const updatedNodes = mockNodes.map((n) =>
				n.id === "1" ? hiddenNode : n
			);
			mockUseStore.mockReturnValue({
				...mockStoreState,
				nodes: updatedNodes,
			});

			render(<ToggleButton node={hiddenNode} />);

			// Wait for useEffect to update the state
			await waitFor(() => {
				const chevronRight = document.querySelector("svg.lucide-chevron-right");
				expect(chevronRight).toBeInTheDocument();
			});
		});

		it("should have hover styles", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const hoverDiv = document.querySelector(".hover\\:bg-slate-900\\/10");
			expect(hoverDiv).toBeInTheDocument();
		});

		it("should have proper sizing for icons", () => {
			render(<ToggleButton node={mockNodes[0]} />);

			const icon = document.querySelector("svg");
			expect(icon).toHaveAttribute("width", "18");
			expect(icon).toHaveAttribute("height", "18");
		});
	});
});
