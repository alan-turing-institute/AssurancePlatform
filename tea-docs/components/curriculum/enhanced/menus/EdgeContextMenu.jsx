/**
 * Edge Context Menu Component
 *
 * Context menu for edges with edge-specific actions.
 * Supports edge styling, type changes, and connection management.
 *
 * @module menus/EdgeContextMenu
 */

import React, { useMemo } from 'react';
import { ContextMenu } from './ContextMenu';
import { getEdgeMenuConfig, filterMenuItems } from './menuConfig';
import { executeAction } from './menuActions';

/**
 * EdgeContextMenu Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether menu is visible
 * @param {Object} props.position - { x, y } position for menu
 * @param {Object} props.edge - Selected edge
 * @param {Array} props.edges - All edges in the flow
 * @param {Function} props.setEdges - React Flow setEdges function
 * @param {Object} props.reactFlowInstance - React Flow instance
 * @param {Function} props.onClose - Callback when menu closes
 * @param {Object} props.callbacks - Custom callback handlers
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
}) => {
  /**
   * Get edge menu configuration
   */
  const menuItems = useMemo(() => {
    if (!edge) return [];

    const config = getEdgeMenuConfig();

    // Filter items based on current state
    return filterMenuItems(config, { edge });
  }, [edge]);

  /**
   * Handle menu action
   */
  const handleAction = (actionString, context, event) => {
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
      isOpen={isOpen}
      position={position}
      menuItems={menuItems}
      onClose={onClose}
      onAction={handleAction}
      context={{ edge }}
    />
  );
};

/**
 * useEdgeContextMenu Hook
 *
 * Hook for managing edge context menu state
 *
 * @param {Object} params
 * @param {Array} params.edges - All edges
 * @param {Function} params.setEdges - setEdges function
 * @param {Object} params.reactFlowInstance - React Flow instance
 * @param {Object} params.callbacks - Custom callbacks
 */
export function useEdgeContextMenu({
  edges,
  setEdges,
  reactFlowInstance,
  callbacks = {},
}) {
  const [contextMenu, setContextMenu] = React.useState(null);

  /**
   * Handle edge right-click
   */
  const handleEdgeContextMenu = React.useCallback((event, edge) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      edge,
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
    edge: contextMenu?.edge,
    handleEdgeContextMenu,
    closeContextMenu,
    // Render component
    EdgeContextMenu: contextMenu ? (
      <EdgeContextMenu
        isOpen={!!contextMenu}
        position={contextMenu.position}
        edge={contextMenu.edge}
        edges={edges}
        setEdges={setEdges}
        reactFlowInstance={reactFlowInstance}
        onClose={closeContextMenu}
        callbacks={callbacks}
      />
    ) : null,
  };
}

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
}) => {
  const {
    handleEdgeContextMenu,
    EdgeContextMenu,
  } = useEdgeContextMenu({
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
      {EdgeContextMenu}
    </>
  );
};

/**
 * withEdgeContextMenu HOC
 *
 * Higher-order component to add edge context menu to React Flow
 */
export function withEdgeContextMenu(ReactFlowComponent) {
  return function EdgeContextMenuEnhanced(props) {
    const {
      edges,
      setEdges,
      reactFlowInstance,
      onEdgeContextMenu,
      edgeContextCallbacks,
      ...otherProps
    } = props;

    const {
      handleEdgeContextMenu,
      EdgeContextMenu,
    } = useEdgeContextMenu({
      edges,
      setEdges,
      reactFlowInstance,
      callbacks: edgeContextCallbacks,
    });

    // Combine custom handler with hook handler
    const combinedHandler = React.useCallback((event, edge) => {
      handleEdgeContextMenu(event, edge);
      onEdgeContextMenu?.(event, edge);
    }, [handleEdgeContextMenu, onEdgeContextMenu]);

    return (
      <>
        <ReactFlowComponent
          {...otherProps}
          edges={edges}
          setEdges={setEdges}
          onEdgeContextMenu={combinedHandler}
        />
        {EdgeContextMenu}
      </>
    );
  };
}

/**
 * Helper: Get edge type label
 */
export function getEdgeTypeLabel(edgeType) {
  const labels = {
    default: 'Bezier',
    straight: 'Straight',
    step: 'Step',
    smoothstep: 'Smooth Step',
    simplebezier: 'Simple Bezier',
  };
  return labels[edgeType] || 'Default';
}

/**
 * Helper: Get edge style presets
 */
export function getEdgeStylePresets() {
  return {
    solid: {
      strokeDasharray: 'none',
      animated: false,
      description: 'Solid line',
    },
    dashed: {
      strokeDasharray: '5 5',
      animated: false,
      description: 'Dashed line',
    },
    dotted: {
      strokeDasharray: '1 3',
      animated: false,
      description: 'Dotted line',
    },
    animated: {
      strokeDasharray: '5 5',
      animated: true,
      description: 'Animated dashed line',
    },
    gradient: {
      stroke: 'url(#edge-gradient)',
      animated: false,
      description: 'Gradient colored line',
    },
  };
}

/**
 * Helper: Apply edge style preset
 */
export function applyEdgeStylePreset(edge, presetName) {
  const presets = getEdgeStylePresets();
  const preset = presets[presetName];

  if (!preset) return edge;

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
