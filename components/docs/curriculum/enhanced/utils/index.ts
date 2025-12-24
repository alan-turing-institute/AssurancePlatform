/**
 * Utility Functions Index
 *
 * Central export point for all utility modules including theme configuration,
 * node styling utilities, and animation configurations.
 *
 * @module utils
 */

// Animation Utilities
export {
	buttonPressVariants,
	combineVariants,
	contentCollapseVariants,
	createEaseTransition,
	createRevealAnimation,
	createSpringTransition,
	createStaggerTransition,
	default as animations,
	fastStaggerContainerVariants,
	getAnimationPreset,
	handleDecoratorVariants,
	handlePulseVariants,
	hoverVariants,
	iconHoverVariants,
	modalBackdropVariants,
	modalContentVariants,
	nodeEntranceVariants,
	nodeFadeVariants,
	nodeScaleVariants,
	prefersReducedMotion,
	sectionSlideVariants,
	selectionRingVariants,
	selectionVariants,
	slowStaggerContainerVariants,
	staggerContainerVariants,
	staggerItemVariants,
	withReducedMotion,
} from "./animations";

// Identifier Utilities
export {
	extractAttributes,
	extractMetadata,
	formatIdentifier,
	getDisplayName,
	truncateText,
} from "./identifier-utils";

// Node Styling Utilities
export {
	applyGlassmorphism,
	buildCustomGlassmorphism,
	buildDescriptionClasses,
	buildFlexClasses,
	buildFocusClasses,
	buildHoverClasses,
	buildInteractionClasses,
	buildNodeContainerClasses,
	buildNodeContentClasses,
	buildNodeHeaderClasses,
	buildNodeIconClasses,
	buildNodeTitleClasses,
	buildPreviewTextClasses,
	buildResponsiveWidthClasses,
	buildSelectedClasses,
	buildSeparatorClasses,
	default as nodeStyles,
	getBorderRadiusClass,
	getIconSize,
	getShadowClass,
} from "./node-styles";
// Re-export types
export type {} from // Types can be exported from theme-config if needed
"./theme-config";
// Theme Configuration
export {
	animationTimings,
	backgroundColors,
	borderColors,
	buildNodeClasses,
	collapseAnimationVariants,
	default as themeConfig,
	getColorSchemeClasses,
	getNodeIcon,
	getNodeTypeConfig,
	glassmorphismPresets,
	handleStyleConfig,
	iconColors,
	nodeAnimationVariants,
	nodeTypeConfig,
	textColors,
} from "./theme-config";
