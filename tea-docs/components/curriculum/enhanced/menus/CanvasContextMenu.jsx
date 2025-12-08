/**
 * Canvas Context Menu Component
 *
 * Context menu for canvas/pane with canvas-specific actions.
 * Supports node creation, layout, selection, and export.
 *
 * @module menus/CanvasContextMenu
 */

import React, { useMemo } from 'react';
import { ContextMenu } from './ContextMenu';
import { getCanvasMenuConfig, filterMenuItems } from './menuConfig';
import { executeAction } from './menuActions';

/**
 * CanvasContextMenu Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether menu is visible
 * @param {Object} props.position - { x, y } position for menu (in screen coordinates)
 * @param {Array} props.nodes - All nodes in the flow
 * @param {Array} props.edges - All edges in the flow
 * @param {Function} props.setNodes - React Flow setNodes function
 * @param {Function} props.setEdges - React Flow setEdges function
 * @param {Object} props.reactFlowInstance - React Flow instance
 * @param {Function} props.onClose - Callback when menu closes
 * @param {Object} props.callbacks - Custom callback handlers
 * @param {Object} props.clipboard - Clipboard state
 * @param {Function} props.setClipboard - Set clipboard function
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
}) => {
  /**
   * Convert screen position to flow coordinates
   */
  const flowPosition = useMemo(() => {
    if (!reactFlowInstance || !position) return position;

    try {
      return reactFlowInstance.screenToFlowPosition({
        x: position.x,
        y: position.y,
      });
    } catch (error) {
      console.warn('Could not convert to flow position:', error);
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
      checkClipboard: () => !!(clipboard && clipboard.data),
    });
  }, [clipboard]);

  /**
   * Handle menu action
   */
  const handleAction = (actionString, context, event) => {
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
      isOpen={isOpen}
      position={position} // Use screen coordinates for menu positioning
      menuItems={menuItems}
      onClose={onClose}
      onAction={handleAction}
      context={{ position: flowPosition }}
    />
  );
};

/**
 * useCanvasContextMenu Hook
 *
 * Hook for managing canvas context menu state
 *
 * @param {Object} params
 * @param {Array} params.nodes - All nodes
 * @param {Array} params.edges - All edges
 * @param {Function} params.setNodes - setNodes function
 * @param {Function} params.setEdges - setEdges function
 * @param {Object} params.reactFlowInstance - React Flow instance
 * @param {Object} params.callbacks - Custom callbacks
 */
export function useCanvasContextMenu({
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
   * Handle pane/canvas right-click
   */
  const handlePaneContextMenu = React.useCallback((event) => {
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
        isOpen={!!contextMenu}
        position={contextMenu.position}
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
}) => {
  const {
    handlePaneContextMenu,
    CanvasContextMenu,
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
      {CanvasContextMenu}
    </>
  );
};

/**
 * withCanvasContextMenu HOC
 *
 * Higher-order component to add canvas context menu to React Flow
 */
export function withCanvasContextMenu(ReactFlowComponent) {
  return function CanvasContextMenuEnhanced(props) {
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
      CanvasContextMenu,
    } = useCanvasContextMenu({
      nodes,
      edges,
      setNodes,
      setEdges,
      reactFlowInstance,
      callbacks: canvasContextCallbacks,
    });

    // Combine custom handler with hook handler
    const combinedHandler = React.useCallback((event) => {
      handlePaneContextMenu(event);
      onPaneContextMenu?.(event);
    }, [handlePaneContextMenu, onPaneContextMenu]);

    return (
      <>
        <ReactFlowComponent
          {...otherProps}
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          onPaneContextMenu={combinedHandler}
        />
        {CanvasContextMenu}
      </>
    );
  };
}

/**
 * Helper: Get grid snap position
 */
export function snapToGrid(position, gridSize = 15) {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}

/**
 * Helper: Check if position is empty (no nodes nearby)
 */
export function isPositionEmpty(position, nodes, threshold = 50) {
  return !nodes.some(node => {
    const distance = Math.sqrt(
      Math.pow(node.position.x - position.x, 2) +
      Math.pow(node.position.y - position.y, 2)
    );
    return distance < threshold;
  });
}

/**
 * Helper: Find optimal position for new node
 */
export function findOptimalPosition(requestedPosition, nodes, gridSize = 15) {
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
