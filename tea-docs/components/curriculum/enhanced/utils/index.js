/**
 * Utility Functions Index
 *
 * Central export point for all utility modules including theme configuration,
 * node styling utilities, and animation configurations.
 *
 * @module utils
 */

// Theme Configuration
export {
  default as themeConfig,
  backgroundColors,
  textColors,
  iconColors,
  borderColors,
  nodeTypeConfig,
  animationTimings,
  nodeAnimationVariants,
  collapseAnimationVariants,
  handleStyleConfig,
  glassmorphismPresets,
  getNodeTypeConfig,
  getColorSchemeClasses,
  getNodeIcon,
  buildNodeClasses,
} from './themeConfig';

// Identifier Utilities
export {
  formatIdentifier,
  getDisplayName,
  truncateText,
  extractAttributes,
  extractMetadata,
} from './identifierUtils';

// Node Styling Utilities
export {
  default as nodeStyles,
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
} from './nodeStyles';

// Animation Utilities
export {
  default as animations,
  nodeEntranceVariants,
  nodeFadeVariants,
  nodeScaleVariants,
  contentCollapseVariants,
  sectionSlideVariants,
  hoverVariants,
  iconHoverVariants,
  buttonPressVariants,
  staggerContainerVariants,
  fastStaggerContainerVariants,
  slowStaggerContainerVariants,
  staggerItemVariants,
  handleDecoratorVariants,
  handlePulseVariants,
  selectionVariants,
  selectionRingVariants,
  modalBackdropVariants,
  modalContentVariants,
  createSpringTransition,
  createEaseTransition,
  createStaggerTransition,
  combineVariants,
  createRevealAnimation,
  getAnimationPreset,
  prefersReducedMotion,
  withReducedMotion,
} from './animations';

/**
 * Export all utilities as a single object for convenience
 */
export default {
  themeConfig: require('./themeConfig').default,
  nodeStyles: require('./nodeStyles').default,
  animations: require('./animations').default,
};
