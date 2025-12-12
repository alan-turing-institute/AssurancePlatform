"use client";
/**
 * Canvas Context Menu Component
 *
 * Context menu for canvas/pane with canvas-specific actions.
 * Supports node creation, layout, selection, and export.
 *
 * @module menus/CanvasContextMenu
 */

import React, { useMemo } from "react";
import type { Edge, Node, ReactFlowInstance } from "reactflow";
import { ContextMenu } from "./context-menu";
import { executeAction } from "./menu-actions";
import { filterMenuItems, getCanvasMenuConfig } from "./menu-config";

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
 * Canvas context menu callbacks type
 */
type CanvasContextMenuCallbacks = {
	onCreate?: (nodeType: string, position: Position) => void;
	onAutoLayout?: (layoutType: string, nodes: Node[], edges: Edge[]) => void;
	[key: string]: unknown;
};

/**
 * CanvasContextMenu Component Props
 */
type CanvasContextMenuProps = {
	isOpen?: boolean;
	position?: Position;
	nodes?: Node[];
	edges?: Edge[];
	setNodes?: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onClose?: () => void;
	callbacks?: CanvasContextMenuCallbacks;
	clipboard?: ClipboardState;
	setClipboard?: (clipboard: ClipboardState) => void;
};

/**
 * CanvasContextMenu Component
 */
export const CanvasContextMenu = ({
	isOpen = false,
	position = { x: 0, y: 0 },
	nodes = [],
	edges = [],
	setNodes,
	setEdges,
	reactFlowInstance,
	onClose,
	callbacks = {},
	clipboard = null,
	setClipboard,
}: CanvasContextMenuProps) => {
	/**
	 * Convert screen position to flow coordinates
	 */
	const flowPosition = useMemo(() => {
		if (!(reactFlowInstance && position)) {
			return position;
		}

		try {
			return reactFlowInstance.screenToFlowPosition({
				x: position.x,
				y: position.y,
			});
		} catch (error) {
			console.warn("Could not convert to flow position:", error);
			return position;
		}
	}, [reactFlowInstance, position]);

	/**
	 * Get canvas menu configuration
	 */
	const menuItems = useMemo(() => {
		const config = getCanvasMenuConfig();

		// Filter items based on current state
		return filterMenuItems(config, {
			clipboard,
			checkClipboard: () => !!clipboard?.data,
		});
	}, [clipboard]);

	/**
	 * Handle menu action
	 */
	const handleAction = (
		actionString: string,
		_context: unknown,
		event: React.MouseEvent
	) => {
		const actionContext = {
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,
			position: flowPosition, // Use flow coordinates for node creation
			clipboard,
			setClipboard,
			...callbacks,
			event,
		};

		executeAction(actionString, actionContext);
	};

	return (
		<ContextMenu
			context={{ position: flowPosition }}
			isOpen={isOpen}
			menuItems={menuItems}
			onAction={handleAction}
			onClose={onClose}
			position={position} // Use screen coordinates for menu positioning
		/>
	);
};

/**
 * Context menu state type
 */
type ContextMenuState = {
	position: Position;
} | null;

/**
 * useCanvasContextMenu Hook params
 */
type UseCanvasContextMenuParams = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: CanvasContextMenuCallbacks;
};

/**
 * useCanvasContextMenu Hook return type
 */
type UseCanvasContextMenuReturn = {
	contextMenu: ContextMenuState;
	isOpen: boolean;
	position: Position | undefined;
	clipboard: ClipboardState;
	setClipboard: (clipboard: ClipboardState) => void;
	handlePaneContextMenu: (event: React.MouseEvent) => void;
	closeContextMenu: () => void;
	CanvasContextMenu: React.ReactNode;
};

/**
 * useCanvasContextMenu Hook
 *
 * Hook for managing canvas context menu state
 */
export function useCanvasContextMenu({
	nodes,
	edges,
	setNodes,
	setEdges,
	reactFlowInstance,
	callbacks = {},
}: UseCanvasContextMenuParams): UseCanvasContextMenuReturn {
	const [contextMenu, setContextMenu] = React.useState<ContextMenuState>(null);
	const [clipboard, setClipboard] = React.useState<ClipboardState>(null);

	/**
	 * Handle pane/canvas right-click
	 */
	const handlePaneContextMenu = React.useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		setContextMenu({
			position: { x: event.clientX, y: event.clientY },
		});
	}, []);

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
		clipboard,
		setClipboard,
		handlePaneContextMenu,
		closeContextMenu,
		// Render component
		CanvasContextMenu: contextMenu ? (
			<CanvasContextMenu
				callbacks={callbacks}
				clipboard={clipboard}
				edges={edges}
				isOpen={!!contextMenu}
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
 * CanvasContextMenuWrapper Component Props
 */
type CanvasContextMenuWrapperProps = {
	children: React.ReactElement;
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: CanvasContextMenuCallbacks;
};

/**
 * CanvasContextMenuWrapper Component
 *
 * Wrapper component that adds context menu to React Flow canvas
 */
export const CanvasContextMenuWrapper = ({
	children,
	nodes,
	edges,
	setNodes,
	setEdges,
	reactFlowInstance,
	callbacks,
}: CanvasContextMenuWrapperProps) => {
	const {
		handlePaneContextMenu,
		CanvasContextMenu: CanvasContextMenuComponent,
	} = useCanvasContextMenu({
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
				onPaneContextMenu: handlePaneContextMenu,
			})}
			{CanvasContextMenuComponent}
		</>
	);
};

/**
 * withCanvasContextMenu HOC Props
 */
type WithCanvasContextMenuProps = {
	nodes: Node[];
	edges: Edge[];
	setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void;
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onPaneContextMenu?: (event: React.MouseEvent) => void;
	canvasContextCallbacks?: CanvasContextMenuCallbacks;
	[key: string]: unknown;
};

/**
 * withCanvasContextMenu HOC
 *
 * Higher-order component to add canvas context menu to React Flow
 */
export function withCanvasContextMenu<P extends WithCanvasContextMenuProps>(
	ReactFlowComponent: React.ComponentType<P>
) {
	return function CanvasContextMenuEnhanced(props: P) {
		const {
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,
			onPaneContextMenu,
			canvasContextCallbacks,
			...otherProps
		} = props;

		const {
			handlePaneContextMenu,
			CanvasContextMenu: CanvasContextMenuComponent,
		} = useCanvasContextMenu({
			nodes,
			edges,
			setNodes,
			setEdges,
			reactFlowInstance,
			callbacks: canvasContextCallbacks,
		});

		// Combine custom handler with hook handler
		const combinedHandler = React.useCallback(
			(event: React.MouseEvent) => {
				handlePaneContextMenu(event);
				onPaneContextMenu?.(event);
			},
			[handlePaneContextMenu, onPaneContextMenu]
		);

		return (
			<>
				<ReactFlowComponent
					{...(otherProps as P)}
					edges={edges}
					nodes={nodes}
					onPaneContextMenu={combinedHandler}
					setEdges={setEdges}
					setNodes={setNodes}
				/>
				{CanvasContextMenuComponent}
			</>
		);
	};
}

/**
 * Helper: Get grid snap position
 */
export function snapToGrid(position: Position, gridSize = 15): Position {
	return {
		x: Math.round(position.x / gridSize) * gridSize,
		y: Math.round(position.y / gridSize) * gridSize,
	};
}

/**
 * Helper: Check if position is empty (no nodes nearby)
 */
export function isPositionEmpty(
	position: Position,
	nodes: Node[],
	threshold = 50
): boolean {
	return !nodes.some((node) => {
		const distance = Math.sqrt(
			(node.position.x - position.x) ** 2 + (node.position.y - position.y) ** 2
		);
		return distance < threshold;
	});
}

/**
 * Helper: Find optimal position for new node
 */
export function findOptimalPosition(
	requestedPosition: Position,
	nodes: Node[],
	gridSize = 15
): Position {
	let position = snapToGrid(requestedPosition, gridSize);

	// If position is occupied, offset it
	if (!isPositionEmpty(position, nodes)) {
		position = {
			x: position.x + gridSize * 2,
			y: position.y + gridSize * 2,
		};
	}

	return position;
}

export default CanvasContextMenu;
