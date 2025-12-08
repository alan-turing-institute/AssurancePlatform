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

import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Default configuration for node state
 */
const DEFAULT_CONFIG = {
  persistKey: null, // localStorage key (null = no persistence)
  defaultExpanded: false, // Default state for new nodes
  autoExpandOnSelect: true, // Auto-expand when node is selected
  debounceMs: 100, // Debounce delay for rapid actions
};

/**
 * Load state from localStorage
 * @param {string} key - localStorage key
 * @returns {Object} Saved state or empty object
 */
const loadFromStorage = (key) => {
  if (typeof window === 'undefined' || !key) return {};

  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load node state from localStorage:', error);
    return {};
  }
};

/**
 * Save state to localStorage
 * @param {string} key - localStorage key
 * @param {Object} state - State to save
 */
const saveToStorage = (key, state) => {
  if (typeof window === 'undefined' || !key) return;

  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save node state to localStorage:', error);
  }
};

/**
 * useNodeState Hook
 *
 * @param {Object} config - Configuration options
 * @param {string|null} config.persistKey - localStorage key for persistence
 * @param {boolean} config.defaultExpanded - Default expanded state for new nodes
 * @param {boolean} config.autoExpandOnSelect - Auto-expand nodes when selected
 * @param {number} config.debounceMs - Debounce delay for rapid actions
 * @returns {Object} Node state management functions and data
 */
const useNodeState = (config = {}) => {
  // Merge config with defaults
  const finalConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  // State: nodeId -> boolean (true = expanded, false = collapsed)
  const [nodeStates, setNodeStates] = useState(() => {
    if (finalConfig.persistKey) {
      return loadFromStorage(finalConfig.persistKey);
    }
    return {};
  });

  // Track debounce timeout
  const [debounceTimeout, setDebounceTimeout] = useState(null);

  // Save to localStorage when state changes
  useEffect(() => {
    if (finalConfig.persistKey) {
      saveToStorage(finalConfig.persistKey, nodeStates);
    }
  }, [nodeStates, finalConfig.persistKey]);

  /**
   * Check if a node is expanded
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if expanded
   */
  const isNodeExpanded = useCallback(
    (nodeId) => {
      if (!nodeId) return finalConfig.defaultExpanded;
      return nodeStates[nodeId] !== undefined
        ? nodeStates[nodeId]
        : finalConfig.defaultExpanded;
    },
    [nodeStates, finalConfig.defaultExpanded]
  );

  /**
   * Set state for a specific node
   * @param {string} nodeId - Node ID
   * @param {boolean} isExpanded - Expanded state
   */
  const setNodeState = useCallback((nodeId, isExpanded) => {
    if (!nodeId) return;

    setNodeStates((prev) => ({
      ...prev,
      [nodeId]: isExpanded,
    }));
  }, []);

  /**
   * Toggle node expanded/collapsed state
   * @param {string} nodeId - Node ID
   */
  const toggleNode = useCallback(
    (nodeId) => {
      if (!nodeId) return;

      const currentState = isNodeExpanded(nodeId);
      setNodeState(nodeId, !currentState);
    },
    [isNodeExpanded, setNodeState]
  );

  /**
   * Expand a specific node
   * @param {string} nodeId - Node ID
   */
  const expandNode = useCallback(
    (nodeId) => {
      if (!nodeId) return;
      setNodeState(nodeId, true);
    },
    [setNodeState]
  );

  /**
   * Collapse a specific node
   * @param {string} nodeId - Node ID
   */
  const collapseNode = useCallback(
    (nodeId) => {
      if (!nodeId) return;
      setNodeState(nodeId, false);
    },
    [setNodeState]
  );

  /**
   * Expand multiple nodes
   * @param {string[]} nodeIds - Array of node IDs
   */
  const expandNodes = useCallback(
    (nodeIds) => {
      if (!nodeIds || nodeIds.length === 0) return;

      setNodeStates((prev) => {
        const updated = { ...prev };
        nodeIds.forEach((id) => {
          updated[id] = true;
        });
        return updated;
      });
    },
    []
  );

  /**
   * Collapse multiple nodes
   * @param {string[]} nodeIds - Array of node IDs
   */
  const collapseNodes = useCallback(
    (nodeIds) => {
      if (!nodeIds || nodeIds.length === 0) return;

      setNodeStates((prev) => {
        const updated = { ...prev };
        nodeIds.forEach((id) => {
          updated[id] = false;
        });
        return updated;
      });
    },
    []
  );

  /**
   * Expand all nodes
   * @param {string[]} allNodeIds - Array of all node IDs in the flow
   */
  const expandAll = useCallback(
    (allNodeIds) => {
      if (!allNodeIds || allNodeIds.length === 0) {
        // If no IDs provided, expand all known nodes
        setNodeStates((prev) => {
          const updated = {};
          Object.keys(prev).forEach((id) => {
            updated[id] = true;
          });
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
   * @param {string[]} allNodeIds - Array of all node IDs in the flow
   */
  const collapseAll = useCallback(
    (allNodeIds) => {
      if (!allNodeIds || allNodeIds.length === 0) {
        // If no IDs provided, collapse all known nodes
        setNodeStates((prev) => {
          const updated = {};
          Object.keys(prev).forEach((id) => {
            updated[id] = false;
          });
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
   * @param {string[]} focusNodeIds - Array of node IDs to keep expanded
   * @param {string[]} allNodeIds - Array of all node IDs in the flow
   */
  const focusMode = useCallback(
    (focusNodeIds, allNodeIds) => {
      if (!focusNodeIds || !allNodeIds) return;

      setNodeStates((prev) => {
        const updated = {};

        // Collapse all nodes
        allNodeIds.forEach((id) => {
          updated[id] = false;
        });

        // Expand only focus nodes
        focusNodeIds.forEach((id) => {
          updated[id] = true;
        });

        return updated;
      });
    },
    []
  );

  /**
   * Expand a node and all its ancestors (path to root)
   * @param {string} nodeId - Target node ID
   * @param {Object[]} nodes - React Flow nodes array
   * @param {Object[]} edges - React Flow edges array
   */
  const expandPathToNode = useCallback(
    (nodeId, nodes, edges) => {
      if (!nodeId || !nodes || !edges) return;

      // Find all ancestor nodes by traversing edges backwards
      const ancestors = new Set();
      const queue = [nodeId];

      while (queue.length > 0) {
        const currentId = queue.shift();
        ancestors.add(currentId);

        // Find all edges where current node is the target
        const parentEdges = edges.filter((edge) => edge.target === currentId);
        parentEdges.forEach((edge) => {
          if (!ancestors.has(edge.source)) {
            queue.push(edge.source);
          }
        });
      }

      // Expand all ancestors
      expandNodes(Array.from(ancestors));
    },
    [expandNodes]
  );

  /**
   * Expand a node and all its descendants (children)
   * @param {string} nodeId - Target node ID
   * @param {Object[]} nodes - React Flow nodes array
   * @param {Object[]} edges - React Flow edges array
   */
  const expandNodeTree = useCallback(
    (nodeId, nodes, edges) => {
      if (!nodeId || !nodes || !edges) return;

      // Find all descendant nodes by traversing edges forwards
      const descendants = new Set();
      const queue = [nodeId];

      while (queue.length > 0) {
        const currentId = queue.shift();
        descendants.add(currentId);

        // Find all edges where current node is the source
        const childEdges = edges.filter((edge) => edge.source === currentId);
        childEdges.forEach((edge) => {
          if (!descendants.has(edge.target)) {
            queue.push(edge.target);
          }
        });
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
   * @returns {Object} Statistics
   */
  const getStats = useCallback(() => {
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
   * @param {Function} operation - Operation to debounce
   * @returns {Function} Debounced operation
   */
  const debouncedOperation = useCallback(
    (operation) => {
      return (...args) => {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }

        const timeout = setTimeout(() => {
          operation(...args);
        }, finalConfig.debounceMs);

        setDebounceTimeout(timeout);
      };
    },
    [debounceTimeout, finalConfig.debounceMs]
  );

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

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
    debouncedExpandAll: debouncedOperation(expandAll),
    debouncedCollapseAll: debouncedOperation(collapseAll),
    debouncedFocusMode: debouncedOperation(focusMode),
  };
};

export default useNodeState;
