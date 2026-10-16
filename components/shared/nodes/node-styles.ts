/**
 * Node Styling Utilities
 *
 * Provides utility functions for generating node styles matching
 * the curriculum design system with tinted backgrounds and colored borders.
 */

import type { AppearanceTone, ElementAppearance } from "@/lib/plugins/slots";
import { cn } from "@/lib/utils";
import { type DiagramNodeType, getNodeColours } from "./node-config";

interface NodeContainerOptions {
	/** How a plugin wants the card drawn. The card then paints its fill on a layer under its content (`buildAppearanceFillClasses`). */
	appearance?: ElementAppearance | null;
	className?: string;
	/** Dialogical reasoning (defeaters, ADR 0005 D2) — a distinct destructive-token border, overriding the node kind's own colour. */
	isDefeater?: boolean;
	isSelected?: boolean;
	nodeType: DiagramNodeType;
}

/**
 * Build complete node container classes
 * Uses light tinted backgrounds with colored borders
 * Width is fixed - only height changes on expand
 */
export function buildNodeContainerClasses({
	nodeType,
	isSelected = false,
	isDefeater = false,
	appearance = null,
	className = "",
}: NodeContainerOptions): string {
	const colours = getNodeColours(nodeType);

	const baseClasses = [
		"relative",
		// A stacking context of its own keeps the appearance layer (z-index -10)
		// above the card's fill and below its content, whatever sits around it.
		appearance ? "isolate" : "",
		"w-[320px]", // Fixed width - only height changes on expand
		colours.bgLight, // Light tinted background
		"rounded-xl",
		"shadow-lg",
		"cursor-pointer",
		"transition-all",
		"duration-300",
		"border-2",
		// A defeater's border is destructive-token, regardless of its card
		// kind's own colour — the card decoration ADR 0005 D2 asks for.
		isDefeater ? "border-destructive/60" : colours.border,
	];

	if (isSelected) {
		baseClasses.push(
			"ring-2",
			isDefeater ? "ring-destructive/50" : colours.ring
		);
	}

	return cn(...baseClasses, className);
}

/**
 * The tint each tone puts over the card, at full strength and faded to about a
 * third. The tints come from the theme's own tokens, so they follow the
 * preset and the light or dark mode.
 */
const APPEARANCE_TINTS: Record<
	AppearanceTone,
	{ faded: string; full: string }
> = {
	positive: {
		full: "from-success/15 to-success/15",
		faded: "from-success/5 to-success/5",
	},
	caution: {
		full: "from-warning/15 to-warning/15",
		faded: "from-warning/5 to-warning/5",
	},
	negative: {
		full: "from-destructive/15 to-destructive/15",
		faded: "from-destructive/5 to-destructive/5",
	},
	neutral: {
		full: "from-muted-foreground/15 to-muted-foreground/15",
		faded: "from-muted-foreground/5 to-muted-foreground/5",
	},
};

/**
 * Classes for the layer that carries a plugin's fill. The layer sits under the
 * card's content, so the text keeps its full contrast; a faded card is veiled
 * with the canvas's colour, which leaves the card about a third as solid, and
 * its tint is drawn at about a third of its strength.
 */
export function buildAppearanceFillClasses(
	appearance: ElementAppearance
): string {
	const tint = APPEARANCE_TINTS[appearance.tone];
	return cn(
		"pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-linear-to-b",
		appearance.faded ? ["bg-muted/65", tint.faded] : tint.full
	);
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
