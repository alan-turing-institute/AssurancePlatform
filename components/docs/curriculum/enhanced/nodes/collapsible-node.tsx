"use client";
/**
 * CollapsibleNode Component
 *
 * Wrapper around BaseNode that integrates with NodeStateManager for centralised
 * collapse/expand state management. Provides all the features of BaseNode plus
 * automatic state synchronisation with the global state manager.
 *
 * Features:
 * - Automatic state sync with NodeStateManager
 * - Click to expand/collapse behaviour
 * - Double-click to expand and reveal connected nodes
 * - Auto-expand when node is selected
 * - Smooth height transitions using Framer Motion
 * - Progressive disclosure of connected nodes
 * - Focus mode support
 *
 * @component
 * @example
 * <CollapsibleNode
 *   id="node-1"
 *   data={{ name: 'Goal', description: 'Top-level goal' }}
 *   selected={false}
 *   nodeType="goal"
 * />
 */

import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { memo, useCallback, useContext, useEffect, useState } from "react";
import BaseNode from "./base-node";
import { NodeStateContext } from "./node-state-manager";

// ========================================================================
// Type Definitions
// ========================================================================

type NodeData = {
	id?: string;
	name?: string;
	description?: string;
	[key: string]: unknown;
};

type CollapsibleNodeProps = {
	id?: string;
	data?: NodeData;
	selected?: boolean;
	isConnectable?: boolean;
	children?: ReactNode;
	nodeType?: string;
	defaultExpanded?: boolean;
	onExpandChange?: (expanded: boolean) => void;
	onClick?: (event: MouseEvent) => void;
	onDoubleClick?: (event: MouseEvent) => void;
	enableDoubleClickExpand?: boolean;
	autoExpandOnSelect?: boolean;
	className?: string;
	[key: string]: unknown;
};

type FocusCollapsibleNodeProps = {
	id?: string;
	data?: NodeData;
	onExpandChange?: (isExpanded: boolean) => void;
} & Omit<CollapsibleNodeProps, "id" | "data" | "onExpandChange">;

type ProgressiveCollapsibleNodeProps = {
	id?: string;
	data?: NodeData;
	revealChildren?: boolean;
	onExpandChange?: (isExpanded: boolean) => void;
} & Omit<CollapsibleNodeProps, "id" | "data" | "onExpandChange">;

type ControlledCollapsibleNodeProps = {
	id?: string;
	data?: NodeData;
	children?: ReactNode;
	showControls?: boolean;
} & Omit<CollapsibleNodeProps, "id" | "data" | "children">;

type NodeStateContextType = {
	isNodeExpanded: (nodeId: string) => boolean;
	expandNode: (nodeId: string) => void;
	setNodeState: (nodeId: string, expanded: boolean) => void;
	expandNodeTree: (nodeId: string) => void;
	collapseNodes: (nodeIds: string[]) => void;
	expandNodes: (nodeIds: string[]) => void;
	nodes: Array<{ id: string }>;
	edges: Array<{ source: string; target: string }>;
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * CollapsibleNode Component
 */
const CollapsibleNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	children,
	nodeType = "goal",
	defaultExpanded = false,
	onExpandChange,
	onClick,
	onDoubleClick,
	enableDoubleClickExpand = true,
	autoExpandOnSelect = true,
	className = "",
	...restProps
}: CollapsibleNodeProps): JSX.Element => {
	// Get node ID (prefer prop id, fallback to data.id)
	const nodeId = id || data.id || "";

	// Access node state context (may be null if not in NodeStateManager)
	const nodeStateContext = useContext(
		NodeStateContext
	) as NodeStateContextType | null;

	// Local state fallback (if not in NodeStateManager)
	const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

	// Determine if we're using global or local state
	const isUsingGlobalState = nodeStateContext !== null;

	// Get expansion state
	const isExpanded = isUsingGlobalState
		? (nodeStateContext?.isNodeExpanded(nodeId) ?? localExpanded)
		: localExpanded;

	// Auto-expand when selected (if enabled)
	useEffect(() => {
		if (selected && autoExpandOnSelect) {
			if (isUsingGlobalState && nodeStateContext) {
				nodeStateContext.expandNode(nodeId);
			} else {
				setLocalExpanded(true);
			}
		}
	}, [
		selected,
		autoExpandOnSelect,
		nodeId,
		isUsingGlobalState,
		nodeStateContext,
	]);

	/**
	 * Handle expand/collapse toggle
	 */
	const handleToggle = useCallback(
		(newExpandedState: boolean) => {
			if (isUsingGlobalState && nodeStateContext) {
				nodeStateContext.setNodeState(nodeId, newExpandedState);
			} else {
				setLocalExpanded(newExpandedState);
			}

			// Call custom callback if provided
			onExpandChange?.(newExpandedState);
		},
		[isUsingGlobalState, nodeStateContext, nodeId, onExpandChange]
	);

	/**
	 * Handle single click
	 */
	const handleClick = useCallback(
		(event: MouseEvent) => {
			// Call custom click handler if provided
			onClick?.(event);

			// Default behaviour: toggle expansion
			if (!event.defaultPrevented) {
				const newState = !isExpanded;
				handleToggle(newState);
			}
		},
		[onClick, isExpanded, handleToggle]
	);

	/**
	 * Handle keyboard events for accessibility
	 */
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				const newState = !isExpanded;
				handleToggle(newState);
			}
		},
		[isExpanded, handleToggle]
	);

	/**
	 * Handle double click to expand entire tree
	 */
	const handleDoubleClick = useCallback(
		(event: MouseEvent) => {
			// Call custom double-click handler if provided
			onDoubleClick?.(event);

			// Default behaviour: expand entire tree
			if (
				!event.defaultPrevented &&
				enableDoubleClickExpand &&
				isUsingGlobalState &&
				nodeStateContext
			) {
				event.preventDefault();
				nodeStateContext.expandNodeTree(nodeId);
			}
		},
		[
			onDoubleClick,
			enableDoubleClickExpand,
			isUsingGlobalState,
			nodeStateContext,
			nodeId,
		]
	);

	return (
		<button
			className="collapsible-node-wrapper w-full border-none bg-transparent p-0 text-left"
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			onKeyDown={handleKeyDown}
			type="button"
		>
			<BaseNode
				className={className}
				data={data}
				defaultExpanded={isExpanded}
				isConnectable={isConnectable}
				nodeType={nodeType}
				onExpandChange={handleToggle}
				selected={selected}
				{...restProps}
			>
				{children}
			</BaseNode>
		</button>
	);
};

// ========================================================================
// Variants
// ========================================================================

/**
 * CollapsibleNode with auto-focus behaviour
 * When expanded, automatically collapses siblings
 */
export const FocusCollapsibleNode = ({
	id,
	data = {},
	onExpandChange,
	...props
}: FocusCollapsibleNodeProps): JSX.Element => {
	const nodeId = id || data.id || "";
	const nodeStateContext = useContext(
		NodeStateContext
	) as NodeStateContextType | null;

	const handleExpandChange = useCallback(
		(isExpanded: boolean) => {
			if (isExpanded && nodeStateContext) {
				// Get all sibling nodes (nodes at same level)
				const currentNode = nodeStateContext.nodes.find((n) => n.id === nodeId);
				if (!currentNode) {
					return;
				}

				// Find parent
				const parentEdge = nodeStateContext.edges.find(
					(e) => e.target === nodeId
				);
				const parentId = parentEdge?.source;

				if (parentId) {
					// Find all siblings (other nodes with same parent)
					const siblingIds = nodeStateContext.edges
						.filter((e) => e.source === parentId && e.target !== nodeId)
						.map((e) => e.target);

					// Collapse siblings
					nodeStateContext.collapseNodes(siblingIds);
				}
			}

			// Call original handler if provided
			onExpandChange?.(isExpanded);
		},
		[nodeId, nodeStateContext, onExpandChange]
	);

	return (
		<CollapsibleNode
			data={data}
			id={id}
			{...props}
			onExpandChange={handleExpandChange}
		/>
	);
};

/**
 * CollapsibleNode with progressive disclosure
 * Expands and reveals connected child nodes automatically
 */
export const ProgressiveCollapsibleNode = ({
	id,
	data = {},
	revealChildren = true,
	onExpandChange,
	...props
}: ProgressiveCollapsibleNodeProps): JSX.Element => {
	const nodeId = id || data.id || "";
	const nodeStateContext = useContext(
		NodeStateContext
	) as NodeStateContextType | null;

	const handleExpandChange = useCallback(
		(isExpanded: boolean) => {
			if (isExpanded && revealChildren && nodeStateContext) {
				// Find all child nodes
				const childIds = nodeStateContext.edges
					.filter((e) => e.source === nodeId)
					.map((e) => e.target);

				// Expand children with a slight delay for stagger effect
				setTimeout(() => {
					nodeStateContext.expandNodes(childIds);
				}, 150);
			}

			// Call original handler if provided
			onExpandChange?.(isExpanded);
		},
		[nodeId, revealChildren, nodeStateContext, onExpandChange]
	);

	return (
		<CollapsibleNode
			data={data}
			id={id}
			{...props}
			onExpandChange={handleExpandChange}
		/>
	);
};

/**
 * CollapsibleNode with custom expansion controls
 * Provides additional buttons for expand tree, collapse tree, etc.
 */
export const ControlledCollapsibleNode = ({
	id,
	data = {},
	showControls = true,
	children,
	...props
}: ControlledCollapsibleNodeProps): JSX.Element => {
	const nodeId = id || data.id || "";
	const nodeStateContext = useContext(
		NodeStateContext
	) as NodeStateContextType | null;

	const handleExpandTree = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation();
			if (nodeStateContext) {
				nodeStateContext.expandNodeTree(nodeId);
			}
		},
		[nodeId, nodeStateContext]
	);

	const handleCollapseTree = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation();
			if (nodeStateContext) {
				// Collapse this node and all descendants
				const allDescendants = [nodeId];
				const queue = [nodeId];

				while (queue.length > 0) {
					const currentId = queue.shift();
					if (!currentId) {
						continue;
					}

					const childIds = nodeStateContext.edges
						.filter((e) => e.source === currentId)
						.map((e) => e.target);

					allDescendants.push(...childIds);
					queue.push(...childIds);
				}

				nodeStateContext.collapseNodes(allDescendants);
			}
		},
		[nodeId, nodeStateContext]
	);

	const handleExpandPath = useCallback(
		(event: MouseEvent) => {
			event.stopPropagation();
			if (nodeStateContext) {
				// Find path to root and expand all nodes in path
				const pathIds = [nodeId];
				let currentId = nodeId;

				while (currentId) {
					const parentEdge = nodeStateContext.edges.find(
						(e) => e.target === currentId
					);
					if (!parentEdge) {
						break;
					}

					pathIds.push(parentEdge.source);
					currentId = parentEdge.source;
				}

				nodeStateContext.expandNodes(pathIds);
			}
		},
		[nodeId, nodeStateContext]
	);

	return (
		<CollapsibleNode data={data} id={id} {...props}>
			{children}

			{showControls && nodeStateContext && (
				<div className="mt-3 flex gap-2 border-border-transparent border-t pt-3">
					<button
						className="flex-1 rounded bg-background-transparent-white-hover px-2 py-1 text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
						onClick={handleExpandTree}
						title="Expand entire subtree"
						type="button"
					>
						Expand Tree
					</button>

					<button
						className="flex-1 rounded bg-background-transparent-white-hover px-2 py-1 text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
						onClick={handleCollapseTree}
						title="Collapse entire subtree"
						type="button"
					>
						Collapse Tree
					</button>

					<button
						className="flex-1 rounded bg-background-transparent-white-hover px-2 py-1 text-text-light text-xs transition-colors duration-200 hover:bg-background-transparent-white-secondaryHover"
						onClick={handleExpandPath}
						title="Expand path to root"
						type="button"
					>
						Show Path
					</button>
				</div>
			)}
		</CollapsibleNode>
	);
};

/**
 * Memoised CollapsibleNode for performance
 */
export const MemoizedCollapsibleNode = memo(
	CollapsibleNode,
	(prevProps, nextProps) => {
		// Custom comparison for optimal re-rendering
		return (
			prevProps.id === nextProps.id &&
			prevProps.selected === nextProps.selected &&
			prevProps.data === nextProps.data &&
			prevProps.isConnectable === nextProps.isConnectable &&
			prevProps.nodeType === nextProps.nodeType
		);
	}
);

export default CollapsibleNode;
