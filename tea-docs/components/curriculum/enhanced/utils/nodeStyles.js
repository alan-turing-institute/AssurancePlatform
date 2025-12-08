/**
 * Node Styling Utilities
 *
 * Provides utility functions for generating node styles with glassmorphism effects,
 * type-specific colors, and FloraFauna.ai-inspired aesthetics.
 *
 * @module nodeStyles
 */

import { cn } from '../../../../lib/utils';
import {
  getNodeTypeConfig,
  getColorSchemeClasses,
  buildNodeClasses,
  glassmorphismPresets,
} from './themeConfig';

// ========================================================================
// Base Style Builders
// ========================================================================

/**
 * Build complete node container classes
 * @param {object} options - Styling options
 * @param {string} options.nodeType - Node type (goal, strategy, etc.)
 * @param {boolean} options.isSelected - Whether node is selected
 * @param {boolean} options.isHovered - Whether node is hovered
 * @param {boolean} options.isCollapsed - Whether node is collapsed
 * @param {string} options.className - Additional custom classes
 * @returns {string} Complete Tailwind class string
 */
export const buildNodeContainerClasses = ({
  nodeType = 'goal',
  isSelected = false,
  isHovered = false,
  isCollapsed = false,
  className = '',
}) => {
  const baseClasses = buildNodeClasses(nodeType, isSelected, isHovered);

  const sizeClasses = isCollapsed
    ? 'max-w-[250px]'
    : 'max-w-[400px]';

  return cn(baseClasses, sizeClasses, className);
};

/**
 * Build node header classes
 * @param {string} nodeType - Node type
 * @returns {string} Header classes
 */
export const buildNodeHeaderClasses = (nodeType = 'goal') => {
  return cn(
    'px-4',
    'py-3',
    'flex',
    'items-center',
    'justify-between',
    'gap-2',
    'select-none'
  );
};

/**
 * Build node title classes
 * @param {string} nodeType - Node type
 * @returns {string} Title classes
 */
export const buildNodeTitleClasses = (nodeType = 'goal') => {
  return cn(
    'font-semibold',
    'text-text-light',
    'text-sm',
    'truncate',
    'flex-1',
    'min-w-0'
  );
};

/**
 * Build node icon classes
 * @param {string} nodeType - Node type
 * @param {boolean} isHovered - Whether node is hovered
 * @returns {string} Icon classes
 */
export const buildNodeIconClasses = (nodeType = 'goal', isHovered = false) => {
  const colors = getColorSchemeClasses(nodeType);

  return cn(
    'w-5',
    'h-5',
    'flex-shrink-0',
    'transition-colors',
    'duration-200',
    isHovered ? colors.iconHover : colors.icon
  );
};

/**
 * Build content area classes
 * @param {boolean} isExpanded - Whether content is expanded
 * @returns {string} Content classes
 */
export const buildNodeContentClasses = (isExpanded = true) => {
  return cn(
    'px-4',
    isExpanded ? 'pb-4' : 'pb-3',
    'space-y-3'
  );
};

/**
 * Build preview text classes (collapsed state)
 * @returns {string} Preview text classes
 */
export const buildPreviewTextClasses = () => {
  return cn(
    'text-xs',
    'text-text-light/70',
    'line-clamp-2',
    'leading-relaxed'
  );
};

/**
 * Build full description classes (expanded state)
 * @returns {string} Description classes
 */
export const buildDescriptionClasses = () => {
  return cn(
    'text-sm',
    'text-text-light/80',
    'leading-relaxed'
  );
};

/**
 * Build separator classes
 * @returns {string} Separator classes
 */
export const buildSeparatorClasses = () => {
  return cn(
    'h-px',
    'bg-border-transparent'
  );
};

// ========================================================================
// Icon Mappers
// ========================================================================

/**
 * Icon size variants
 */
export const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  base: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

/**
 * Get icon size classes
 * @param {string} size - Size variant (xs, sm, base, lg, xl)
 * @returns {string} Icon size classes
 */
export const getIconSize = (size = 'base') => {
  return iconSizes[size] || iconSizes.base;
};

// ========================================================================
// Shadow and Border Utilities
// ========================================================================

/**
 * Shadow utility classes for different elevations
 */
export const shadowClasses = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  base: 'shadow-glassmorphic',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '3d': 'shadow-3d',
  inner: 'shadow-inner',
};

/**
 * Get shadow class for elevation level
 * @param {string|number} level - Shadow level
 * @returns {string} Shadow class
 */
export const getShadowClass = (level = 'base') => {
  return shadowClasses[level] || shadowClasses.base;
};

/**
 * Border radius utilities
 */
export const borderRadiusClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  base: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  full: 'rounded-full',
};

/**
 * Get border radius class
 * @param {string} size - Radius size
 * @returns {string} Border radius class
 */
export const getBorderRadiusClass = (size = 'xl') => {
  return borderRadiusClasses[size] || borderRadiusClasses.xl;
};

// ========================================================================
// Glassmorphism Combinations
// ========================================================================

/**
 * Apply glassmorphism effect to element
 * @param {string} level - Elevation level (base, elevated, highest)
 * @returns {string} Glassmorphism classes
 */
export const applyGlassmorphism = (level = 'base') => {
  const presets = {
    base: glassmorphismPresets.node.base,
    elevated: glassmorphismPresets.node.elevated,
    highest: glassmorphismPresets.node.highest,
  };

  return presets[level] || presets.base;
};

/**
 * Build custom glassmorphism classes
 * @param {object} options - Glassmorphism options
 * @param {string} options.background - Background opacity level
 * @param {boolean} options.blur - Apply backdrop blur
 * @param {boolean} options.border - Apply border
 * @param {string} options.borderRadius - Border radius size
 * @param {string} options.shadow - Shadow level
 * @returns {string} Custom glassmorphism classes
 */
export const buildCustomGlassmorphism = ({
  background = 'base',
  blur = true,
  border = true,
  borderRadius = 'xl',
  shadow = 'base',
} = {}) => {
  const bgClasses = {
    base: 'bg-background-transparent-black',
    elevated: 'bg-background-transparent-black-secondary',
    highest: 'bg-background-transparent-black-secondaryAlt',
  };

  const classes = [bgClasses[background] || bgClasses.base];

  if (blur) {
    classes.push('f-effect-backdrop-blur-lg');
  }

  if (border) {
    classes.push('border', 'border-transparent');
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
 * @param {string} nodeType - Node type
 * @returns {string} Hover classes
 */
export const buildHoverClasses = (nodeType = 'goal') => {
  const colors = getColorSchemeClasses(nodeType);

  return cn(
    'hover:shadow-3d',
    'hover:scale-[1.02]',
    `hover:${colors.borderHover}`,
    'transition-all',
    'duration-300'
  );
};

/**
 * Build focus state classes
 * @param {string} nodeType - Node type
 * @returns {string} Focus classes
 */
export const buildFocusClasses = (nodeType = 'goal') => {
  const colors = getColorSchemeClasses(nodeType);

  return cn(
    'focus:outline-none',
    'focus:ring-2',
    `focus:${colors.ring}`,
    'focus:ring-offset-2',
    'focus:ring-offset-gray-950'
  );
};

/**
 * Build selected state classes
 * @param {string} nodeType - Node type
 * @returns {string} Selected classes
 */
export const buildSelectedClasses = (nodeType = 'goal') => {
  const colors = getColorSchemeClasses(nodeType);

  return cn(
    'ring-2',
    colors.ring,
    'shadow-3d'
  );
};

/**
 * Get all interaction state classes
 * @param {object} options - State options
 * @param {string} options.nodeType - Node type
 * @param {boolean} options.isSelected - Is selected
 * @param {boolean} options.isHovered - Is hovered
 * @param {boolean} options.isFocused - Is focused
 * @returns {string} Complete interaction state classes
 */
export const buildInteractionClasses = ({
  nodeType = 'goal',
  isSelected = false,
  isHovered = false,
  isFocused = false,
} = {}) => {
  const classes = [];

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
 * @param {object} options - Flex options
 * @param {string} options.direction - Flex direction
 * @param {string} options.align - Align items
 * @param {string} options.justify - Justify content
 * @param {string} options.gap - Gap size
 * @returns {string} Flex classes
 */
export const buildFlexClasses = ({
  direction = 'row',
  align = 'center',
  justify = 'start',
  gap = '2',
} = {}) => {
  const directionClasses = {
    row: 'flex-row',
    column: 'flex-col',
    rowReverse: 'flex-row-reverse',
    columnReverse: 'flex-col-reverse',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  return cn(
    'flex',
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
 * @param {object} options - Width options
 * @param {string} options.min - Minimum width
 * @param {string} options.max - Maximum width
 * @param {boolean} options.full - Full width on mobile
 * @returns {string} Width classes
 */
export const buildResponsiveWidthClasses = ({
  min = '200px',
  max = '400px',
  full = false,
} = {}) => {
  const classes = [`min-w-[${min}]`, `max-w-[${max}]`];

  if (full) {
    classes.push('w-full', 'sm:w-auto');
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
