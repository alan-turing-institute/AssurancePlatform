/**
 * Node Styling Utilities
 *
 * Provides utility functions for generating node styles matching
 * the curriculum design system with tinted backgrounds and colored borders.
 */

import { cn } from "@/lib/utils";
import { type DiagramNodeType, getNodeColours } from "./node-config";

type NodeContainerOptions = {
	nodeType: DiagramNodeType;
	isSelected?: boolean;
	className?: string;
};

/**
 * Build complete node container classes
 * Uses light tinted backgrounds with colored borders
 * Width is fixed - only height changes on expand
 */
export function buildNodeContainerClasses({
	nodeType,
	isSelected = false,
	className = "",
}: NodeContainerOptions): string {
	const colours = getNodeColours(nodeType);

	const baseClasses = [
		"relative",
		"w-[320px]", // Fixed width - only height changes on expand
		colours.bgLight, // Light tinted background
		"rounded-xl",
		"shadow-lg",
		"cursor-pointer",
		"transition-all",
		"duration-300",
		"border-2",
		colours.border,
	];

	if (isSelected) {
		baseClasses.push("ring-2", colours.ring);
	}

	return cn(...baseClasses, className);
}

/**
 * Build node header classes
 */
export function buildNodeHeaderClasses(): string {
	return cn("px-4", "py-3", "flex", "items-center", "justify-between", "gap-2");
}

/**
 * Build node title classes (ID badge like G1, S1, etc.)
 */
export function buildNodeTitleClasses(): string {
	return cn("font-semibold", "text-foreground", "text-sm", "truncate");
}

/**
 * Build node icon classes
 */
export function buildNodeIconClasses(nodeType: DiagramNodeType): string {
	const colours = getNodeColours(nodeType);

	return cn("w-5", "h-5", "shrink-0", colours.icon);
}

/**
 * Build preview text classes (collapsed state - description below header)
 */
export function buildPreviewTextClasses(): string {
	return cn(
		"text-xs",
		"text-muted-foreground",
		"line-clamp-3",
		"leading-relaxed"
	);
}

/**
 * Build full description classes (expanded state)
 */
export function buildDescriptionClasses(): string {
	return cn("text-sm", "text-muted-foreground", "leading-relaxed");
}

/**
 * Build content area classes
 */
export function buildNodeContentClasses(isExpanded = true): string {
	return cn("px-4", isExpanded ? "pb-4" : "pb-3", "space-y-3");
}

/**
 * Build separator classes
 */
export function buildSeparatorClasses(): string {
	return cn("h-px", "bg-border");
}

/**
 * Build footer label classes (e.g., "GOAL", "STRATEGY")
 */
export function buildFooterLabelClasses(): string {
	return cn(
		"font-medium",
		"text-muted-foreground",
		"text-xs",
		"uppercase",
		"tracking-wider"
	);
}

/**
 * Build footer ID classes (e.g., "G1", "S1")
 */
export function buildFooterIdClasses(): string {
	return cn("font-mono", "text-muted-foreground/70", "text-xs");
}
