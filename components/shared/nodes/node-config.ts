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
			bgLight: "bg-green-50",
			bgDark: "bg-green-950",
			border: "border-green-400/30",
			borderHover: "border-green-400/50",
			icon: "text-green-600",
			iconHover: "text-green-500",
			ring: "ring-green-500/50",
			textLight: "text-gray-900",
			textDark: "text-gray-100",
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
			bgLight: "bg-purple-50",
			bgDark: "bg-purple-950",
			border: "border-purple-400/30",
			borderHover: "border-purple-400/50",
			icon: "text-purple-600",
			iconHover: "text-purple-500",
			ring: "ring-purple-500/50",
			textLight: "text-gray-900",
			textDark: "text-gray-100",
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
			bgLight: "bg-orange-50",
			bgDark: "bg-orange-950",
			border: "border-orange-400/30",
			borderHover: "border-orange-400/50",
			icon: "text-orange-600",
			iconHover: "text-orange-500",
			ring: "ring-orange-500/50",
			textLight: "text-gray-900",
			textDark: "text-gray-100",
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
			bgLight: "bg-cyan-50",
			bgDark: "bg-cyan-950",
			border: "border-cyan-400/30",
			borderHover: "border-cyan-400/50",
			icon: "text-cyan-600",
			iconHover: "text-cyan-500",
			ring: "ring-cyan-500/50",
			textLight: "text-gray-900",
			textDark: "text-gray-100",
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
