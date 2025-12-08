/**
 * Node Context Menu Component
 *
 * Context menu for nodes with node-specific actions based on type.
 * Supports single and multi-node selections.
 *
 * @module menus/NodeContextMenu
 */

import React, { useMemo } from 'react';
import { ContextMenu } from './ContextMenu';
import {
  getNodeMenuConfig,
  getMultiSelectMenuConfig,
  filterMenuItems,
} from './menuConfig';
import { executeAction } from './menuActions';

/**
 * NodeContextMenu Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether menu is visible
 * @param {Object} props.position - { x, y } position for menu
 * @param {Object|Array} props.node - Selected node(s)
 * @param {Array} props.nodes - All nodes in the flow
 * @param {Array} props.edges - All edges in the flow
 * @param {Function} props.setNodes - React Flow setNodes function
 * @param {Function} props.setEdges - React Flow setEdges function
 * @param {Object} props.reactFlowInstance - React Flow instance
 * @param {Function} props.onClose - Callback when menu closes
 * @param {Object} props.callbacks - Custom callback handlers (onEdit, onDelete, etc.)
 * @param {Object} props.clipboard - Clipboard state
 * @param {Function} props.setClipboard - Set clipboard function
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
}) => {
  /**
   * Determine if this is a multi-select context
   */
  const isMultiSelect = Array.isArray(node) && node.length > 1;
  const selectedNodes = isMultiSelect ? node : (node ? [node] : []);
  const singleNode = isMultiSelect ? null : node;

  /**
   * Get appropriate menu configuration
   */
  const menuItems = useMemo(() => {
    if (isMultiSelect) {
      return getMultiSelectMenuConfig();
    }

    if (singleNode) {
      const nodeType = singleNode.type || 'goal';
      const config = getNodeMenuConfig(nodeType);

      // Filter items based on current state
      return filterMenuItems(config, {
        node: singleNode,
        clipboard,
        checkClipboard: () => !!(clipboard && clipboard.data),
      });
    }

    return [];
  }, [isMultiSelect, singleNode, clipboard]);

  /**
   * Handle menu action
   */
  const handleAction = (actionString, context, event) => {
    const actionContext = {
      // Single node context
      node: singleNode,

      // Multi-select context
      selectedNodes: isMultiSelect ? selectedNodes : null,

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
      isOpen={isOpen}
      position={position}
      menuItems={menuItems}
      onClose={onClose}
      onAction={handleAction}
      context={{ node: singleNode, selectedNodes }}
    />
  );
};

/**
 * useNodeContextMenu Hook
 *
 * Hook for managing node context menu state
 *
 * @param {Object} params
 * @param {Array} params.nodes - All nodes
 * @param {Array} params.edges - All edges
 * @param {Function} params.setNodes - setNodes function
 * @param {Function} params.setEdges - setEdges function
 * @param {Object} params.reactFlowInstance - React Flow instance
 * @param {Object} params.callbacks - Custom callbacks
 */
export function useNodeContextMenu({
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
  callbacks = {},
}) {
  const [contextMenu, setContextMenu] = React.useState(null);
  const [clipboard, setClipboard] = React.useState(null);

  /**
   * Handle node right-click
   */
  const handleNodeContextMenu = React.useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();

    // Check if this is part of a multi-selection
    const selectedNodes = nodes.filter(n => n.selected);

    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      node: selectedNodes.length > 1 ? selectedNodes : node,
    });
  }, [nodes]);

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
        isOpen={!!contextMenu}
        position={contextMenu.position}
        node={contextMenu.node}
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        reactFlowInstance={reactFlowInstance}
        onClose={closeContextMenu}
        callbacks={callbacks}
        clipboard={clipboard}
        setClipboard={setClipboard}
      />
    ) : null,
  };
}

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
}) => {
  const {
    handleNodeContextMenu,
    NodeContextMenu,
  } = useNodeContextMenu({
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
      {NodeContextMenu}
    </>
  );
};

/**
 * withNodeContextMenu HOC
 *
 * Higher-order component to add node context menu to React Flow
 */
export function withNodeContextMenu(ReactFlowComponent) {
  return function NodeContextMenuEnhanced(props) {
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

    const {
      handleNodeContextMenu,
      NodeContextMenu,
    } = useNodeContextMenu({
      nodes,
      edges,
      setNodes,
      setEdges,
      reactFlowInstance,
      callbacks: nodeContextCallbacks,
    });

    // Combine custom handler with hook handler
    const combinedHandler = React.useCallback((event, node) => {
      handleNodeContextMenu(event, node);
      onNodeContextMenu?.(event, node);
    }, [handleNodeContextMenu, onNodeContextMenu]);

    return (
      <>
        <ReactFlowComponent
          {...otherProps}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onNodeContextMenu={combinedHandler}
        />
        {NodeContextMenu}
      </>
    );
  };
}

/**
 * Helper: Get node type label
 */
export function getNodeTypeLabel(nodeType) {
  const labels = {
    goal: 'Goal',
    strategy: 'Strategy',
    propertyClaim: 'Property Claim',
    evidence: 'Evidence',
    context: 'Context',
  };
  return labels[nodeType] || 'Node';
}

/**
 * Helper: Get node type color
 */
export function getNodeTypeColor(nodeType) {
  const colors = {
    goal: 'green',
    strategy: 'purple',
    propertyClaim: 'orange',
    evidence: 'cyan',
    context: 'gray',
  };
  return colors[nodeType] || 'blue';
}

export default NodeContextMenu;
