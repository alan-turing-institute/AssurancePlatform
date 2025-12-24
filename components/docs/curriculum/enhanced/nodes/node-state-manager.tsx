"use client";
/**
 * NodeStateManager Component
 *
 * Provides a React Context-based state management system for collapsible nodes.
 * Acts as a centralised state provider that wraps React Flow components to enable
 * shared state management across all collapsible nodes.
 *
 * Features:
 * - Context-based state sharing
 * - Integration with useNodeState hook
 * - Auto-sync with React Flow nodes
 * - Toolbar controls for bulk operations
 * - Performance optimised with memoisation
 *
 * @component
 * @example
 * <NodeStateManager persistKey="my-flow">
 *   <ReactFlow nodes={nodes} edges={edges} />
 * </NodeStateManager>
 */

import type { ComponentType, JSX, ReactNode } from "react";
import {
	createContext,
	forwardRef,
	useCallback,
	useContext,
	useMemo,
} from "react";
import type { Edge, Node } from "reactflow";
import { useEdges, useNodes } from "reactflow";
import useNodeState from "./use-node-state";

// ========================================================================
// Type Definitions
// ========================================================================

type NodeStateStats = {
	total: number;
	expanded: number;
	collapsed: number;
};

type NodeStatesMap = Record<string, boolean>;

type UseNodeStateReturn = {
	nodeStates: NodeStatesMap;
	isNodeExpanded: (nodeId: string) => boolean;
	toggleNode: (nodeId: string) => void;
	expandNode: (nodeId: string) => void;
	collapseNode: (nodeId: string) => void;
	setNodeState: (nodeId: string, expanded: boolean) => void;
	expandNodes: (nodeIds: string[]) => void;
	collapseNodes: (nodeIds: string[]) => void;
	expandAll: (allNodeIds: string[]) => void;
	collapseAll: (allNodeIds: string[]) => void;
	focusMode: (focusNodeIds: string[], allNodeIds: string[]) => void;
	expandPathToNode: (nodeId: string, nodes: Node[], edges: Edge[]) => void;
	expandNodeTree: (nodeId: string, nodes: Node[], edges: Edge[]) => void;
	resetAll: () => void;
	getStats: () => NodeStateStats;
};

type NodeStateContextValue = Omit<
	UseNodeStateReturn,
	| "expandNodeTree"
	| "expandPathToNode"
	| "focusMode"
	| "expandAll"
	| "collapseAll"
> & {
	// Wrapped functions with simplified signatures (nodes/edges provided from context)
	expandNodeTree: (nodeId: string) => void;
	expandPathToNode: (nodeId: string) => void;
	focusMode: (focusNodeIds: string[]) => void;
	expandAll: () => void;
	collapseAll: () => void;
	// Additional context values
	allNodeIds: string[];
	nodes: Node[];
	edges: Edge[];
};

type StateChangeEvent = {
	operation: string;
	args: unknown[];
	stats: NodeStateStats;
	nodeStates: NodeStatesMap;
};

type NodeStateManagerProps = {
	children: ReactNode;
	persistKey?: string | null;
	defaultExpanded?: boolean;
	autoExpandOnSelect?: boolean;
	debounceMs?: number;
	onStateChange?: (event: StateChangeEvent) => void;
	showControls?: boolean;
	className?: string;
};

type NodeStateControlsProps = {
	className?: string;
};

// ========================================================================
// Context
// ========================================================================

/**
 * Node State Context
 * Provides state management functions to all child components
 */
export const NodeStateContext = createContext<NodeStateContextValue | null>(
	null
);

/**
 * Custom hook to access node state context
 */
export const useNodeStateContext = (): NodeStateContextValue => {
	const context = useContext(NodeStateContext);

	if (!context) {
		throw new Error(
			"useNodeStateContext must be used within a NodeStateManager"
		);
	}

	return context;
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * NodeStateManager Component
 */
const NodeStateManager = ({
	children,
	persistKey = null,
	defaultExpanded = false,
	autoExpandOnSelect = true,
	debounceMs = 100,
	onStateChange,
	showControls = false,
	className = "",
}: NodeStateManagerProps): JSX.Element => {
	// Get React Flow nodes and edges (if inside ReactFlow context)
	const nodes = useNodes();
	const edges = useEdges();

	// Initialize node state hook
	const nodeStateHook = useNodeState({
		persistKey,
		defaultExpanded,
		autoExpandOnSelect,
		debounceMs,
	});

	// Extract all node IDs
	const allNodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);

	// Handle state change callbacks
	const handleStateChange = useCallback(
		(operation: string, ...args: unknown[]) => {
			if (onStateChange) {
				onStateChange({
					operation,
					args,
					stats: nodeStateHook.getStats(),
					nodeStates: nodeStateHook.nodeStates,
				});
			}
		},
		[onStateChange, nodeStateHook]
	);

	// Wrapped operations with change callbacks
	const wrappedOperations = useMemo(
		() => ({
			...nodeStateHook,

			// Override operations to include callbacks
			toggleNode: (nodeId: string) => {
				nodeStateHook.toggleNode(nodeId);
				handleStateChange("toggle", nodeId);
			},

			expandNode: (nodeId: string) => {
				nodeStateHook.expandNode(nodeId);
				handleStateChange("expand", nodeId);
			},

			collapseNode: (nodeId: string) => {
				nodeStateHook.collapseNode(nodeId);
				handleStateChange("collapse", nodeId);
			},

			expandAll: () => {
				nodeStateHook.expandAll(allNodeIds);
				handleStateChange("expandAll");
			},

			collapseAll: () => {
				nodeStateHook.collapseAll(allNodeIds);
				handleStateChange("collapseAll");
			},

			focusMode: (focusNodeIds: string[]) => {
				nodeStateHook.focusMode(focusNodeIds, allNodeIds);
				handleStateChange("focusMode", focusNodeIds);
			},

			expandPathToNode: (nodeId: string) => {
				nodeStateHook.expandPathToNode(nodeId, nodes, edges);
				handleStateChange("expandPath", nodeId);
			},

			expandNodeTree: (nodeId: string) => {
				nodeStateHook.expandNodeTree(nodeId, nodes, edges);
				handleStateChange("expandTree", nodeId);
			},

			resetAll: () => {
				nodeStateHook.resetAll();
				handleStateChange("reset");
			},

			// Additional utilities
			allNodeIds,
			nodes,
			edges,
		}),
		[nodeStateHook, allNodeIds, nodes, edges, handleStateChange]
	);

	// Context value (memoised for performance)
	const contextValue = useMemo(() => wrappedOperations, [wrappedOperations]);

	return (
		<NodeStateContext.Provider value={contextValue}>
			<div className={className}>
				{showControls && <NodeStateControls />}
				{children}
			</div>
		</NodeStateContext.Provider>
	);
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * NodeStateControls Component
 * Built-in toolbar controls for bulk operations
 */
export const NodeStateControls = ({
	className = "",
}: NodeStateControlsProps): JSX.Element => {
	const { expandAll, collapseAll, resetAll, getStats } = useNodeStateContext();

	const stats = getStats();

	return (
		<div
			className={`f-effect-backdrop-blur-lg flex items-center gap-2 rounded-lg border border-transparent bg-background-transparent-black p-2 shadow-glassmorphic ${className}`}
		>
			{/* Stats Display */}
			<div className="px-2 text-text-light/70 text-xs">
				<span className="font-semibold text-text-light">{stats.expanded}</span>
				{" / "}
				<span>{stats.total}</span>
				{" expanded"}
			</div>

			{/* Divider */}
			<div className="h-6 w-px bg-border-transparent" />

			{/* Expand All Button */}
			<button
				className="rounded-md bg-background-transparent-white-hover px-3 py-1.5 font-medium text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
				onClick={expandAll}
				title="Expand all nodes"
				type="button"
			>
				Expand All
			</button>

			{/* Collapse All Button */}
			<button
				className="rounded-md bg-background-transparent-white-hover px-3 py-1.5 font-medium text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
				onClick={collapseAll}
				title="Collapse all nodes"
				type="button"
			>
				Collapse All
			</button>

			{/* Reset Button */}
			<button
				className="rounded-md bg-transparent px-3 py-1.5 font-medium text-text-light/70 text-xs transition-colors duration-200 hover:bg-background-transparent-white-hover hover:text-text-light"
				onClick={resetAll}
				title="Reset to defaults"
				type="button"
			>
				Reset
			</button>
		</div>
	);
};

// ========================================================================
// Utility Hooks
// ========================================================================

/**
 * Custom hook for accessing node state with automatic node/edge context
 * Convenience wrapper around useNodeStateContext with enhanced utilities
 */
export const useNodeStateWithFlow = () => {
	const context = useNodeStateContext();

	// Enhanced utilities that use React Flow context
	const enhancedUtilities = useMemo(
		() => ({
			...context,

			/**
			 * Toggle node and optionally expand/collapse children
			 */
			toggleNodeRecursive: (nodeId: string, recursive = false) => {
				if (!recursive) {
					context.toggleNode(nodeId);
					return;
				}

				const isExpanded = context.isNodeExpanded(nodeId);
				if (isExpanded) {
					// Collapse this node and all children
					const childIds = context.edges
						.filter((edge) => edge.source === nodeId)
						.map((edge) => edge.target);
					context.collapseNodes([nodeId, ...childIds]);
				} else {
					// Expand this node only
					context.expandNode(nodeId);
				}
			},

			/**
			 * Expand selected nodes only
			 */
			expandSelected: (selectedNodeIds: string[]) => {
				context.focusMode(selectedNodeIds);
			},

			/**
			 * Get expansion state for all nodes as a map
			 */
			getExpansionMap: () => {
				const map = new Map();
				for (const id of context.allNodeIds) {
					map.set(id, context.isNodeExpanded(id));
				}
				return map;
			},
		}),
		[context]
	);

	return enhancedUtilities;
};

/**
 * Higher-Order Component to inject node state props
 */
type WithNodeStateProps = {
	nodeState: NodeStateContextValue;
};

export function withNodeState<P extends WithNodeStateProps>(
	Component: ComponentType<P>
) {
	return forwardRef<unknown, Omit<P, "nodeState">>((props, ref) => {
		const nodeState = useNodeStateContext();

		return (
			<Component ref={ref} {...(props as unknown as P)} nodeState={nodeState} />
		);
	});
}

export default NodeStateManager;
