"use client";
/**
 * Edge Context Menu Component
 *
 * Context menu for edges with edge-specific actions.
 * Supports edge styling, type changes, and connection management.
 *
 * @module menus/EdgeContextMenu
 */

import React, { useMemo } from "react";
import type { Edge, ReactFlowInstance } from "reactflow";
import { ContextMenu } from "./context-menu";
import { executeAction } from "./menu-actions";
import { filterMenuItems, getEdgeMenuConfig } from "./menu-config";

/**
 * Position type
 */
type Position = {
	x: number;
	y: number;
};

/**
 * Edge context menu callbacks type
 */
type EdgeContextMenuCallbacks = {
	onEditLabel?: (edge: Edge) => void;
	onAddWaypoint?: (edge: Edge) => void;
	[key: string]: unknown;
};

/**
 * EdgeContextMenu Component Props
 */
type EdgeContextMenuProps = {
	isOpen?: boolean;
	position?: Position;
	edge?: Edge;
	edges?: Edge[];
	setEdges?: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onClose?: () => void;
	callbacks?: EdgeContextMenuCallbacks;
};

/**
 * EdgeContextMenu Component
 */
export const EdgeContextMenu = ({
	isOpen = false,
	position = { x: 0, y: 0 },
	edge,
	edges = [],
	setEdges,
	reactFlowInstance,
	onClose,
	callbacks = {},
}: EdgeContextMenuProps) => {
	/**
	 * Get edge menu configuration
	 */
	const menuItems = useMemo(() => {
		if (!edge) {
			return [];
		}

		const config = getEdgeMenuConfig();

		// Filter items based on current state
		return filterMenuItems(config, { edge });
	}, [edge]);

	/**
	 * Handle menu action
	 */
	const handleAction = (
		actionString: string,
		_context: unknown,
		event: React.MouseEvent
	) => {
		const actionContext = {
			edge,
			edges,
			setEdges,
			reactFlowInstance,
			...callbacks,
			event,
		};

		executeAction(actionString, actionContext);
	};

	return (
		<ContextMenu
			context={{ edge }}
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
type EdgeContextMenuState = {
	position: Position;
	edge: Edge;
} | null;

/**
 * useEdgeContextMenu Hook params
 */
type UseEdgeContextMenuParams = {
	edges: Edge[];
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: EdgeContextMenuCallbacks;
};

/**
 * useEdgeContextMenu Hook return type
 */
type UseEdgeContextMenuReturn = {
	contextMenu: EdgeContextMenuState;
	isOpen: boolean;
	position: Position | undefined;
	edge: Edge | undefined;
	handleEdgeContextMenu: (event: React.MouseEvent, edge: Edge) => void;
	closeContextMenu: () => void;
	EdgeContextMenu: React.ReactNode;
};

/**
 * useEdgeContextMenu Hook
 *
 * Hook for managing edge context menu state
 */
export function useEdgeContextMenu({
	edges,
	setEdges,
	reactFlowInstance,
	callbacks = {},
}: UseEdgeContextMenuParams): UseEdgeContextMenuReturn {
	const [contextMenu, setContextMenu] =
		React.useState<EdgeContextMenuState>(null);

	/**
	 * Handle edge right-click
	 */
	const handleEdgeContextMenu = React.useCallback(
		(event: React.MouseEvent, edge: Edge) => {
			event.preventDefault();
			event.stopPropagation();

			setContextMenu({
				position: { x: event.clientX, y: event.clientY },
				edge,
			});
		},
		[]
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
		edge: contextMenu?.edge,
		handleEdgeContextMenu,
		closeContextMenu,
		// Render component
		EdgeContextMenu: contextMenu ? (
			<EdgeContextMenu
				callbacks={callbacks}
				edge={contextMenu.edge}
				edges={edges}
				isOpen={!!contextMenu}
				onClose={closeContextMenu}
				position={contextMenu.position}
				reactFlowInstance={reactFlowInstance}
				setEdges={setEdges}
			/>
		) : null,
	};
}

/**
 * EdgeContextMenuWrapper Component Props
 */
type EdgeContextMenuWrapperProps = {
	children: React.ReactElement;
	edges: Edge[];
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	callbacks?: EdgeContextMenuCallbacks;
};

/**
 * EdgeContextMenuWrapper Component
 *
 * Wrapper component that adds context menu to React Flow edges
 */
export const EdgeContextMenuWrapper = ({
	children,
	edges,
	setEdges,
	reactFlowInstance,
	callbacks,
}: EdgeContextMenuWrapperProps) => {
	const { handleEdgeContextMenu, EdgeContextMenu: EdgeContextMenuComponent } =
		useEdgeContextMenu({
			edges,
			setEdges,
			reactFlowInstance,
			callbacks,
		});

	return (
		<>
			{React.cloneElement(children, {
				onEdgeContextMenu: handleEdgeContextMenu,
			})}
			{EdgeContextMenuComponent}
		</>
	);
};

/**
 * withEdgeContextMenu HOC Props
 */
type WithEdgeContextMenuProps = {
	edges: Edge[];
	setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
	reactFlowInstance?: ReactFlowInstance;
	onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
	edgeContextCallbacks?: EdgeContextMenuCallbacks;
	[key: string]: unknown;
};

/**
 * withEdgeContextMenu HOC
 *
 * Higher-order component to add edge context menu to React Flow
 */
export function withEdgeContextMenu<P extends WithEdgeContextMenuProps>(
	ReactFlowComponent: React.ComponentType<P>
) {
	return function EdgeContextMenuEnhanced(props: P) {
		const {
			edges,
			setEdges,
			reactFlowInstance,
			onEdgeContextMenu,
			edgeContextCallbacks,
			...otherProps
		} = props;

		const { handleEdgeContextMenu, EdgeContextMenu: EdgeContextMenuComponent } =
			useEdgeContextMenu({
				edges,
				setEdges,
				reactFlowInstance,
				callbacks: edgeContextCallbacks,
			});

		// Combine custom handler with hook handler
		const combinedHandler = React.useCallback(
			(event: React.MouseEvent, edge: Edge) => {
				handleEdgeContextMenu(event, edge);
				onEdgeContextMenu?.(event, edge);
			},
			[handleEdgeContextMenu, onEdgeContextMenu]
		);

		return (
			<>
				<ReactFlowComponent
					{...(otherProps as P)}
					edges={edges}
					onEdgeContextMenu={combinedHandler}
					setEdges={setEdges}
				/>
				{EdgeContextMenuComponent}
			</>
		);
	};
}

/**
 * Helper: Get edge type label
 */
export function getEdgeTypeLabel(edgeType: string): string {
	const labels: Record<string, string> = {
		default: "Bezier",
		straight: "Straight",
		step: "Step",
		smoothstep: "Smooth Step",
		simplebezier: "Simple Bezier",
	};
	return labels[edgeType] || "Default";
}

/**
 * Edge style preset type
 */
type EdgeStylePreset = {
	strokeDasharray?: string;
	stroke?: string;
	animated: boolean;
	description: string;
};

/**
 * Helper: Get edge style presets
 */
export function getEdgeStylePresets(): Record<string, EdgeStylePreset> {
	return {
		solid: {
			strokeDasharray: "none",
			animated: false,
			description: "Solid line",
		},
		dashed: {
			strokeDasharray: "5 5",
			animated: false,
			description: "Dashed line",
		},
		dotted: {
			strokeDasharray: "1 3",
			animated: false,
			description: "Dotted line",
		},
		animated: {
			strokeDasharray: "5 5",
			animated: true,
			description: "Animated dashed line",
		},
		gradient: {
			stroke: "url(#edge-gradient)",
			animated: false,
			description: "Gradient colored line",
		},
	};
}

/**
 * Helper: Apply edge style preset
 */
export function applyEdgeStylePreset(edge: Edge, presetName: string): Edge {
	const presets = getEdgeStylePresets();
	const preset = presets[presetName];

	if (!preset) {
		return edge;
	}

	return {
		...edge,
		style: {
			...edge.style,
			strokeDasharray: preset.strokeDasharray,
			stroke: preset.stroke || edge.style?.stroke,
		},
		animated: preset.animated,
	};
}

export default EdgeContextMenu;
