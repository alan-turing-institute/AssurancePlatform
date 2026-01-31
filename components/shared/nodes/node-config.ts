/**
 * Node Configuration
 *
 * Defines node type configurations including colours, icons, and labels
 * for the assurance case diagram nodes.
 *
 * Uses tinted backgrounds matching the curriculum design system.
 */

import type { LucideIcon } from "lucide-react";
import { CheckCircle, FileText, GitBranch, Target } from "lucide-react";

export type NodeType = "goal" | "strategy" | "property" | "evidence";

export type NodeColourScheme = {
	/** Light mode background (e.g., bg-green-50) */
	bgLight: string;
	/** Dark mode background (e.g., bg-green-950) */
	bgDark: string;
	/** Border colour */
	border: string;
	/** Border colour on hover */
	borderHover: string;
	/** Icon colour */
	icon: string;
	/** Icon colour on hover */
	iconHover: string;
	/** Ring colour for selected state */
	ring: string;
	/** Text colour for light mode */
	textLight: string;
	/** Text colour for dark mode */
	textDark: string;
};

export type NodeTypeConfig = {
	id: NodeType;
	label: string;
	description: string;
	icon: LucideIcon;
	colours: NodeColourScheme;
	/** Whether to show target handle (top) */
	showTargetHandle: boolean;
	/** Whether to show source handle (bottom) */
	showSourceHandle: boolean;
};

/**
 * Node type configurations using the curriculum colour scheme:
 * - Goal: Green
 * - Strategy: Purple
 * - Property: Orange
 * - Evidence: Cyan
 *
 * Uses light tinted backgrounds (bg-{color}-50) for light mode
 * and dark tinted backgrounds (bg-{color}-950) for dark mode.
 */
export const nodeTypeConfigs: Record<NodeType, NodeTypeConfig> = {
	goal: {
		id: "goal",
		label: "Goal",
		description: "Top-level system property to be assured",
		icon: Target,
		colours: {
			bgLight: "bg-node-goal/5",
			bgDark: "bg-node-goal/10",
			border: "border-node-goal/30",
			borderHover: "border-node-goal/50",
			icon: "text-node-goal",
			iconHover: "text-node-goal/80",
			ring: "ring-node-goal/50",
			textLight: "text-foreground",
			textDark: "text-foreground",
		},
		showTargetHandle: false,
		showSourceHandle: true,
	},
	strategy: {
		id: "strategy",
		label: "Strategy",
		description: "Approach for decomposing a goal",
		icon: GitBranch,
		colours: {
			bgLight: "bg-node-strategy/5",
			bgDark: "bg-node-strategy/10",
			border: "border-node-strategy/30",
			borderHover: "border-node-strategy/50",
			icon: "text-node-strategy",
			iconHover: "text-node-strategy/80",
			ring: "ring-node-strategy/50",
			textLight: "text-foreground",
			textDark: "text-foreground",
		},
		showTargetHandle: true,
		showSourceHandle: true,
	},
	property: {
		id: "property",
		label: "Property Claim",
		description: "Specific property or sub-claim",
		icon: FileText,
		colours: {
			bgLight: "bg-node-property/5",
			bgDark: "bg-node-property/10",
			border: "border-node-property/30",
			borderHover: "border-node-property/50",
			icon: "text-node-property",
			iconHover: "text-node-property/80",
			ring: "ring-node-property/50",
			textLight: "text-foreground",
			textDark: "text-foreground",
		},
		showTargetHandle: true,
		showSourceHandle: true,
	},
	evidence: {
		id: "evidence",
		label: "Evidence",
		description: "Supporting evidence or artifact",
		icon: CheckCircle,
		colours: {
			bgLight: "bg-node-evidence/5",
			bgDark: "bg-node-evidence/10",
			border: "border-node-evidence/30",
			borderHover: "border-node-evidence/50",
			icon: "text-node-evidence",
			iconHover: "text-node-evidence/80",
			ring: "ring-node-evidence/50",
			textLight: "text-foreground",
			textDark: "text-foreground",
		},
		showTargetHandle: true,
		showSourceHandle: false,
	},
};

/**
 * Get configuration for a specific node type
 */
export function getNodeConfig(nodeType: NodeType): NodeTypeConfig {
	return nodeTypeConfigs[nodeType];
}

/**
 * Get the icon component for a node type
 */
export function getNodeIcon(nodeType: NodeType): LucideIcon {
	return nodeTypeConfigs[nodeType].icon;
}

/**
 * Get the colour scheme for a node type
 */
export function getNodeColours(nodeType: NodeType): NodeColourScheme {
	return nodeTypeConfigs[nodeType].colours;
}
