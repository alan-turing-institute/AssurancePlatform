/**
 * Context Menu System
 *
 * Complete context menu system for React Flow with node, edge, and canvas menus.
 *
 * @module menus
 */

// Base Components
export { ContextMenu, useContextMenu, withContextMenu, ContextMenuProvider, ContextMenuContext, useContextMenuContext, ContextMenuTrigger, useDebounceContextMenu } from './ContextMenu';

// Menu Items
export { MenuItem, MenuSeparator, MenuHeader, MenuFooter, RecentActionsMenu, KeyboardShortcutsHint, SearchableMenu, renderMenuItems, MenuItemGroup, ConditionalMenuItem } from './MenuItems';

// Specific Context Menus
export { NodeContextMenu, useNodeContextMenu, NodeContextMenuWrapper, withNodeContextMenu, getNodeTypeLabel, getNodeTypeColor } from './NodeContextMenu';
export { EdgeContextMenu, useEdgeContextMenu, EdgeContextMenuWrapper, withEdgeContextMenu, getEdgeTypeLabel, getEdgeStylePresets, applyEdgeStylePreset } from './EdgeContextMenu';
export { CanvasContextMenu, useCanvasContextMenu, CanvasContextMenuWrapper, withCanvasContextMenu, snapToGrid, isPositionEmpty, findOptimalPosition } from './CanvasContextMenu';

// Configuration and Actions
export { nodeMenuConfig, edgeMenuConfig, canvasMenuConfig, multiSelectMenuConfig, getNodeMenuConfig, getEdgeMenuConfig, getCanvasMenuConfig, getMultiSelectMenuConfig, filterMenuItems } from './menuConfig';
export { menuActions, executeAction, checkClipboard } from './menuActions';

/**
 * Default export with all modules
 */
export default {
  // Base
  ContextMenu: require('./ContextMenu').ContextMenu,
  useContextMenu: require('./ContextMenu').useContextMenu,

  // Menu Items
  MenuItem: require('./MenuItems').MenuItem,
  MenuSeparator: require('./MenuItems').MenuSeparator,

  // Specific Menus
  NodeContextMenu: require('./NodeContextMenu').NodeContextMenu,
  EdgeContextMenu: require('./EdgeContextMenu').EdgeContextMenu,
  CanvasContextMenu: require('./CanvasContextMenu').CanvasContextMenu,

  // Hooks
  useNodeContextMenu: require('./NodeContextMenu').useNodeContextMenu,
  useEdgeContextMenu: require('./EdgeContextMenu').useEdgeContextMenu,
  useCanvasContextMenu: require('./CanvasContextMenu').useCanvasContextMenu,

  // Config and Actions
  menuConfig: require('./menuConfig'),
  menuActions: require('./menuActions'),
};
