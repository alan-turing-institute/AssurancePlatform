/**
 * Context Menu Configuration
 *
 * Defines menu structures for different contexts (node types, edges, canvas).
 * Based on REACT_FLOW.md Section 5.4.2 specifications.
 *
 * @module menus/menuConfig
 */

import type { LucideIcon } from "lucide-react";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle,
	ChevronDown,
	Circle,
	Clipboard,
	Copy,
	Download,
	Edit,
	Eye,
	EyeOff,
	FileText,
	Flag,
	GitBranch,
	Image,
	Layers,
	Layout,
	Link,
	Maximize2,
	Minimize2,
	PaintBucket,
	RotateCcw,
	Target,
	Trash2,
	Zap,
} from "lucide-react";

/**
 * Menu separator type
 */
type MenuSeparator = {
	type: "separator";
};

/**
 * Regular menu item type
 */
type MenuItem = {
	label: string;
	icon?: LucideIcon;
	action?: string;
	shortcut?: string;
	description?: string;
	submenu?: MenuItemConfig[];
	disabled?: boolean | string | ((context: unknown) => boolean);
	dangerous?: boolean;
	color?: string;
	type?: never;
};

/**
 * Menu item configuration type (can be a regular item or separator)
 */
type MenuItemConfig = MenuItem | MenuSeparator;

/**
 * Node-specific menu configurations
 * Each node type has a tailored set of actions
 */
export const nodeMenuConfig: Record<string, MenuItemConfig[]> = {
	goal: [
		{
			label: "Edit Goal",
			icon: Edit,
			action: "edit",
			shortcut: "E",
			description: "Edit goal details",
		},
		{
			label: "Set Priority",
			icon: Flag,
			action: "setPriority",
			description: "Change goal priority level",
			submenu: [
				{
					label: "Critical",
					action: "setPriority:critical",
					icon: Flag,
					color: "red",
				},
				{
					label: "High",
					action: "setPriority:high",
					icon: Flag,
					color: "orange",
				},
				{
					label: "Medium",
					action: "setPriority:medium",
					icon: Flag,
					color: "yellow",
				},
				{ label: "Low", action: "setPriority:low", icon: Flag, color: "blue" },
			],
		},
		{
			label: "Mark Complete",
			icon: CheckCircle,
			action: "markComplete",
			description: "Mark this goal as completed",
		},
		{ type: "separator" },
		{
			label: "Reveal Children",
			icon: Eye,
			action: "revealChildren",
			description: "Show immediate child nodes",
		},
		{
			label: "Hide Children",
			icon: EyeOff,
			action: "hideChildren",
			description: "Hide immediate child nodes",
		},
		{
			label: "Reveal All Descendants",
			icon: ChevronDown,
			action: "revealAllDescendants",
			description: "Recursively show all descendants",
		},
		{ type: "separator" },
		{
			label: "Duplicate",
			icon: Copy,
			action: "duplicate",
			shortcut: "Ctrl+D",
			description: "Create a copy of this goal",
		},
		{
			label: "Copy Style",
			icon: PaintBucket,
			action: "copyStyle",
			description: "Copy visual styling",
		},
		{ type: "separator" },
		{
			label: "Focus Node",
			icon: Maximize2,
			action: "focus",
			shortcut: "F",
			description: "Center view on this node",
		},
		{ type: "separator" },
		{
			label: "Delete",
			icon: Trash2,
			action: "delete",
			shortcut: "Del",
			description: "Remove this goal",
			dangerous: true,
		},
	],

	strategy: [
		{
			label: "Edit Strategy",
			icon: Edit,
			action: "edit",
			shortcut: "E",
			description: "Edit strategy details",
		},
		{
			label: "Change Type",
			icon: GitBranch,
			action: "changeType",
			description: "Switch between AND/OR strategy",
			submenu: [
				{
					label: "AND Strategy",
					action: "changeType:and",
					icon: Circle,
					description: "All sub-goals required",
				},
				{
					label: "OR Strategy",
					action: "changeType:or",
					icon: Circle,
					description: "Any sub-goal sufficient",
				},
			],
		},
		{ type: "separator" },
		{
			label: "Reveal Children",
			icon: Eye,
			action: "revealChildren",
			description: "Show immediate child nodes",
		},
		{
			label: "Hide Children",
			icon: EyeOff,
			action: "hideChildren",
			description: "Hide immediate child nodes",
		},
		{
			label: "Reveal All Descendants",
			icon: ChevronDown,
			action: "revealAllDescendants",
			description: "Recursively show all descendants",
		},
		{ type: "separator" },
		{
			label: "Duplicate",
			icon: Copy,
			action: "duplicate",
			shortcut: "Ctrl+D",
			description: "Create a copy of this strategy",
		},
		{
			label: "Copy Style",
			icon: PaintBucket,
			action: "copyStyle",
			description: "Copy visual styling",
		},
		{ type: "separator" },
		{
			label: "Expand All",
			icon: Maximize2,
			action: "expandAll",
			description: "Expand this and all children",
		},
		{
			label: "Collapse All",
			icon: Minimize2,
			action: "collapseAll",
			description: "Collapse this and all children",
		},
		{ type: "separator" },
		{
			label: "Focus Node",
			icon: Maximize2,
			action: "focus",
			shortcut: "F",
			description: "Center view on this node",
		},
		{ type: "separator" },
		{
			label: "Delete",
			icon: Trash2,
			action: "delete",
			shortcut: "Del",
			description: "Remove this strategy",
			dangerous: true,
		},
	],

	propertyClaim: [
		{
			label: "Edit Claim",
			icon: Edit,
			action: "edit",
			shortcut: "E",
			description: "Edit claim details",
		},
		{
			label: "Verify Claim",
			icon: CheckCircle,
			action: "verify",
			description: "Mark claim as verified",
		},
		{
			label: "Add Evidence",
			icon: Link,
			action: "addEvidence",
			description: "Link supporting evidence",
		},
		{ type: "separator" },
		{
			label: "Update Status",
			icon: Circle,
			action: "updateStatus",
			description: "Change claim status",
			submenu: [
				{
					label: "Verified",
					action: "updateStatus:verified",
					icon: CheckCircle,
					color: "green",
				},
				{
					label: "Pending",
					action: "updateStatus:pending",
					icon: Circle,
					color: "yellow",
				},
				{
					label: "Disputed",
					action: "updateStatus:disputed",
					icon: AlertCircle,
					color: "red",
				},
			],
		},
		{ type: "separator" },
		{
			label: "Reveal Children",
			icon: Eye,
			action: "revealChildren",
			description: "Show immediate child nodes",
		},
		{
			label: "Hide Children",
			icon: EyeOff,
			action: "hideChildren",
			description: "Hide immediate child nodes",
		},
		{
			label: "Reveal All Descendants",
			icon: ChevronDown,
			action: "revealAllDescendants",
			description: "Recursively show all descendants",
		},
		{ type: "separator" },
		{
			label: "Duplicate",
			icon: Copy,
			action: "duplicate",
			shortcut: "Ctrl+D",
			description: "Create a copy of this claim",
		},
		{
			label: "Copy Style",
			icon: PaintBucket,
			action: "copyStyle",
			description: "Copy visual styling",
		},
		{ type: "separator" },
		{
			label: "Focus Node",
			icon: Maximize2,
			action: "focus",
			shortcut: "F",
			description: "Center view on this node",
		},
		{ type: "separator" },
		{
			label: "Delete",
			icon: Trash2,
			action: "delete",
			shortcut: "Del",
			description: "Remove this claim",
			dangerous: true,
		},
	],

	evidence: [
		{
			label: "Edit Evidence",
			icon: Edit,
			action: "edit",
			shortcut: "E",
			description: "Edit evidence details",
		},
		{
			label: "Update Confidence",
			icon: Zap,
			action: "updateConfidence",
			description: "Set confidence level",
			submenu: [
				{
					label: "High",
					action: "updateConfidence:high",
					icon: Zap,
					color: "green",
				},
				{
					label: "Medium",
					action: "updateConfidence:medium",
					icon: Zap,
					color: "yellow",
				},
				{
					label: "Low",
					action: "updateConfidence:low",
					icon: Zap,
					color: "orange",
				},
				{
					label: "Unverified",
					action: "updateConfidence:unverified",
					icon: AlertCircle,
					color: "gray",
				},
			],
		},
		{
			label: "Link Source",
			icon: Link,
			action: "linkSource",
			description: "Add external source reference",
		},
		{ type: "separator" },
		{
			label: "View Details",
			icon: Eye,
			action: "viewDetails",
			description: "Show full evidence details",
		},
		{ type: "separator" },
		{
			label: "Duplicate",
			icon: Copy,
			action: "duplicate",
			shortcut: "Ctrl+D",
			description: "Create a copy of this evidence",
		},
		{
			label: "Copy Style",
			icon: PaintBucket,
			action: "copyStyle",
			description: "Copy visual styling",
		},
		{ type: "separator" },
		{
			label: "Focus Node",
			icon: Maximize2,
			action: "focus",
			shortcut: "F",
			description: "Center view on this node",
		},
		{ type: "separator" },
		{
			label: "Delete",
			icon: Trash2,
			action: "delete",
			shortcut: "Del",
			description: "Remove this evidence",
			dangerous: true,
		},
	],

	context: [
		{
			label: "Edit Context",
			icon: Edit,
			action: "edit",
			shortcut: "E",
			description: "Edit context details",
		},
		{
			label: "Change Importance",
			icon: Flag,
			action: "changeImportance",
			description: "Set importance level",
			submenu: [
				{
					label: "Critical",
					action: "changeImportance:critical",
					icon: AlertCircle,
					color: "red",
				},
				{
					label: "Important",
					action: "changeImportance:important",
					icon: Flag,
					color: "orange",
				},
				{
					label: "Normal",
					action: "changeImportance:normal",
					icon: Circle,
					color: "blue",
				},
				{
					label: "Reference",
					action: "changeImportance:reference",
					icon: FileText,
					color: "gray",
				},
			],
		},
		{ type: "separator" },
		{
			label: "Show/Hide",
			icon: Eye,
			action: "toggleVisibility",
			description: "Toggle context visibility",
		},
		{ type: "separator" },
		{
			label: "Duplicate",
			icon: Copy,
			action: "duplicate",
			shortcut: "Ctrl+D",
			description: "Create a copy of this context",
		},
		{
			label: "Copy Style",
			icon: PaintBucket,
			action: "copyStyle",
			description: "Copy visual styling",
		},
		{ type: "separator" },
		{
			label: "Focus Node",
			icon: Maximize2,
			action: "focus",
			shortcut: "F",
			description: "Center view on this node",
		},
		{ type: "separator" },
		{
			label: "Delete",
			icon: Trash2,
			action: "delete",
			shortcut: "Del",
			description: "Remove this context",
			dangerous: true,
		},
	],
};

/**
 * Multi-select menu configuration
 * Used when multiple nodes are selected
 */
export const multiSelectMenuConfig: MenuItemConfig[] = [
	{
		label: "Align Nodes",
		icon: Layout,
		action: "align",
		description: "Align selected nodes",
		submenu: [
			{ label: "Align Left", action: "align:left", icon: Layout },
			{ label: "Align Center", action: "align:center", icon: Layout },
			{ label: "Align Right", action: "align:right", icon: Layout },
			{ label: "Align Top", action: "align:top", icon: Layout },
			{ label: "Align Middle", action: "align:middle", icon: Layout },
			{ label: "Align Bottom", action: "align:bottom", icon: Layout },
		],
	},
	{
		label: "Distribute",
		icon: Layers,
		action: "distribute",
		description: "Evenly space nodes",
		submenu: [
			{ label: "Horizontally", action: "distribute:horizontal", icon: Layers },
			{ label: "Vertically", action: "distribute:vertical", icon: Layers },
		],
	},
	{ type: "separator" },
	{
		label: "Group",
		icon: Layers,
		action: "group",
		shortcut: "Ctrl+G",
		description: "Group selected nodes",
	},
	{ type: "separator" },
	{
		label: "Copy All",
		icon: Copy,
		action: "copyAll",
		shortcut: "Ctrl+C",
		description: "Copy all selected nodes",
	},
	{
		label: "Delete All",
		icon: Trash2,
		action: "deleteAll",
		shortcut: "Del",
		description: "Delete all selected nodes",
		dangerous: true,
	},
];

/**
 * Edge menu configuration
 * Actions available for connections between nodes
 */
export const edgeMenuConfig: MenuItemConfig[] = [
	{
		label: "Edit Label",
		icon: Edit,
		action: "editLabel",
		description: "Change edge label",
	},
	{
		label: "Change Type",
		icon: ArrowRight,
		action: "changeEdgeType",
		description: "Select edge visualization",
		submenu: [
			{
				label: "Straight",
				action: "changeEdgeType:straight",
				icon: ArrowRight,
			},
			{
				label: "Smooth Step",
				action: "changeEdgeType:smoothstep",
				icon: ArrowRight,
			},
			{ label: "Bezier", action: "changeEdgeType:default", icon: ArrowRight },
			{ label: "Step", action: "changeEdgeType:step", icon: ArrowRight },
		],
	},
	{
		label: "Edge Style",
		icon: PaintBucket,
		action: "changeEdgeStyle",
		description: "Change edge appearance",
		submenu: [
			{ label: "Solid", action: "changeEdgeStyle:solid" },
			{ label: "Dashed", action: "changeEdgeStyle:dashed" },
			{ label: "Dotted", action: "changeEdgeStyle:dotted" },
			{ label: "Animated", action: "changeEdgeStyle:animated" },
			{ label: "Gradient", action: "changeEdgeStyle:gradient" },
		],
	},
	{ type: "separator" },
	{
		label: "Add Waypoint",
		icon: Circle,
		action: "addWaypoint",
		description: "Add control point",
	},
	{
		label: "Change Strength",
		icon: Zap,
		action: "changeStrength",
		description: "Set edge weight",
		submenu: [
			{
				label: "Strong",
				action: "changeStrength:strong",
				description: "Thick line",
			},
			{
				label: "Normal",
				action: "changeStrength:normal",
				description: "Default width",
			},
			{
				label: "Weak",
				action: "changeStrength:weak",
				description: "Thin line",
			},
		],
	},
	{ type: "separator" },
	{
		label: "Reverse Direction",
		icon: RotateCcw,
		action: "reverse",
		description: "Flip source and target",
	},
	{ type: "separator" },
	{
		label: "Delete",
		icon: Trash2,
		action: "deleteEdge",
		shortcut: "Del",
		description: "Remove connection",
		dangerous: true,
	},
];

/**
 * Canvas/pane menu configuration
 * Actions available when right-clicking on empty canvas
 */
export const canvasMenuConfig: MenuItemConfig[] = [
	{
		label: "Create Node Here",
		icon: Target,
		action: "createNode",
		description: "Add new node at this position",
		submenu: [
			{
				label: "Goal",
				action: "createNode:goal",
				icon: Target,
				color: "green",
			},
			{
				label: "Strategy",
				action: "createNode:strategy",
				icon: GitBranch,
				color: "purple",
			},
			{
				label: "Property Claim",
				action: "createNode:propertyClaim",
				icon: FileText,
				color: "orange",
			},
			{
				label: "Evidence",
				action: "createNode:evidence",
				icon: CheckCircle,
				color: "cyan",
			},
			{
				label: "Context",
				action: "createNode:context",
				icon: AlertCircle,
				color: "gray",
			},
		],
	},
	{ type: "separator" },
	{
		label: "Paste",
		icon: Clipboard,
		action: "paste",
		shortcut: "Ctrl+V",
		description: "Paste from clipboard",
		disabled: "checkClipboard", // Function name to check if enabled
	},
	{ type: "separator" },
	{
		label: "Select All",
		icon: Layers,
		action: "selectAll",
		shortcut: "Ctrl+A",
		description: "Select all nodes",
	},
	{
		label: "Auto Layout",
		icon: Layout,
		action: "autoLayout",
		description: "Automatically arrange nodes",
		submenu: [
			{
				label: "Hierarchical",
				action: "autoLayout:hierarchical",
				description: "Top-down tree layout",
			},
			{
				label: "Force Directed",
				action: "autoLayout:force",
				description: "Physics-based layout",
			},
			{
				label: "Grid",
				action: "autoLayout:grid",
				description: "Align to grid",
			},
		],
	},
	{ type: "separator" },
	{
		label: "Reset View",
		icon: Maximize2,
		action: "resetView",
		shortcut: "Ctrl+0",
		description: "Fit all nodes in view",
	},
	{
		label: "Export as Image",
		icon: Image,
		action: "exportImage",
		description: "Save as PNG/SVG",
		submenu: [
			{ label: "PNG", action: "exportImage:png", icon: Download },
			{ label: "SVG", action: "exportImage:svg", icon: Download },
			{ label: "JPEG", action: "exportImage:jpeg", icon: Download },
		],
	},
];

/**
 * Get menu configuration for a specific node type
 */
export function getNodeMenuConfig(nodeType: string): MenuItemConfig[] {
	return nodeMenuConfig[nodeType] || nodeMenuConfig.goal;
}

/**
 * Get menu configuration for edge
 */
export function getEdgeMenuConfig(): MenuItemConfig[] {
	return edgeMenuConfig;
}

/**
 * Get menu configuration for canvas
 */
export function getCanvasMenuConfig(): MenuItemConfig[] {
	return canvasMenuConfig;
}

/**
 * Get menu configuration for multi-selection
 */
export function getMultiSelectMenuConfig(): MenuItemConfig[] {
	return multiSelectMenuConfig;
}

/**
 * Check if a menu item should be included based on its disabled state
 */
function shouldIncludeItem(
	item: MenuItemConfig,
	context: Record<string, unknown>
): boolean {
	// Include separators
	if (item.type === "separator") {
		return true;
	}

	// Check function-based disabled condition
	if (typeof item.disabled === "function") {
		return !item.disabled(context);
	}

	// Check string-based disabled condition (context function)
	if (typeof item.disabled === "string" && context[item.disabled]) {
		const disabledCheck = context[item.disabled];
		if (typeof disabledCheck === "function") {
			return !disabledCheck();
		}
	}

	// Include if not disabled
	return !item.disabled;
}

/**
 * Filter menu items based on conditions
 */
export function filterMenuItems(
	menuItems: MenuItemConfig[],
	context: Record<string, unknown> = {}
): MenuItemConfig[] {
	const filteredItems: MenuItemConfig[] = [];

	for (const item of menuItems) {
		if (shouldIncludeItem(item, context)) {
			filteredItems.push(item);
		}
	}

	return filteredItems;
}

export default {
	nodeMenuConfig,
	edgeMenuConfig,
	canvasMenuConfig,
	multiSelectMenuConfig,
	getNodeMenuConfig,
	getEdgeMenuConfig,
	getCanvasMenuConfig,
	getMultiSelectMenuConfig,
	filterMenuItems,
};
