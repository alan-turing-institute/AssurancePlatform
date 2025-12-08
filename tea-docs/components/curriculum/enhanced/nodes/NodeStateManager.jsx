/**
 * NodeStateManager Component
 *
 * Provides a React Context-based state management system for collapsible nodes.
 * Acts as a centralized state provider that wraps React Flow components to enable
 * shared state management across all collapsible nodes.
 *
 * Features:
 * - Context-based state sharing
 * - Integration with useNodeState hook
 * - Auto-sync with React Flow nodes
 * - Toolbar controls for bulk operations
 * - Performance optimized with memoization
 *
 * @component
 * @example
 * <NodeStateManager persistKey="my-flow">
 *   <ReactFlow nodes={nodes} edges={edges} />
 * </NodeStateManager>
 */

import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useNodes, useEdges } from 'reactflow';
import useNodeState from './useNodeState';

/**
 * Node State Context
 * Provides state management functions to all child components
 */
const NodeStateContext = createContext(null);

/**
 * Custom hook to access node state context
 * @throws {Error} If used outside NodeStateManager
 * @returns {Object} Node state management functions
 */
export const useNodeStateContext = () => {
  const context = useContext(NodeStateContext);

  if (!context) {
    throw new Error(
      'useNodeStateContext must be used within a NodeStateManager'
    );
  }

  return context;
};

/**
 * NodeStateManager Component
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components (typically ReactFlow)
 * @param {string|null} props.persistKey - localStorage key for state persistence
 * @param {boolean} props.defaultExpanded - Default expanded state for new nodes
 * @param {boolean} props.autoExpandOnSelect - Auto-expand nodes when selected
 * @param {number} props.debounceMs - Debounce delay for rapid actions
 * @param {Function} props.onStateChange - Callback when state changes
 * @param {boolean} props.showControls - Show built-in toolbar controls
 * @param {string} props.className - Additional CSS classes for container
 * @returns {React.Element} NodeStateManager component
 */
const NodeStateManager = ({
  children,
  persistKey = null,
  defaultExpanded = false,
  autoExpandOnSelect = true,
  debounceMs = 100,
  onStateChange,
  showControls = false,
  className = '',
}) => {
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
  const allNodeIds = useMemo(() => {
    return nodes.map((node) => node.id);
  }, [nodes]);

  // Handle state change callbacks
  const handleStateChange = useCallback(
    (operation, ...args) => {
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
      toggleNode: (nodeId) => {
        nodeStateHook.toggleNode(nodeId);
        handleStateChange('toggle', nodeId);
      },

      expandNode: (nodeId) => {
        nodeStateHook.expandNode(nodeId);
        handleStateChange('expand', nodeId);
      },

      collapseNode: (nodeId) => {
        nodeStateHook.collapseNode(nodeId);
        handleStateChange('collapse', nodeId);
      },

      expandAll: () => {
        nodeStateHook.expandAll(allNodeIds);
        handleStateChange('expandAll');
      },

      collapseAll: () => {
        nodeStateHook.collapseAll(allNodeIds);
        handleStateChange('collapseAll');
      },

      focusMode: (focusNodeIds) => {
        nodeStateHook.focusMode(focusNodeIds, allNodeIds);
        handleStateChange('focusMode', focusNodeIds);
      },

      expandPathToNode: (nodeId) => {
        nodeStateHook.expandPathToNode(nodeId, nodes, edges);
        handleStateChange('expandPath', nodeId);
      },

      expandNodeTree: (nodeId) => {
        nodeStateHook.expandNodeTree(nodeId, nodes, edges);
        handleStateChange('expandTree', nodeId);
      },

      resetAll: () => {
        nodeStateHook.resetAll();
        handleStateChange('reset');
      },

      // Additional utilities
      allNodeIds,
      nodes,
      edges,
    }),
    [nodeStateHook, allNodeIds, nodes, edges, handleStateChange]
  );

  // Context value (memoized for performance)
  const contextValue = useMemo(
    () => wrappedOperations,
    [wrappedOperations]
  );

  return (
    <NodeStateContext.Provider value={contextValue}>
      <div className={className}>
        {showControls && <NodeStateControls />}
        {children}
      </div>
    </NodeStateContext.Provider>
  );
};

/**
 * NodeStateControls Component
 * Built-in toolbar controls for bulk operations
 */
export const NodeStateControls = ({ className = '' }) => {
  const {
    expandAll,
    collapseAll,
    resetAll,
    getStats,
  } = useNodeStateContext();

  const stats = getStats();

  return (
    <div
      className={`
        flex items-center gap-2 p-2
        bg-background-transparent-black
        f-effect-backdrop-blur-lg
        border border-transparent
        rounded-lg
        shadow-glassmorphic
        ${className}
      `}
    >
      {/* Stats Display */}
      <div className="text-xs text-text-light/70 px-2">
        <span className="font-semibold text-text-light">
          {stats.expanded}
        </span>
        {' / '}
        <span>{stats.total}</span>
        {' expanded'}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border-transparent" />

      {/* Expand All Button */}
      <button
        onClick={expandAll}
        className="
          px-3 py-1.5
          text-xs font-medium
          text-text-light
          bg-background-transparent-white-hover
          hover:bg-background-transparent-white-secondaryHover
          rounded-md
          transition-colors
          duration-200
        "
        title="Expand all nodes"
      >
        Expand All
      </button>

      {/* Collapse All Button */}
      <button
        onClick={collapseAll}
        className="
          px-3 py-1.5
          text-xs font-medium
          text-text-light
          bg-background-transparent-white-hover
          hover:bg-background-transparent-white-secondaryHover
          rounded-md
          transition-colors
          duration-200
        "
        title="Collapse all nodes"
      >
        Collapse All
      </button>

      {/* Reset Button */}
      <button
        onClick={resetAll}
        className="
          px-3 py-1.5
          text-xs font-medium
          text-text-light/70
          hover:text-text-light
          bg-transparent
          hover:bg-background-transparent-white-hover
          rounded-md
          transition-colors
          duration-200
        "
        title="Reset to defaults"
      >
        Reset
      </button>
    </div>
  );
};

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
       * @param {string} nodeId - Node ID
       * @param {boolean} recursive - Also toggle children
       */
      toggleNodeRecursive: (nodeId, recursive = false) => {
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
       * @param {string[]} selectedNodeIds - Array of selected node IDs
       */
      expandSelected: (selectedNodeIds) => {
        context.focusMode(selectedNodeIds, context.allNodeIds);
      },

      /**
       * Get expansion state for all nodes as a map
       * @returns {Map<string, boolean>} Map of node ID to expansion state
       */
      getExpansionMap: () => {
        const map = new Map();
        context.allNodeIds.forEach((id) => {
          map.set(id, context.isNodeExpanded(id));
        });
        return map;
      },
    }),
    [context]
  );

  return enhancedUtilities;
};

/**
 * Higher-Order Component to inject node state props
 * @param {React.Component} Component - Component to wrap
 * @returns {React.Component} Wrapped component with node state props
 */
export const withNodeState = (Component) => {
  return React.forwardRef((props, ref) => {
    const nodeState = useNodeStateContext();

    return (
      <Component
        ref={ref}
        {...props}
        nodeState={nodeState}
      />
    );
  });
};

export default NodeStateManager;
