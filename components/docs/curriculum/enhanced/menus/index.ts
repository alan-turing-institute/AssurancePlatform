/**
 * Context Menu System
 *
 * Central export point for all menu components.
 *
 * @module menus
 */

// Canvas Context Menu
// Default exports for backward compatibility
export {
	CanvasContextMenu,
	CanvasContextMenuWrapper,
	default as CanvasContextMenuDefault,
	findOptimalPosition,
	isPositionEmpty,
	snapToGrid,
	useCanvasContextMenu,
	withCanvasContextMenu,
} from "./canvas-context-menu";
// Context Menu (TypeScript)
export { ContextMenu, useContextMenu } from "./context-menu";
// Demo
export {
	ContextMenuDemo,
	ContextMenuDemoWrapper,
	default as ContextMenuDemoDefault,
} from "./context-menu-demo";
// Edge Context Menu
export {
	applyEdgeStylePreset,
	default as EdgeContextMenuDefault,
	EdgeContextMenu,
	EdgeContextMenuWrapper,
	getEdgeStylePresets,
	getEdgeTypeLabel,
	useEdgeContextMenu,
	withEdgeContextMenu,
} from "./edge-context-menu";
// Configuration and utilities (TypeScript)
export * from "./menu-actions";
export * from "./menu-config";
// Menu Items
export {
	ConditionalMenuItem,
	default as MenuItemsDefault,
	KeyboardShortcutsHint,
	MenuFooter,
	MenuHeader,
	MenuItem,
	MenuItemGroup,
	MenuSeparator,
	RecentActionsMenu,
	renderMenuItems,
	SearchableMenu,
} from "./menu-items";
// Node Context Menu
export {
	default as NodeContextMenuDefault,
	getNodeTypeColor,
	getNodeTypeLabel,
	NodeContextMenu,
	NodeContextMenuWrapper,
	useNodeContextMenu,
	withNodeContextMenu,
} from "./node-context-menu";
