/**
 * Theme Configuration for React Flow Enhanced Components
 *
 * This file exports design tokens, node type configurations, animation timings,
 * and handle styles for the FloraFauna.ai-inspired interface.
 *
 * Supports both light and dark modes that sync with Docusaurus theme.
 *
 * @module themeConfig
 */

import React from 'react';
import {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// ========================================================================
// Color Tokens
// ========================================================================

/**
 * Theme-aware color tokens
 * These adapt based on light/dark mode
 */

/**
 * Background color tokens for glassmorphism effects - Dark Mode
 */
export const backgroundColorsDark = {
  transparentBlack: 'rgba(0, 0, 0, 0.6)',
  transparentBlackSecondary: 'rgba(0, 0, 0, 0.75)',
  transparentBlackSecondaryAlt: 'rgba(0, 0, 0, 0.85)',
  transparentWhiteHover: 'rgba(255, 255, 255, 0.05)',
  transparentWhiteSecondaryHover: 'rgba(255, 255, 255, 0.1)',
  opaqueWhite: 'rgba(255, 255, 255, 1)',
  disabledLight: 'rgba(100, 100, 100, 0.3)',
};

/**
 * Background color tokens for glassmorphism effects - Light Mode
 */
export const backgroundColorsLight = {
  transparentWhite: 'rgba(255, 255, 255, 0.8)',
  transparentWhiteSecondary: 'rgba(255, 255, 255, 0.9)',
  transparentWhiteSecondaryAlt: 'rgba(255, 255, 255, 0.95)',
  transparentBlackHover: 'rgba(0, 0, 0, 0.05)',
  transparentBlackSecondaryHover: 'rgba(0, 0, 0, 0.08)',
  opaqueWhite: 'rgba(255, 255, 255, 1)',
  disabledLight: 'rgba(150, 150, 150, 0.4)',
};

/**
 * Legacy export for backward compatibility (defaults to dark)
 */
export const backgroundColors = backgroundColorsDark;

/**
 * Text color tokens - Dark Mode
 */
export const textColorsDark = {
  light: 'rgba(255, 255, 255, 0.95)',
  lightSecondary: 'rgba(255, 255, 255, 0.80)',
  lightTertiary: 'rgba(255, 255, 255, 0.70)',
  lightQuaternary: 'rgba(255, 255, 255, 0.60)',
  dark: 'rgba(0, 0, 0, 0.87)',
};

/**
 * Text color tokens - Light Mode
 */
export const textColorsLight = {
  dark: 'rgba(0, 0, 0, 0.90)',
  darkSecondary: 'rgba(0, 0, 0, 0.75)',
  darkTertiary: 'rgba(0, 0, 0, 0.60)',
  darkQuaternary: 'rgba(0, 0, 0, 0.50)',
  light: 'rgba(255, 255, 255, 0.95)',
};

/**
 * Legacy export for backward compatibility
 */
export const textColors = textColorsDark;

/**
 * Icon color tokens - Dark Mode
 */
export const iconColorsDark = {
  lightSecondary: 'rgba(255, 255, 255, 0.6)',
};

/**
 * Icon color tokens - Light Mode
 */
export const iconColorsLight = {
  darkSecondary: 'rgba(0, 0, 0, 0.6)',
};

/**
 * Legacy export for backward compatibility
 */
export const iconColors = iconColorsDark;

/**
 * Border color tokens - Dark Mode
 */
export const borderColorsDark = {
  transparent: 'rgba(255, 255, 255, 0.1)',
  transparentSecondary: 'rgba(255, 255, 255, 0.2)',
};

/**
 * Border color tokens - Light Mode
 */
export const borderColorsLight = {
  transparent: 'rgba(0, 0, 0, 0.1)',
  transparentSecondary: 'rgba(0, 0, 0, 0.15)',
};

/**
 * Legacy export for backward compatibility
 */
export const borderColors = borderColorsDark;

// ========================================================================
// Node Type Configurations
// ========================================================================

/**
 * Configuration for each assurance case node type
 * Includes colors, icons, and visual properties
 */
export const nodeTypeConfig = {
  goal: {
    id: 'goal',
    name: 'Goal',
    description: 'Top-level system property to be assured',
    icon: Target,
    colorScheme: {
      primary: '#10b981', // green-500
      light: '#34d399',   // green-400
      dark: '#059669',    // green-600
      bg: 'bg-green-500/10',
      bgHover: 'bg-green-500/20',
      border: 'border-green-400/30',
      borderHover: 'border-green-400/50',
      icon: 'text-green-400',
      iconHover: 'text-green-300',
      ring: 'ring-green-500/50',
    },
    shortcut: 'G',
    showTargetHandle: false, // Goals are typically at the top
    showSourceHandle: true,
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy',
    description: 'Approach for decomposing a goal',
    icon: GitBranch,
    colorScheme: {
      primary: '#a855f7', // purple-500
      light: '#c084fc',   // purple-400
      dark: '#9333ea',    // purple-600
      bg: 'bg-purple-500/10',
      bgHover: 'bg-purple-500/20',
      border: 'border-purple-400/30',
      borderHover: 'border-purple-400/50',
      icon: 'text-purple-400',
      iconHover: 'text-purple-300',
      ring: 'ring-purple-500/50',
    },
    shortcut: 'S',
    showTargetHandle: true,
    showSourceHandle: true,
  },
  propertyСlaim: {
    id: 'propertyClaim',
    name: 'Property Claim',
    description: 'Specific property or sub-claim',
    icon: FileText,
    colorScheme: {
      primary: '#f97316', // orange-500
      light: '#fb923c',   // orange-400
      dark: '#ea580c',    // orange-600
      bg: 'bg-orange-500/10',
      bgHover: 'bg-orange-500/20',
      border: 'border-orange-400/30',
      borderHover: 'border-orange-400/50',
      icon: 'text-orange-400',
      iconHover: 'text-orange-300',
      ring: 'ring-orange-500/50',
    },
    shortcut: 'C',
    showTargetHandle: true,
    showSourceHandle: true,
  },
  evidence: {
    id: 'evidence',
    name: 'Evidence',
    description: 'Supporting evidence or artifact',
    icon: CheckCircle,
    colorScheme: {
      primary: '#06b6d4', // cyan-500
      light: '#22d3ee',   // cyan-400
      dark: '#0891b2',    // cyan-600
      bg: 'bg-cyan-500/10',
      bgHover: 'bg-cyan-500/20',
      border: 'border-cyan-400/30',
      borderHover: 'border-cyan-400/50',
      icon: 'text-cyan-400',
      iconHover: 'text-cyan-300',
      ring: 'ring-cyan-500/50',
    },
    shortcut: 'E',
    showTargetHandle: true,
    showSourceHandle: false, // Evidence is typically a leaf node
  },
  context: {
    id: 'context',
    name: 'Context',
    description: 'Contextual information or assumption',
    icon: AlertCircle,
    colorScheme: {
      primary: '#6b7280', // gray-500
      light: '#9ca3af',   // gray-400
      dark: '#4b5563',    // gray-600
      bg: 'bg-gray-500/10',
      bgHover: 'bg-gray-500/20',
      border: 'border-gray-400/30',
      borderHover: 'border-gray-400/50',
      icon: 'text-gray-400',
      iconHover: 'text-gray-300',
      ring: 'ring-gray-500/50',
    },
    shortcut: 'X',
    showTargetHandle: true,
    showSourceHandle: false, // Context nodes typically don't have children
  },
};

/**
 * Get configuration for a specific node type
 * @param {string} nodeType - The node type identifier
 * @returns {object} Node configuration object
 */
export const getNodeTypeConfig = (nodeType) => {
  const normalizedType = nodeType.toLowerCase().replace(/[-_\s]/g, '');

  // Handle various naming conventions
  const typeMap = {
    goal: 'goal',
    strategy: 'strategy',
    propertyclaim: 'propertyClaim',
    claim: 'propertyClaim',
    evidence: 'evidence',
    context: 'context',
  };

  const mappedType = typeMap[normalizedType] || 'goal';
  return nodeTypeConfig[mappedType] || nodeTypeConfig.goal;
};

// ========================================================================
// Animation Timings
// ========================================================================

/**
 * Animation timing configurations
 */
export const animationTimings = {
  // Duration values
  fast: 150,
  normal: 300,
  slow: 500,

  // Easing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Framer Motion spring configurations
  spring: {
    default: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
    gentle: {
      type: 'spring',
      stiffness: 200,
      damping: 25,
    },
    bouncy: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
    stiff: {
      type: 'spring',
      stiffness: 500,
      damping: 35,
    },
  },

  // Stagger configurations for multiple nodes
  stagger: {
    fast: 0.05,
    normal: 0.1,
    slow: 0.2,
  },
};

/**
 * Node animation variants for Framer Motion
 */
export const nodeAnimationVariants = {
  // Initial entrance animation
  initial: {
    scale: 0.8,
    opacity: 0,
  },

  // Animate to visible state
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },

  // Exit animation
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },

  // Hover state
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      type: 'spring',
      stiffness: 400,
    },
  },

  // Selected state
  selected: {
    scale: 1.05,
    transition: {
      duration: 0.3,
      type: 'spring',
      stiffness: 300,
    },
  },
};

/**
 * Collapse/expand animation variants
 */
export const collapseAnimationVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

/**
 * Handle decorator animation variants
 * Controls the appearance/hover states of handle decorators
 */
export const handleDecoratorVariants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  hover: {
    scale: 1.1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 15,
    },
  },
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
  connected: {
    scale: 0.8,
    opacity: 0.6,
    transition: {
      duration: 0.2,
    },
  },
};

// ========================================================================
// Handle Styles Configuration
// ========================================================================

/**
 * Handle styling configuration
 */
export const handleStyleConfig = {
  // Size configuration
  size: {
    outer: 'w-12 h-12',   // Clickable area
    inner: 'w-8 h-8',     // Visual decorator
    icon: 'w-4 h-4',      // Plus icon
  },

  // Background colors
  background: {
    default: backgroundColors.opaqueWhite,
    hover: 'rgba(255, 255, 255, 1)',
  },

  // Border styling
  border: {
    width: '1px',
    color: 'rgba(209, 213, 219, 1)', // gray-300
    colorHover: 'rgba(156, 163, 175, 1)', // gray-400
  },

  // Shadow effects
  shadow: {
    default: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    hover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },

  // Icon color
  iconColor: 'rgba(55, 65, 81, 1)', // gray-700

  // Animation
  transition: {
    duration: animationTimings.normal,
    easing: animationTimings.easing.spring,
  },

  // Position offsets (for positioning outside node bounds)
  offset: {
    top: '-1rem',
    bottom: '-1rem',
    left: '-0.5rem',
    right: '-0.5rem',
  },
};

// ========================================================================
// Glassmorphism Style Presets
// ========================================================================

/**
 * Pre-configured glassmorphism style combinations
 */
export const glassmorphismPresets = {
  // Base node styling
  node: {
    base: [
      'bg-background-transparent-black',
      'backdrop-blur-lg',
      'border',
      'border-transparent',
      'rounded-xl',
      'shadow-glassmorphic',
    ].join(' '),

    elevated: [
      'bg-background-transparent-black-secondary',
      'backdrop-blur-lg',
      'border',
      'border-transparent',
      'rounded-xl',
      'shadow-3d',
    ].join(' '),

    highest: [
      'bg-background-transparent-black-secondaryAlt',
      'backdrop-blur-lg',
      'border',
      'border-transparent',
      'rounded-xl',
      'shadow-3d',
    ].join(' '),
  },

  // Dialog/Modal styling
  modal: [
    'bg-background-transparent-black-secondaryAlt',
    'f-effect-backdrop-blur-lg',
    'border',
    'border-transparent',
    'text-text-light',
    'shadow-3d',
  ].join(' '),

  // Dropdown/Menu styling
  menu: [
    'bg-background-transparent-black-secondary',
    'f-effect-backdrop-blur-lg',
    'border',
    'border-transparent',
    'text-text-light',
  ].join(' '),

  // Card styling
  card: [
    'bg-background-transparent-black',
    'f-effect-backdrop-blur-lg',
    'border',
    'border-transparent',
    'rounded-2xl',
    'shadow-glassmorphic',
  ].join(' '),
};

// ========================================================================
// Utility Functions
// ========================================================================

/**
 * Get color scheme classes for a node type
 * @param {string} nodeType - The node type identifier
 * @returns {object} Color scheme classes
 */
export const getColorSchemeClasses = (nodeType) => {
  const config = getNodeTypeConfig(nodeType);
  return config.colorScheme;
};

/**
 * Get icon component for a node type
 * @param {string} nodeType - The node type identifier
 * @returns {React.Component} Lucide icon component
 */
export const getNodeIcon = (nodeType) => {
  const config = getNodeTypeConfig(nodeType);
  return config.icon;
};

/**
 * Build Tailwind class string for node styling
 * @param {string} nodeType - The node type identifier
 * @param {boolean} isSelected - Whether node is selected
 * @param {boolean} isHovered - Whether node is hovered
 * @returns {string} Complete Tailwind class string
 */
export const buildNodeClasses = (nodeType, isSelected = false, isHovered = false) => {
  const colors = getColorSchemeClasses(nodeType);

  const baseClasses = [
    'relative',
    'min-w-[200px]',
    'max-w-[400px]',
    'bg-background-transparent-black',
    'f-effect-backdrop-blur-lg',
    'rounded-xl',
    'shadow-glassmorphic',
    'cursor-pointer',
    'transition-all',
    'duration-300',
  ];

  const borderClasses = [
    'border',
    colors.border,
  ];

  if (isHovered) {
    borderClasses.push(colors.borderHover);
    baseClasses.push('shadow-3d');
  }

  if (isSelected) {
    baseClasses.push('ring-2');
    baseClasses.push(colors.ring);
  }

  return [...baseClasses, ...borderClasses].join(' ');
};

// ========================================================================
// Theme Context Utilities
// ========================================================================

/**
 * React Context for theme mode
 */
export const ThemeContext = React.createContext({
  isDarkMode: true,
  colorMode: 'dark',
});

/**
 * Hook to use theme context
 */
export const useThemeContext = () => {
  const context = React.useContext(ThemeContext);
  return context;
};

/**
 * Get theme-aware color tokens
 * @param {boolean} isDarkMode - Whether dark mode is active
 * @returns {object} Theme-specific color tokens
 */
export const getThemeColors = (isDarkMode = true) => {
  return {
    background: isDarkMode ? backgroundColorsDark : backgroundColorsLight,
    text: isDarkMode ? textColorsDark : textColorsLight,
    icon: isDarkMode ? iconColorsDark : iconColorsLight,
    border: isDarkMode ? borderColorsDark : borderColorsLight,
  };
};

/**
 * Get CSS variable value based on theme
 * @param {string} varName - CSS variable name (without --)
 * @param {boolean} isDarkMode - Whether dark mode is active
 * @returns {string} CSS variable reference
 */
export const getThemeVar = (varName, isDarkMode = true) => {
  return `var(--rf-${varName})`;
};

// ========================================================================
// Export All
// ========================================================================

export default {
  // Color tokens
  backgroundColors,
  backgroundColorsDark,
  backgroundColorsLight,
  textColors,
  textColorsDark,
  textColorsLight,
  iconColors,
  iconColorsDark,
  iconColorsLight,
  borderColors,
  borderColorsDark,
  borderColorsLight,
  // Node configuration
  nodeTypeConfig,
  animationTimings,
  nodeAnimationVariants,
  collapseAnimationVariants,
  handleDecoratorVariants,
  handleStyleConfig,
  glassmorphismPresets,
  // Utility functions
  getNodeTypeConfig,
  getColorSchemeClasses,
  getNodeIcon,
  buildNodeClasses,
  getThemeColors,
  getThemeVar,
  // Context
  ThemeContext,
  useThemeContext,
};
