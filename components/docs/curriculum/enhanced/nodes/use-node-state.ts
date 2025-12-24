"use client";
/**
 * useNodeState Hook
 *
 * Custom React hook for managing collapsed/expanded state of collapsible nodes
 * in React Flow diagrams. Provides centralized state management with persistence,
 * bulk operations, and integration with React Flow's node data.
 *
 * Features:
 * - Track collapsed/expanded state per node ID
 * - Bulk operations (expand all, collapse all)
 * - Optional localStorage persistence
 * - Sync with React Flow node data
 * - Auto-expand on selection
 * - Focus mode (collapse all except selected path)
 *
 * @module useNodeState
 * @example
 * const {
 *   isNodeExpanded,
 *   toggleNode,
 *   expandNode,
 *   collapseNode,
 *   expandAll,
 *   collapseAll,
 *   focusMode
 * } = useNodeState({ persistKey: 'my-flow' });
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";

/**
 * Configuration options for the node state hook
 */
type NodeStateConfig = {
	persistKey?: string | null; // localStorage key (null = no persistence)
	defaultExpanded?: boolean; // Default state for new nodes
	autoExpandOnSelect?: boolean; // Auto-expand when node is selected
	debounceMs?: number; // Debounce delay for rapid actions
};

/**
 * Node state map type
 */
type NodeStatesMap = Record<string, boolean>;

/**
 * Statistics about node states
 */
type NodeStateStats = {
	total: number;
	expanded: number;
	collapsed: number;
	percentExpanded: number;
};

/**
 * Return type for the useNodeState hook
 */
type UseNodeStateReturn = {
	// State queries
	isNodeExpanded: (nodeId: string) => boolean;
	nodeStates: NodeStatesMap;
	getStats: () => NodeStateStats;

	// Individual node operations
	setNodeState: (nodeId: string, isExpanded: boolean) => void;
	toggleNode: (nodeId: string) => void;
	expandNode: (nodeId: string) => void;
	collapseNode: (nodeId: string) => void;

	// Bulk operations
	expandNodes: (nodeIds: string[]) => void;
	collapseNodes: (nodeIds: string[]) => void;
	expandAll: (allNodeIds?: string[]) => void;
	collapseAll: (allNodeIds?: string[]) => void;

	// Advanced operations
	focusMode: (focusNodeIds: string[], allNodeIds: string[]) => void;
	expandPathToNode: (nodeId: string, nodes: Node[], edges: Edge[]) => void;
	expandNodeTree: (nodeId: string, nodes: Node[], edges: Edge[]) => void;
	resetAll: () => void;

	// Debounced operations (for rapid actions)
	debouncedExpandAll: (...args: unknown[]) => void;
	debouncedCollapseAll: (...args: unknown[]) => void;
	debouncedFocusMode: (...args: unknown[]) => void;
};

/**
 * Default configuration for node state
 */
const DEFAULT_CONFIG: Required<NodeStateConfig> = {
	persistKey: null, // localStorage key (null = no persistence)
	defaultExpanded: false, // Default state for new nodes
	autoExpandOnSelect: true, // Auto-expand when node is selected
	debounceMs: 100, // Debounce delay for rapid actions
};

/**
 * Load state from localStorage
 * @param key - localStorage key
 * @returns Saved state or empty object
 */
const loadFromStorage = (key: string | null): NodeStatesMap => {
	if (typeof window === "undefined" || !key) {
		return {};
	}

	try {
		const saved = localStorage.getItem(key);
		return saved ? JSON.parse(saved) : {};
	} catch (error) {
		console.error("Failed to load node state from localStorage:", error);
		return {};
	}
};

/**
 * Save state to localStorage
 * @param key - localStorage key
 * @param state - State to save
 */
const saveToStorage = (key: string | null, state: NodeStatesMap): void => {
	if (typeof window === "undefined" || !key) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(state));
	} catch (error) {
		console.error("Failed to save node state to localStorage:", error);
	}
};

/**
 * useNodeState Hook
 *
 * @param config - Configuration options
 * @returns Node state management functions and data
 */
const useNodeState = (config: NodeStateConfig = {}): UseNodeStateReturn => {
	// Merge config with defaults
	const finalConfig = useMemo<Required<NodeStateConfig>>(
		() => ({ ...DEFAULT_CONFIG, ...config }),
		[
			config.persistKey,
			config.defaultExpanded,
			config.autoExpandOnSelect,
			config.debounceMs,
			config,
		]
	);

	// State: nodeId -> boolean (true = expanded, false = collapsed)
	const [nodeStates, setNodeStates] = useState<NodeStatesMap>(() => {
		if (finalConfig.persistKey) {
			return loadFromStorage(finalConfig.persistKey);
		}
		return {};
	});

	// Track debounce timeout
	const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(
		null
	);

	// Save to localStorage when state changes
	useEffect(() => {
		if (finalConfig.persistKey) {
			saveToStorage(finalConfig.persistKey, nodeStates);
		}
	}, [nodeStates, finalConfig.persistKey]);

	/**
	 * Check if a node is expanded
	 * @param nodeId - Node ID
	 * @returns True if expanded
	 */
	const isNodeExpanded = useCallback(
		(nodeId: string): boolean => {
			if (!nodeId) {
				return finalConfig.defaultExpanded;
			}
			return nodeStates[nodeId] !== undefined
				? nodeStates[nodeId]
				: finalConfig.defaultExpanded;
		},
		[nodeStates, finalConfig.defaultExpanded]
	);

	/**
	 * Set state for a specific node
	 * @param nodeId - Node ID
	 * @param isExpanded - Expanded state
	 */
	const setNodeState = useCallback(
		(nodeId: string, isExpanded: boolean): void => {
			if (!nodeId) {
				return;
			}

			setNodeStates((prev) => ({
				...prev,
				[nodeId]: isExpanded,
			}));
		},
		[]
	);

	/**
	 * Toggle node expanded/collapsed state
	 * @param nodeId - Node ID
	 */
	const toggleNode = useCallback(
		(nodeId: string): void => {
			if (!nodeId) {
				return;
			}

			const currentState = isNodeExpanded(nodeId);
			setNodeState(nodeId, !currentState);
		},
		[isNodeExpanded, setNodeState]
	);

	/**
	 * Expand a specific node
	 * @param nodeId - Node ID
	 */
	const expandNode = useCallback(
		(nodeId: string): void => {
			if (!nodeId) {
				return;
			}
			setNodeState(nodeId, true);
		},
		[setNodeState]
	);

	/**
	 * Collapse a specific node
	 * @param nodeId - Node ID
	 */
	const collapseNode = useCallback(
		(nodeId: string): void => {
			if (!nodeId) {
				return;
			}
			setNodeState(nodeId, false);
		},
		[setNodeState]
	);

	/**
	 * Expand multiple nodes
	 * @param nodeIds - Array of node IDs
	 */
	const expandNodes = useCallback((nodeIds: string[]): void => {
		if (!nodeIds || nodeIds.length === 0) {
			return;
		}

		setNodeStates((prev) => {
			const updated = { ...prev };
			for (const id of nodeIds) {
				updated[id] = true;
			}
			return updated;
		});
	}, []);

	/**
	 * Collapse multiple nodes
	 * @param nodeIds - Array of node IDs
	 */
	const collapseNodes = useCallback((nodeIds: string[]): void => {
		if (!nodeIds || nodeIds.length === 0) {
			return;
		}

		setNodeStates((prev) => {
			const updated = { ...prev };
			for (const id of nodeIds) {
				updated[id] = false;
			}
			return updated;
		});
	}, []);

	/**
	 * Expand all nodes
	 * @param allNodeIds - Array of all node IDs in the flow
	 */
	const expandAll = useCallback(
		(allNodeIds?: string[]): void => {
			if (!allNodeIds || allNodeIds.length === 0) {
				// If no IDs provided, expand all known nodes
				setNodeStates((prev) => {
					const updated: NodeStatesMap = {};
					for (const id of Object.keys(prev)) {
						updated[id] = true;
					}
					return updated;
				});
			} else {
				expandNodes(allNodeIds);
			}
		},
		[expandNodes]
	);

	/**
	 * Collapse all nodes
	 * @param allNodeIds - Array of all node IDs in the flow
	 */
	const collapseAll = useCallback(
		(allNodeIds?: string[]): void => {
			if (!allNodeIds || allNodeIds.length === 0) {
				// If no IDs provided, collapse all known nodes
				setNodeStates((prev) => {
					const updated: NodeStatesMap = {};
					for (const id of Object.keys(prev)) {
						updated[id] = false;
					}
					return updated;
				});
			} else {
				collapseNodes(allNodeIds);
			}
		},
		[collapseNodes]
	);

	/**
	 * Focus mode: Collapse all except specified nodes
	 * @param focusNodeIds - Array of node IDs to keep expanded
	 * @param allNodeIds - Array of all node IDs in the flow
	 */
	const focusMode = useCallback(
		(focusNodeIds: string[], allNodeIds: string[]): void => {
			if (!(focusNodeIds && allNodeIds)) {
				return;
			}

			setNodeStates(() => {
				const updated: NodeStatesMap = {};

				// Collapse all nodes
				for (const id of allNodeIds) {
					updated[id] = false;
				}

				// Expand only focus nodes
				for (const id of focusNodeIds) {
					updated[id] = true;
				}

				return updated;
			});
		},
		[]
	);

	/**
	 * Expand a node and all its ancestors (path to root)
	 * @param nodeId - Target node ID
	 * @param nodes - React Flow nodes array
	 * @param edges - React Flow edges array
	 */
	const expandPathToNode = useCallback(
		(nodeId: string, nodes: Node[], edges: Edge[]): void => {
			if (!(nodeId && nodes && edges)) {
				return;
			}

			// Find all ancestor nodes by traversing edges backwards
			const ancestors = new Set<string>();
			const queue = [nodeId];

			while (queue.length > 0) {
				const currentId = queue.shift();
				if (!currentId) {
					continue;
				}
				ancestors.add(currentId);

				// Find all edges where current node is the target
				const parentEdges = edges.filter((edge) => edge.target === currentId);
				for (const edge of parentEdges) {
					if (!ancestors.has(edge.source)) {
						queue.push(edge.source);
					}
				}
			}

			// Expand all ancestors
			expandNodes(Array.from(ancestors));
		},
		[expandNodes]
	);

	/**
	 * Expand a node and all its descendants (children)
	 * @param nodeId - Target node ID
	 * @param nodes - React Flow nodes array
	 * @param edges - React Flow edges array
	 */
	const expandNodeTree = useCallback(
		(nodeId: string, nodes: Node[], edges: Edge[]): void => {
			if (!(nodeId && nodes && edges)) {
				return;
			}

			// Find all descendant nodes by traversing edges forwards
			const descendants = new Set<string>();
			const queue = [nodeId];

			while (queue.length > 0) {
				const currentId = queue.shift();
				if (!currentId) {
					continue;
				}
				descendants.add(currentId);

				// Find all edges where current node is the source
				const childEdges = edges.filter((edge) => edge.source === currentId);
				for (const edge of childEdges) {
					if (!descendants.has(edge.target)) {
						queue.push(edge.target);
					}
				}
			}

			// Expand all descendants
			expandNodes(Array.from(descendants));
		},
		[expandNodes]
	);

	/**
	 * Reset all node states to default
	 */
	const resetAll = useCallback(() => {
		setNodeStates({});
	}, []);

	/**
	 * Get statistics about current node states
	 * @returns Statistics
	 */
	const getStats = useCallback((): NodeStateStats => {
		const states = Object.values(nodeStates);
		const total = states.length;
		const expanded = states.filter((state) => state).length;
		const collapsed = states.filter((state) => !state).length;

		return {
			total,
			expanded,
			collapsed,
			percentExpanded: total > 0 ? (expanded / total) * 100 : 0,
		};
	}, [nodeStates]);

	/**
	 * Debounced bulk operation wrapper
	 * @param operation - Operation to debounce
	 * @returns Debounced operation
	 */
	const debouncedOperation = useCallback(
		(operation: (...args: unknown[]) => void) =>
			(...args: unknown[]) => {
				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}

				const timeout = setTimeout(() => {
					operation(...args);
				}, finalConfig.debounceMs);

				setDebounceTimeout(timeout);
			},
		[debounceTimeout, finalConfig.debounceMs]
	);

	// Cleanup debounce timeout on unmount
	useEffect(
		() => () => {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}
		},
		[debounceTimeout]
	);

	return {
		// State queries
		isNodeExpanded,
		nodeStates,
		getStats,

		// Individual node operations
		setNodeState,
		toggleNode,
		expandNode,
		collapseNode,

		// Bulk operations
		expandNodes,
		collapseNodes,
		expandAll,
		collapseAll,

		// Advanced operations
		focusMode,
		expandPathToNode,
		expandNodeTree,
		resetAll,

		// Debounced operations (for rapid actions)
		debouncedExpandAll: debouncedOperation(
			expandAll as (...args: unknown[]) => void
		),
		debouncedCollapseAll: debouncedOperation(
			collapseAll as (...args: unknown[]) => void
		),
		debouncedFocusMode: debouncedOperation(
			focusMode as (...args: unknown[]) => void
		),
	};
};

export default useNodeState;
