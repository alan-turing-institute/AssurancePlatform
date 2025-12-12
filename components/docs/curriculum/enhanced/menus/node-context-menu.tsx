"use client";
/**
 * Node Context Menu Component
 *
 * Context menu for nodes with node-specific actions based on type.
 * Supports single and multi-node selections.
 *
 * @module menus/NodeContextMenu
 */

import React, { useMemo } from "react";
import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { ContextMenu } from "./context-menu";
import { executeAction } from "./menu-actions";
import {
	filterMenuItems,
	getMultiSelectMenuConfig,
	getNodeMenuConfig,
} from "./menu-config";

/**
 * Clipboard state type
 */
type ClipboardState = {
	type: string;
	data: unknown;
} | null;

/**
 * Position type
 */
type Position = {
	x: number;
	y: number;
};

/**
 * Node context menu callbacks type
 */
type NodeContextMenuCallbacks = {
	onEdit?: (node: Node) => void;
	onDelete?: (node: Node) => void;
	onAddEvidence?: (node: Node) => void;
	onLinkSource?: (node: Node) => void;
	onViewDetails?: (node: Node) => void;
	onGroup?: (nodes: Node[]) => void;
	[key: string]: unknown;
};

/**
 * NodeContextMenu Component Props
 */
type NodeContextMenuProps = {
	isOpen?: boolean;
	position?: Position;
	node?: Node | Node[];
	nodes?: Node[];
	edges?: Edge[];
	setNodes?: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onClose?: () => void;
	callbacks?: NodeContextMenuCallbacks;
	clipboard?: ClipboardState;
	setClipboard?: (clipboard: ClipboardState) => void;
};

/**
 * NodeContextMenu Component
 */
export const NodeContextMenu = ({
	isOpen = false,
	position = { x: 0, y: 0 },
	node,
	nodes = [],
	edges = [],
	setNodes,
	setEdges,
	reactFlowInstance,
	onClose,
	callbacks = {},
	clipboard = null,
	setClipboard,
}: NodeContextMenuProps) => {
	/**
	 * Determine if this is a multi-select context
	 */
	const isMultiSelect = Array.isArray(node) && node.length > 1;

	let selectedNodes: Node[];
	let singleNode: Node | null = null;
	if (Array.isArray(node)) {
		selectedNodes = node;
		if (!isMultiSelect && node.length === 1) {
			singleNode = node[0];
		}
	} else if (node) {
		selectedNodes = [node];
		singleNode = node;
	} else {
		selectedNodes = [];
	}

	/**
	 * Get appropriate menu configuration
	 */
	const menuItems = useMemo(() => {
		if (isMultiSelect) {
			return getMultiSelectMenuConfig();
		}

		if (singleNode) {
			const nodeType = singleNode.type || "goal";
			const config = getNodeMenuConfig(nodeType);

			// Filter items based on current state
			return filterMenuItems(config, {
				node: singleNode,
				clipboard,
				checkClipboard: () => !!clipboard?.data,
			});
		}

		return [];
	}, [isMultiSelect, singleNode, clipboard]);

	/**
	 * Handle menu action
	 */
	const handleAction = (
		actionString: string,
		_context: unknown,
		event: React.MouseEvent
	) => {
		const actionContext = {
			// Single node context
			node: singleNode ?? undefined,

			// Multi-select context
			selectedNodes: isMultiSelect ? selectedNodes : undefined,

			// React Flow state
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,

			// Callbacks
			...callbacks,

			// Clipboard
			clipboard,
			setClipboard,

			// Event
			event,
		};

		executeAction(actionString, actionContext);
	};

	return (
		<ContextMenu
			context={{ node: singleNode, selectedNodes }}
			isOpen={isOpen}
			menuItems={menuItems}
			onAction={handleAction}
			onClose={onClose}
			position={position}
		/>
	);
};

/**
 * Context menu state type
 */
type NodeContextMenuState = {
	position: Position;
	node: Node | Node[];
} | null;

/**
 * useNodeContextMenu Hook params
 */
type UseNodeContextMenuParams = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: NodeContextMenuCallbacks;
};

/**
 * useNodeContextMenu Hook return type
 */
type UseNodeContextMenuReturn = {
	contextMenu: NodeContextMenuState;
	isOpen: boolean;
	position: Position | undefined;
	node: Node | Node[] | undefined;
	clipboard: ClipboardState;
	setClipboard: (clipboard: ClipboardState) => void;
	handleNodeContextMenu: (event: React.MouseEvent, node: Node) => void;
	closeContextMenu: () => void;
	NodeContextMenu: React.ReactNode;
};

/**
 * useNodeContextMenu Hook
 *
 * Hook for managing node context menu state
 */
export function useNodeContextMenu({
	nodes,
	edges,
	setNodes,
	setEdges,
	reactFlowInstance,
	callbacks = {},
}: UseNodeContextMenuParams): UseNodeContextMenuReturn {
	const [contextMenu, setContextMenu] =
		React.useState<NodeContextMenuState>(null);
	const [clipboard, setClipboard] = React.useState<ClipboardState>(null);

	/**
	 * Handle node right-click
	 */
	const handleNodeContextMenu = React.useCallback(
		(event: React.MouseEvent, node: Node) => {
			event.preventDefault();
			event.stopPropagation();

			// Check if this is part of a multi-selection
			const selectedNodes = nodes.filter((n) => n.selected);

			setContextMenu({
				position: { x: event.clientX, y: event.clientY },
				node: selectedNodes.length > 1 ? selectedNodes : node,
			});
		},
		[nodes]
	);

	/**
	 * Close context menu
	 */
	const closeContextMenu = React.useCallback(() => {
		setContextMenu(null);
	}, []);

	return {
		contextMenu,
		isOpen: !!contextMenu,
		position: contextMenu?.position,
		node: contextMenu?.node,
		clipboard,
		setClipboard,
		handleNodeContextMenu,
		closeContextMenu,
		// Render component
		NodeContextMenu: contextMenu ? (
			<NodeContextMenu
				callbacks={callbacks}
				clipboard={clipboard}
				edges={edges}
				isOpen={!!contextMenu}
				node={contextMenu.node}
				nodes={nodes}
				onClose={closeContextMenu}
				position={contextMenu.position}
				reactFlowInstance={reactFlowInstance}
				setClipboard={setClipboard}
				setEdges={setEdges}
				setNodes={setNodes}
			/>
		) : null,
	};
}

/**
 * NodeContextMenuWrapper Component Props
 */
type NodeContextMenuWrapperProps = {
	children: React.ReactElement;
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: NodeContextMenuCallbacks;
};

/**
 * NodeContextMenuWrapper Component
 *
 * Wrapper component that adds context menu to React Flow nodes
 */
export const NodeContextMenuWrapper = ({
	children,
	nodes,
	edges,
	setNodes,
	setEdges,
	reactFlowInstance,
	callbacks,
}: NodeContextMenuWrapperProps) => {
	const { handleNodeContextMenu, NodeContextMenu: NodeContextMenuComponent } =
		useNodeContextMenu({
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,
			callbacks,
		});

	return (
		<>
			{React.cloneElement(children, {
				onNodeContextMenu: handleNodeContextMenu,
			})}
			{NodeContextMenuComponent}
		</>
	);
};

/**
 * withNodeContextMenu HOC Props
 */
type WithNodeContextMenuProps = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
	nodeContextCallbacks?: NodeContextMenuCallbacks;
	[key: string]: unknown;
};

/**
 * withNodeContextMenu HOC
 *
 * Higher-order component to add node context menu to React Flow
 */
export function withNodeContextMenu<P extends WithNodeContextMenuProps>(
	ReactFlowComponent: React.ComponentType<P>
) {
	return function NodeContextMenuEnhanced(props: P) {
		const {
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,
			onNodeContextMenu,
			nodeContextCallbacks,
			...otherProps
		} = props;

		const { handleNodeContextMenu, NodeContextMenu: NodeContextMenuComponent } =
			useNodeContextMenu({
				nodes,
				edges,
				setNodes,
				setEdges,
				reactFlowInstance,
				callbacks: nodeContextCallbacks,
			});

		// Combine custom handler with hook handler
		const combinedHandler = React.useCallback(
			(event: React.MouseEvent, node: Node) => {
				handleNodeContextMenu(event, node);
				onNodeContextMenu?.(event, node);
			},
			[handleNodeContextMenu, onNodeContextMenu]
		);

		return (
			<>
				<ReactFlowComponent
					{...(otherProps as P)}
					edges={edges}
					nodes={nodes}
					onNodeContextMenu={combinedHandler}
					setEdges={setEdges}
					setNodes={setNodes}
				/>
				{NodeContextMenuComponent}
			</>
		);
	};
}

/**
 * Helper: Get node type label
 */
export function getNodeTypeLabel(nodeType: string): string {
	const labels: Record<string, string> = {
		goal: "Goal",
		strategy: "Strategy",
		propertyClaim: "Property Claim",
		evidence: "Evidence",
		context: "Context",
	};
	return labels[nodeType] || "Node";
}

/**
 * Helper: Get node type color
 */
export function getNodeTypeColor(nodeType: string): string {
	const colors: Record<string, string> = {
		goal: "green",
		strategy: "purple",
		propertyClaim: "orange",
		evidence: "cyan",
		context: "gray",
	};
	return colors[nodeType] || "blue";
}

export default NodeContextMenu;
