/**
 * Node Styling Utilities
 *
 * Provides utility functions for generating node styles with glassmorphism effects,
 * type-specific colors, and FloraFauna.ai-inspired aesthetics.
 *
 * @module nodeStyles
 */

import { cn } from "@/lib/utils";
import {
	buildNodeClasses,
	getColorSchemeClasses,
	glassmorphismPresets,
} from "./theme-config";

// ========================================================================
// Type Definitions
// ========================================================================

type NodeContainerOptions = {
	nodeType?: string;
	isSelected?: boolean;
	isHovered?: boolean;
	isCollapsed?: boolean;
	isDarkMode?: boolean;
	className?: string;
};

type CustomGlassmorphismOptions = {
	background?: "base" | "elevated" | "highest";
	blur?: boolean;
	border?: boolean;
	borderRadius?: string;
	shadow?: string;
};

type InteractionOptions = {
	nodeType?: string;
	isSelected?: boolean;
	isHovered?: boolean;
	isFocused?: boolean;
};

type FlexOptions = {
	direction?: "row" | "column" | "rowReverse" | "columnReverse";
	align?: "start" | "center" | "end" | "stretch" | "baseline";
	justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
	gap?: string;
};

type ResponsiveWidthOptions = {
	min?: string;
	max?: string;
	full?: boolean;
};

// ========================================================================
// Base Style Builders
// ========================================================================

/**
 * Build complete node container classes
 */
export const buildNodeContainerClasses = ({
	nodeType = "goal",
	isSelected = false,
	isHovered = false,
	isCollapsed = false,
	isDarkMode = false,
	className = "",
}: NodeContainerOptions): string => {
	const baseClasses = buildNodeClasses(
		nodeType,
		isSelected,
		isHovered,
		isDarkMode
	);

	const sizeClasses = isCollapsed ? "max-w-[250px]" : "max-w-[400px]";

	return cn(baseClasses, sizeClasses, className);
};

/**
 * Build node header classes
 */
export const buildNodeHeaderClasses = (_nodeType = "goal"): string =>
	cn(
		"px-4",
		"py-3",
		"flex",
		"items-center",
		"justify-between",
		"gap-2",
		"select-none"
	);

/**
 * Build node title classes
 */
export const buildNodeTitleClasses = (
	_nodeType = "goal",
	isDarkMode = false
): string =>
	cn(
		"font-semibold",
		isDarkMode ? "text-gray-100" : "text-gray-900",
		"text-sm",
		"truncate",
		"flex-1",
		"min-w-0"
	);

/**
 * Build node icon classes
 */
export const buildNodeIconClasses = (
	nodeType = "goal",
	isHovered = false
): string => {
	const colors = getColorSchemeClasses(nodeType);

	return cn(
		"w-5",
		"h-5",
		"shrink-0",
		"transition-colors",
		"duration-200",
		isHovered ? colors.iconHover : colors.icon
	);
};

/**
 * Build content area classes
 */
export const buildNodeContentClasses = (isExpanded = true): string =>
	cn("px-4", isExpanded ? "pb-4" : "pb-3", "space-y-3");

/**
 * Build preview text classes (collapsed state)
 */
export const buildPreviewTextClasses = (isDarkMode = false): string =>
	cn(
		"text-xs",
		isDarkMode ? "text-gray-400" : "text-gray-600",
		"line-clamp-2",
		"leading-relaxed"
	);

/**
 * Build full description classes (expanded state)
 */
export const buildDescriptionClasses = (isDarkMode = false): string =>
	cn(
		"text-sm",
		isDarkMode ? "text-gray-300" : "text-gray-700",
		"leading-relaxed"
	);

/**
 * Build separator classes
 */
export const buildSeparatorClasses = (isDarkMode = false): string =>
	cn("h-px", isDarkMode ? "bg-gray-700" : "bg-gray-200");

// ========================================================================
// Icon Mappers
// ========================================================================

/**
 * Icon size variants
 */
export const iconSizes: Record<string, string> = {
	xs: "w-3 h-3",
	sm: "w-4 h-4",
	base: "w-5 h-5",
	lg: "w-6 h-6",
	xl: "w-8 h-8",
};

/**
 * Get icon size classes
 */
export const getIconSize = (size = "base"): string =>
	iconSizes[size] || iconSizes.base;

// ========================================================================
// Shadow and Border Utilities
// ========================================================================

/**
 * Shadow utility classes for different elevations
 */
export const shadowClasses: Record<string, string> = {
	none: "shadow-none",
	sm: "shadow-xs",
	base: "shadow-glassmorphic",
	md: "shadow-md",
	lg: "shadow-lg",
	xl: "shadow-xl",
	"3d": "shadow-3d",
	inner: "shadow-inner",
};

/**
 * Get shadow class for elevation level
 */
export const getShadowClass = (level: string | number = "base"): string =>
	shadowClasses[level] || shadowClasses.base;

/**
 * Border radius utilities
 */
export const borderRadiusClasses: Record<string, string> = {
	none: "rounded-none",
	sm: "rounded-sm",
	base: "rounded",
	md: "rounded-md",
	lg: "rounded-lg",
	xl: "rounded-xl",
	"2xl": "rounded-2xl",
	"3xl": "rounded-3xl",
	full: "rounded-full",
};

/**
 * Get border radius class
 */
export const getBorderRadiusClass = (size = "xl"): string =>
	borderRadiusClasses[size] || borderRadiusClasses.xl;

// ========================================================================
// Glassmorphism Combinations
// ========================================================================

/**
 * Apply glassmorphism effect to element
 */
export const applyGlassmorphism = (
	level: "base" | "elevated" | "highest" = "base"
): string => {
	const presets: Record<string, string> = {
		base: glassmorphismPresets.node.base,
		elevated: glassmorphismPresets.node.elevated,
		highest: glassmorphismPresets.node.highest,
	};

	return presets[level] || presets.base;
};

/**
 * Build custom glassmorphism classes
 */
export const buildCustomGlassmorphism = ({
	background = "base",
	blur = true,
	border = true,
	borderRadius = "xl",
	shadow = "base",
}: CustomGlassmorphismOptions = {}): string => {
	const bgClasses: Record<string, string> = {
		base: "bg-background-transparent-black",
		elevated: "bg-background-transparent-black-secondary",
		highest: "bg-background-transparent-black-secondaryAlt",
	};

	const classes: string[] = [bgClasses[background] || bgClasses.base];

	if (blur) {
		classes.push("f-effect-backdrop-blur-lg");
	}

	if (border) {
		classes.push("border", "border-transparent");
	}

	classes.push(getBorderRadiusClass(borderRadius));
	classes.push(getShadowClass(shadow));

	return cn(...classes);
};

// ========================================================================
// Interaction State Utilities
// ========================================================================

/**
 * Build hover state classes
 */
export const buildHoverClasses = (nodeType = "goal"): string => {
	const colors = getColorSchemeClasses(nodeType);

	return cn(
		"hover:shadow-3d",
		"hover:scale-[1.02]",
		`hover:${colors.borderHover}`,
		"transition-all",
		"duration-300"
	);
};

/**
 * Build focus state classes
 */
export const buildFocusClasses = (nodeType = "goal"): string => {
	const colors = getColorSchemeClasses(nodeType);

	return cn(
		"focus:outline-hidden",
		"focus:ring-2",
		`focus:${colors.ring}`,
		"focus:ring-offset-2",
		"focus:ring-offset-gray-950"
	);
};

/**
 * Build selected state classes
 */
export const buildSelectedClasses = (nodeType = "goal"): string => {
	const colors = getColorSchemeClasses(nodeType);

	return cn("ring-2", colors.ring, "shadow-3d");
};

/**
 * Get all interaction state classes
 */
export const buildInteractionClasses = ({
	nodeType = "goal",
	isSelected = false,
	isHovered = false,
	isFocused = false,
}: InteractionOptions = {}): string => {
	const classes: string[] = [];

	if (isHovered) {
		classes.push(buildHoverClasses(nodeType));
	}

	if (isSelected) {
		classes.push(buildSelectedClasses(nodeType));
	}

	if (isFocused) {
		classes.push(buildFocusClasses(nodeType));
	}

	return cn(...classes);
};

// ========================================================================
// Layout Utilities
// ========================================================================

/**
 * Build flex container classes
 */
export const buildFlexClasses = ({
	direction = "row",
	align = "center",
	justify = "start",
	gap = "2",
}: FlexOptions = {}): string => {
	const directionClasses: Record<string, string> = {
		row: "flex-row",
		column: "flex-col",
		rowReverse: "flex-row-reverse",
		columnReverse: "flex-col-reverse",
	};

	const alignClasses: Record<string, string> = {
		start: "items-start",
		center: "items-center",
		end: "items-end",
		stretch: "items-stretch",
		baseline: "items-baseline",
	};

	const justifyClasses: Record<string, string> = {
		start: "justify-start",
		center: "justify-center",
		end: "justify-end",
		between: "justify-between",
		around: "justify-around",
		evenly: "justify-evenly",
	};

	return cn(
		"flex",
		directionClasses[direction] || directionClasses.row,
		alignClasses[align] || alignClasses.center,
		justifyClasses[justify] || justifyClasses.start,
		`gap-${gap}`
	);
};

// ========================================================================
// Responsive Utilities
// ========================================================================

/**
 * Build responsive width classes for nodes
 */
export const buildResponsiveWidthClasses = ({
	min = "200px",
	max = "400px",
	full = false,
}: ResponsiveWidthOptions = {}): string => {
	const classes = [`min-w-[${min}]`, `max-w-[${max}]`];

	if (full) {
		classes.push("w-full", "sm:w-auto");
	}

	return cn(...classes);
};

// ========================================================================
// Export All
// ========================================================================

export default {
	buildNodeContainerClasses,
	buildNodeHeaderClasses,
	buildNodeTitleClasses,
	buildNodeIconClasses,
	buildNodeContentClasses,
	buildPreviewTextClasses,
	buildDescriptionClasses,
	buildSeparatorClasses,
	getIconSize,
	getShadowClass,
	getBorderRadiusClass,
	applyGlassmorphism,
	buildCustomGlassmorphism,
	buildHoverClasses,
	buildFocusClasses,
	buildSelectedClasses,
	buildInteractionClasses,
	buildFlexClasses,
	buildResponsiveWidthClasses,
};
