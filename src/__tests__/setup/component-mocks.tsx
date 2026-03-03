import type React from "react";
import { vi } from "vitest";

// ============================================
// ReactFlow mock
// ============================================

const mockReactFlowStore = {
	getState: vi.fn(() => ({
		nodes: [],
		edges: [],
		nodeInternals: new Map(),
		onNodesChange: vi.fn(),
		onEdgesChange: vi.fn(),
		onConnect: vi.fn(),
		fitView: vi.fn(),
		zoomIn: vi.fn(),
		zoomOut: vi.fn(),
		setNodes: vi.fn(),
		setEdges: vi.fn(),
		addNodes: vi.fn(),
		addEdges: vi.fn(),
		getNode: vi.fn(),
		getNodes: vi.fn(() => []),
		getEdges: vi.fn(() => []),
	})),
	setState: vi.fn(),
	subscribe: vi.fn(() => vi.fn()),
	destroy: vi.fn(),
};

vi.mock("reactflow", () => {
	const ReactLib = require("react");
	return {
		default: ({
			children,
			...props
		}: {
			children?: React.ReactNode;
			[key: string]: unknown;
		}) => {
			const MockReactFlowProvider = ({
				children: providerChildren,
			}: {
				children: React.ReactNode;
			}) =>
				ReactLib.createElement(
					"div",
					{ "data-testid": "react-flow-provider" },
					providerChildren
				);
			return ReactLib.createElement(
				MockReactFlowProvider,
				{},
				ReactLib.createElement(
					"div",
					{ "data-testid": "react-flow", ...props },
					children
				)
			);
		},
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
			ReactLib.createElement(
				"div",
				{ "data-testid": "react-flow-provider" },
				children
			),
		MiniMap: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-minimap",
			}),
		Controls: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-controls",
			}),
		Background: () =>
			ReactLib.createElement("div", {
				"data-testid": "react-flow-background",
			}),
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNode: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
			setNodes: vi.fn(),
			setEdges: vi.fn(),
			getIntersectingNodes: vi.fn(() => []),
			project: vi.fn((position) => position),
			toObject: vi.fn(() => ({
				nodes: [],
				edges: [],
				viewport: { x: 0, y: 0, zoom: 1 },
			})),
		}),
		useStore: () => mockReactFlowStore.getState(),
		useStoreApi: () => mockReactFlowStore,
		addEdge: vi.fn((params, edges) => [...edges, params]),
		applyNodeChanges: vi.fn((_changes, nodes) => nodes),
		applyEdgeChanges: vi.fn((_changes, edges) => edges),
		useNodesState: () => [[], vi.fn(), vi.fn()],
		useEdgesState: () => [[], vi.fn(), vi.fn()],
		Handle: ({
			type,
			position,
			id,
		}: {
			type: string;
			position: string;
			id?: string;
		}) =>
			ReactLib.createElement("div", {
				"data-testid": `handle-${type}-${position}`,
				"data-id": id,
			}),
		Position: {
			Top: "top",
			Right: "right",
			Bottom: "bottom",
			Left: "left",
		},
		MarkerType: {
			Arrow: "arrow",
			ArrowClosed: "arrowclosed",
		},
	};
});

// ============================================
// Radix UI mocks
// ============================================

vi.mock("@radix-ui/react-dialog", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockDialogRoot,
		Trigger: mocks.MockDialogTrigger,
		Portal: mocks.MockDialogPortal,
		Overlay: mocks.MockDialogOverlay,
		Content: mocks.MockDialogContent,
		Close: mocks.MockDialogClose,
		Title: mocks.MockDialogTitle,
		Description: mocks.MockDialogDescription,
		Dialog: mocks.MockDialogRoot,
		DialogTrigger: mocks.MockDialogTrigger,
		DialogPortal: mocks.MockDialogPortal,
		DialogOverlay: mocks.MockDialogOverlay,
		DialogContent: mocks.MockDialogContent,
		DialogClose: mocks.MockDialogClose,
		DialogTitle: mocks.MockDialogTitle,
		DialogDescription: mocks.MockDialogDescription,
	};
});

vi.mock("@radix-ui/react-tooltip", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockTooltipRoot,
		Trigger: mocks.MockTooltipTrigger,
		Portal: ({ children }: { children: React.ReactNode }) => children,
		Content: mocks.MockTooltipContent,
		Arrow: mocks.MockTooltipArrow,
		Provider: mocks.MockTooltipProvider,
	};
});

vi.mock("@radix-ui/react-popover", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockPopoverRoot,
		Trigger: mocks.MockPopoverTrigger,
		Portal: mocks.MockPopoverPortal,
		Content: mocks.MockPopoverContent,
		Arrow: mocks.MockPopoverArrow,
		Close: mocks.MockPopoverClose,
		Anchor: mocks.MockPopoverAnchor,
	};
});

vi.mock("@radix-ui/react-radio-group", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockRadioGroupRoot,
		Item: mocks.MockRadioGroupItem,
		Indicator: mocks.MockRadioGroupIndicator,
		RadioGroup: mocks.MockRadioGroupRoot,
		RadioGroupItem: mocks.MockRadioGroupItem,
		RadioGroupIndicator: mocks.MockRadioGroupIndicator,
	};
});

vi.mock("@radix-ui/react-select", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockSelectRoot,
		Trigger: mocks.MockSelectTrigger,
		Value: mocks.MockSelectValue,
		Icon: mocks.MockSelectIcon,
		Portal: mocks.MockSelectPortal,
		Content: mocks.MockSelectContent,
		Viewport: mocks.MockSelectViewport,
		Item: mocks.MockSelectItem,
		ItemText: mocks.MockSelectItemText,
		ItemIndicator: mocks.MockSelectItemIndicator,
		Group: mocks.MockSelectGroup,
		Label: mocks.MockSelectLabel,
		Separator: mocks.MockSelectSeparator,
		ScrollUpButton: mocks.MockSelectScrollUpButton,
		ScrollDownButton: mocks.MockSelectScrollDownButton,
	};
});

vi.mock("@radix-ui/react-dropdown-menu", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockDropdownMenuRoot,
		Trigger: mocks.MockDropdownMenuTrigger,
		Portal: mocks.MockDropdownMenuPortal,
		Content: mocks.MockDropdownMenuContent,
		Item: mocks.MockDropdownMenuItem,
		Separator: mocks.MockDropdownMenuSeparator,
		Label: mocks.MockDropdownMenuLabel,
		Group: mocks.MockDropdownMenuGroup,
		Sub: mocks.MockDropdownMenuSub,
		SubTrigger: mocks.MockDropdownMenuSubTrigger,
		SubContent: mocks.MockDropdownMenuSubContent,
		RadioGroup: mocks.MockDropdownMenuRadioGroup,
		RadioItem: mocks.MockDropdownMenuRadioItem,
		CheckboxItem: mocks.MockDropdownMenuCheckboxItem,
		ItemIndicator: mocks.MockDropdownMenuItemIndicator,
		DropdownMenu: mocks.MockDropdownMenuRoot,
		DropdownMenuTrigger: mocks.MockDropdownMenuTrigger,
		DropdownMenuPortal: mocks.MockDropdownMenuPortal,
		DropdownMenuContent: mocks.MockDropdownMenuContent,
		DropdownMenuItem: mocks.MockDropdownMenuItem,
		DropdownMenuSeparator: mocks.MockDropdownMenuSeparator,
		DropdownMenuLabel: mocks.MockDropdownMenuLabel,
		DropdownMenuGroup: mocks.MockDropdownMenuGroup,
		DropdownMenuSub: mocks.MockDropdownMenuSub,
		DropdownMenuSubTrigger: mocks.MockDropdownMenuSubTrigger,
		DropdownMenuSubContent: mocks.MockDropdownMenuSubContent,
		DropdownMenuRadioGroup: mocks.MockDropdownMenuRadioGroup,
		DropdownMenuRadioItem: mocks.MockDropdownMenuRadioItem,
		DropdownMenuCheckboxItem: mocks.MockDropdownMenuCheckboxItem,
		DropdownMenuItemIndicator: mocks.MockDropdownMenuItemIndicator,
	};
});

vi.mock("@radix-ui/react-menu", async () => {
	const mocks = await import("../mocks/radix-ui-mocks");
	return {
		Root: mocks.MockMenuRoot,
		Trigger: mocks.MockMenuTrigger,
		Portal: mocks.MockMenuPortal,
		Content: mocks.MockMenuContent,
		Item: mocks.MockMenuItem,
		Separator: mocks.MockMenuSeparator,
		Label: mocks.MockMenuLabel,
		Group: mocks.MockMenuGroup,
		Sub: mocks.MockMenuSub,
		SubTrigger: mocks.MockMenuSubTrigger,
		SubContent: mocks.MockMenuSubContent,
		Menu: mocks.MockMenuRoot,
		MenuTrigger: mocks.MockMenuTrigger,
		MenuPortal: mocks.MockMenuPortal,
		MenuContent: mocks.MockMenuContent,
		MenuItem: mocks.MockMenuItem,
		MenuSeparator: mocks.MockMenuSeparator,
		MenuLabel: mocks.MockMenuLabel,
		MenuGroup: mocks.MockMenuGroup,
		MenuSub: mocks.MockMenuSub,
		MenuSubTrigger: mocks.MockMenuSubTrigger,
		MenuSubContent: mocks.MockMenuSubContent,
	};
});
