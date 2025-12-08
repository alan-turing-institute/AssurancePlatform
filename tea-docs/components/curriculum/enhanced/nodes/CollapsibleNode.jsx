/**
 * CollapsibleNode Component
 *
 * Wrapper around BaseNode that integrates with NodeStateManager for centralized
 * collapse/expand state management. Provides all the features of BaseNode plus
 * automatic state synchronization with the global state manager.
 *
 * Features:
 * - Automatic state sync with NodeStateManager
 * - Click to expand/collapse behavior
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

import React, { useCallback, useEffect, useState } from 'react';
import BaseNode from './BaseNode';
import { useNodeStateContext } from './NodeStateManager';

/**
 * CollapsibleNode Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Unique node identifier
 * @param {Object} props.data - Node data
 * @param {string} props.data.id - Node data ID (fallback if id not provided)
 * @param {string} props.data.name - Node name/title
 * @param {string} props.data.description - Node description
 * @param {boolean} props.selected - Whether node is currently selected
 * @param {boolean} props.isConnectable - Whether node can form connections
 * @param {React.ReactNode} props.children - Additional content when expanded
 * @param {string} props.nodeType - Node type (goal, strategy, propertyClaim, evidence, context)
 * @param {boolean} props.defaultExpanded - Initial expanded state (overridden by state manager)
 * @param {Function} props.onExpandChange - Callback when expand state changes
 * @param {Function} props.onClick - Custom click handler
 * @param {Function} props.onDoubleClick - Custom double-click handler
 * @param {boolean} props.enableDoubleClickExpand - Enable double-click to expand tree
 * @param {boolean} props.autoExpandOnSelect - Auto-expand when selected
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} CollapsibleNode component
 */
const CollapsibleNode = ({
  id,
  data = {},
  selected = false,
  isConnectable = true,
  children,
  nodeType = 'goal',
  defaultExpanded = false,
  onExpandChange,
  onClick,
  onDoubleClick,
  enableDoubleClickExpand = true,
  autoExpandOnSelect = true,
  className = '',
  ...restProps
}) => {
  // Get node ID (prefer prop id, fallback to data.id)
  const nodeId = id || data.id;

  // Try to access node state context (if available)
  let nodeStateContext = null;
  try {
    nodeStateContext = useNodeStateContext();
  } catch (error) {
    // Not inside NodeStateManager, use local state
    console.debug('CollapsibleNode not inside NodeStateManager, using local state');
  }

  // Local state fallback (if not in NodeStateManager)
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  // Determine if we're using global or local state
  const isUsingGlobalState = nodeStateContext !== null;

  // Get expansion state
  const isExpanded = isUsingGlobalState
    ? nodeStateContext.isNodeExpanded(nodeId)
    : localExpanded;

  // Auto-expand when selected (if enabled)
  useEffect(() => {
    if (selected && autoExpandOnSelect) {
      if (isUsingGlobalState) {
        nodeStateContext.expandNode(nodeId);
      } else {
        setLocalExpanded(true);
      }
    }
  }, [selected, autoExpandOnSelect, nodeId, isUsingGlobalState, nodeStateContext]);

  /**
   * Handle expand/collapse toggle
   */
  const handleToggle = useCallback(
    (newExpandedState) => {
      if (isUsingGlobalState) {
        nodeStateContext.setNodeState(nodeId, newExpandedState);
      } else {
        setLocalExpanded(newExpandedState);
      }

      // Call custom callback if provided
      if (onExpandChange) {
        onExpandChange(newExpandedState);
      }
    },
    [isUsingGlobalState, nodeStateContext, nodeId, onExpandChange]
  );

  /**
   * Handle single click
   */
  const handleClick = useCallback(
    (event) => {
      // Call custom click handler if provided
      if (onClick) {
        onClick(event);
      }

      // Default behavior: toggle expansion
      if (!event.defaultPrevented) {
        const newState = !isExpanded;
        handleToggle(newState);
      }
    },
    [onClick, isExpanded, handleToggle]
  );

  /**
   * Handle double click to expand entire tree
   */
  const handleDoubleClick = useCallback(
    (event) => {
      // Call custom double-click handler if provided
      if (onDoubleClick) {
        onDoubleClick(event);
      }

      // Default behavior: expand entire tree
      if (!event.defaultPrevented && enableDoubleClickExpand && isUsingGlobalState) {
        event.preventDefault();
        nodeStateContext.expandNodeTree(nodeId);
      }
    },
    [onDoubleClick, enableDoubleClickExpand, isUsingGlobalState, nodeStateContext, nodeId]
  );

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className="collapsible-node-wrapper"
    >
      <BaseNode
        data={data}
        selected={selected}
        isConnectable={isConnectable}
        nodeType={nodeType}
        defaultExpanded={isExpanded}
        onExpandChange={handleToggle}
        className={className}
        {...restProps}
      >
        {children}
      </BaseNode>
    </div>
  );
};

/**
 * CollapsibleNode with auto-focus behavior
 * When expanded, automatically collapses siblings
 */
export const FocusCollapsibleNode = ({
  id,
  data = {},
  ...props
}) => {
  const nodeId = id || data.id;
  const nodeStateContext = useNodeStateContext();

  const handleExpandChange = useCallback(
    (isExpanded) => {
      if (isExpanded && nodeStateContext) {
        // Get all sibling nodes (nodes at same level)
        const currentNode = nodeStateContext.nodes.find((n) => n.id === nodeId);
        if (!currentNode) return;

        // Find parent
        const parentEdge = nodeStateContext.edges.find((e) => e.target === nodeId);
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
      if (props.onExpandChange) {
        props.onExpandChange(isExpanded);
      }
    },
    [nodeId, nodeStateContext, props]
  );

  return (
    <CollapsibleNode
      id={id}
      data={data}
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
  ...props
}) => {
  const nodeId = id || data.id;
  const nodeStateContext = useNodeStateContext();

  const handleExpandChange = useCallback(
    (isExpanded) => {
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
      if (props.onExpandChange) {
        props.onExpandChange(isExpanded);
      }
    },
    [nodeId, revealChildren, nodeStateContext, props]
  );

  return (
    <CollapsibleNode
      id={id}
      data={data}
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
  ...props
}) => {
  const nodeId = id || data.id;
  const nodeStateContext = useNodeStateContext();

  const handleExpandTree = useCallback(
    (event) => {
      event.stopPropagation();
      if (nodeStateContext) {
        nodeStateContext.expandNodeTree(nodeId);
      }
    },
    [nodeId, nodeStateContext]
  );

  const handleCollapseTree = useCallback(
    (event) => {
      event.stopPropagation();
      if (nodeStateContext) {
        // Collapse this node and all descendants
        const allDescendants = [nodeId];
        const queue = [nodeId];

        while (queue.length > 0) {
          const currentId = queue.shift();
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
    (event) => {
      event.stopPropagation();
      if (nodeStateContext) {
        nodeStateContext.expandPathToNode(nodeId);
      }
    },
    [nodeId, nodeStateContext]
  );

  return (
    <CollapsibleNode
      id={id}
      data={data}
      {...props}
    >
      {props.children}

      {showControls && nodeStateContext && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border-transparent">
          <button
            onClick={handleExpandTree}
            className="
              flex-1 px-2 py-1
              text-xs
              rounded
              bg-background-transparent-white-hover
              hover:bg-background-transparent-white-secondaryHover
              text-text-light
              transition-colors
              duration-200
            "
            title="Expand entire subtree"
          >
            Expand Tree
          </button>

          <button
            onClick={handleCollapseTree}
            className="
              flex-1 px-2 py-1
              text-xs
              rounded
              bg-background-transparent-white-hover
              hover:bg-background-transparent-white-secondaryHover
              text-text-light
              transition-colors
              duration-200
            "
            title="Collapse entire subtree"
          >
            Collapse Tree
          </button>

          <button
            onClick={handleExpandPath}
            className="
              flex-1 px-2 py-1
              text-xs
              rounded
              bg-background-transparent-white-hover
              hover:bg-background-transparent-white-secondaryHover
              text-text-light
              transition-colors
              duration-200
            "
            title="Expand path to root"
          >
            Show Path
          </button>
        </div>
      )}
    </CollapsibleNode>
  );
};

/**
 * Memoized CollapsibleNode for performance
 */
export const MemoizedCollapsibleNode = React.memo(
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
