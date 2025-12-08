/**
 * Feature Configuration
 *
 * Centralized configuration for EnhancedInteractiveCaseViewer features.
 * Allows gradual adoption and easy toggling of enhanced features.
 *
 * @module featureConfig
 */

/**
 * Default feature flags
 */
export const DEFAULT_FEATURES = {
  // Core features
  enableCollapsible: true,
  enableContextMenus: true,
  enableNodeCreation: true,
  enableAnimations: true,
  enableEnhancedEdges: true,

  // Node features
  enableNodeDragging: true,
  enableNodeSelection: true,
  enableMultiSelection: true,
  enableNodeDeletion: true,
  enableNodeDuplication: true,

  // Edge features
  enableEdgeSelection: true,
  enableEdgeAnimation: true,
  enableEdgeStyling: true,
  enableEdgeDeletion: true,

  // Interaction features
  enableDoubleClickCreate: true,
  enableRightClickMenu: true,
  enableKeyboardShortcuts: true,
  enablePanZoom: true,
  enableMinimap: true,
  enableControls: true,

  // Progressive disclosure
  enableExploration: true,
  enableAutoReveal: false,
  enablePathHighlighting: true,

  // Visual features
  enableGlassmorphism: true,
  enableHandleDecorators: true,
  enableEdgeLabels: false,
  enableNodeTooltips: false,

  // Performance features
  enableVirtualization: false,
  enableLazyLoading: false,
  enableDebounce: true,

  // Persistence features
  enableStatePersistence: true,
  enableLayoutPersistence: true,
  enablePreferences: true,
};

/**
 * Feature presets for common use cases
 */
export const FEATURE_PRESETS = {
  /**
   * Full feature set (default)
   */
  full: {
    ...DEFAULT_FEATURES,
  },

  /**
   * Read-only viewer (no editing)
   */
  readonly: {
    ...DEFAULT_FEATURES,
    enableNodeCreation: false,
    enableNodeDeletion: false,
    enableNodeDuplication: false,
    enableEdgeDeletion: false,
    enableContextMenus: false,
    enableDoubleClickCreate: false,
    enableRightClickMenu: false,
  },

  /**
   * Minimal viewer (basic features only)
   */
  minimal: {
    enableCollapsible: false,
    enableContextMenus: false,
    enableNodeCreation: false,
    enableAnimations: false,
    enableEnhancedEdges: false,
    enableNodeDragging: false,
    enableNodeSelection: true,
    enableMultiSelection: false,
    enableNodeDeletion: false,
    enableNodeDuplication: false,
    enableEdgeSelection: false,
    enableEdgeAnimation: false,
    enableEdgeStyling: false,
    enableEdgeDeletion: false,
    enableDoubleClickCreate: false,
    enableRightClickMenu: false,
    enableKeyboardShortcuts: false,
    enablePanZoom: true,
    enableMinimap: false,
    enableControls: true,
    enableExploration: true,
    enableAutoReveal: false,
    enablePathHighlighting: false,
    enableGlassmorphism: false,
    enableHandleDecorators: false,
    enableEdgeLabels: false,
    enableNodeTooltips: false,
    enableVirtualization: false,
    enableLazyLoading: false,
    enableDebounce: false,
    enableStatePersistence: false,
    enableLayoutPersistence: false,
    enablePreferences: false,
  },

  /**
   * Interactive viewer (read-only but with exploration)
   */
  interactive: {
    ...DEFAULT_FEATURES,
    enableNodeCreation: false,
    enableNodeDeletion: false,
    enableNodeDuplication: false,
    enableEdgeDeletion: false,
    enableNodeDragging: false,
    enableContextMenus: false,
    enableDoubleClickCreate: false,
    enableRightClickMenu: false,
  },

  /**
   * Editor mode (full editing capabilities)
   */
  editor: {
    ...DEFAULT_FEATURES,
    enableNodeCreation: true,
    enableNodeDeletion: true,
    enableNodeDuplication: true,
    enableEdgeDeletion: true,
    enableContextMenus: true,
    enableDoubleClickCreate: true,
    enableRightClickMenu: true,
    enableKeyboardShortcuts: true,
  },

  /**
   * Presentation mode (optimized for display)
   */
  presentation: {
    ...DEFAULT_FEATURES,
    enableNodeCreation: false,
    enableNodeDeletion: false,
    enableNodeDuplication: false,
    enableEdgeDeletion: false,
    enableContextMenus: false,
    enableDoubleClickCreate: false,
    enableRightClickMenu: false,
    enableKeyboardShortcuts: false,
    enableMinimap: false,
    enableControls: false,
    enableNodeDragging: false,
    enablePathHighlighting: true,
    enableAnimations: true,
  },

  /**
   * Performance mode (optimized for large graphs)
   */
  performance: {
    ...DEFAULT_FEATURES,
    enableAnimations: false,
    enableGlassmorphism: false,
    enableEdgeAnimation: false,
    enableVirtualization: true,
    enableLazyLoading: true,
    enableDebounce: true,
    enableMinimap: false,
  },

  /**
   * Accessibility mode (optimized for screen readers)
   */
  accessibility: {
    ...DEFAULT_FEATURES,
    enableAnimations: false,
    enableGlassmorphism: false,
    enableEdgeAnimation: false,
    enableNodeTooltips: true,
    enableEdgeLabels: true,
    enableKeyboardShortcuts: true,
  },
};

/**
 * Get feature configuration
 *
 * @param {string|Object} preset - Preset name or custom config
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Feature configuration
 */
export const getFeatureConfig = (preset = 'full', overrides = {}) => {
  let config;

  if (typeof preset === 'string') {
    config = FEATURE_PRESETS[preset] || FEATURE_PRESETS.full;
  } else if (typeof preset === 'object') {
    config = preset;
  } else {
    config = FEATURE_PRESETS.full;
  }

  return {
    ...config,
    ...overrides,
  };
};

/**
 * Validate feature configuration
 *
 * @param {Object} config - Feature configuration
 * @returns {Object} {isValid: boolean, errors: [], warnings: []}
 */
export const validateFeatureConfig = (config) => {
  const errors = [];
  const warnings = [];

  // Check if all keys are valid
  const validKeys = Object.keys(DEFAULT_FEATURES);
  Object.keys(config).forEach((key) => {
    if (!validKeys.includes(key)) {
      warnings.push(`Unknown feature flag: ${key}`);
    }
  });

  // Check for conflicting settings
  if (config.enableNodeCreation && !config.enableContextMenus && !config.enableDoubleClickCreate) {
    warnings.push('Node creation enabled but no creation UI is enabled');
  }

  if (config.enableEdgeDeletion && !config.enableEdgeSelection) {
    warnings.push('Edge deletion enabled but edge selection is disabled');
  }

  if (config.enableVirtualization && config.enableAnimations) {
    warnings.push('Virtualization and animations may conflict');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Merge feature configurations
 *
 * @param {...Object} configs - Configurations to merge
 * @returns {Object} Merged configuration
 */
export const mergeFeatureConfigs = (...configs) => {
  return configs.reduce((merged, config) => ({
    ...merged,
    ...config,
  }), {});
};

/**
 * Get feature flags as React Flow props
 *
 * @param {Object} config - Feature configuration
 * @returns {Object} React Flow props
 */
export const getReactFlowProps = (config) => {
  return {
    nodesDraggable: config.enableNodeDragging,
    nodesConnectable: config.enableNodeCreation,
    elementsSelectable: config.enableNodeSelection || config.enableEdgeSelection,
    selectNodesOnDrag: config.enableMultiSelection,
    panOnDrag: config.enablePanZoom ? [1, 2] : false,
    zoomOnScroll: config.enablePanZoom,
    zoomOnPinch: config.enablePanZoom,
    zoomOnDoubleClick: !config.enableDoubleClickCreate && config.enablePanZoom,
    deleteKeyCode: config.enableNodeDeletion ? 'Delete' : null,
    multiSelectionKeyCode: config.enableMultiSelection ? 'Shift' : null,
    snapToGrid: false,
    snapGrid: [15, 15],
    fitView: true,
    fitViewOptions: { padding: 0.2 },
    minZoom: 0.2,
    maxZoom: 4,
    defaultViewport: { x: 0, y: 0, zoom: 1 },
    attributionPosition: 'bottom-left',
  };
};

/**
 * Feature capability matrix
 * Documents which features require which other features
 */
export const FEATURE_DEPENDENCIES = {
  enableNodeCreation: ['enableContextMenus', 'enableDoubleClickCreate'],
  enableNodeDeletion: ['enableNodeSelection', 'enableContextMenus'],
  enableNodeDuplication: ['enableNodeSelection', 'enableContextMenus'],
  enableEdgeDeletion: ['enableEdgeSelection', 'enableContextMenus'],
  enableMultiSelection: ['enableNodeSelection'],
  enableKeyboardShortcuts: ['enableNodeSelection'],
  enableCollapsible: ['enableAnimations'],
  enableHandleDecorators: ['enableEnhancedEdges'],
};

/**
 * Check if a feature's dependencies are met
 *
 * @param {string} feature - Feature name
 * @param {Object} config - Feature configuration
 * @returns {Object} {isMet: boolean, missing: []}
 */
export const checkFeatureDependencies = (feature, config) => {
  const dependencies = FEATURE_DEPENDENCIES[feature] || [];
  const missing = dependencies.filter((dep) => !config[dep]);

  return {
    isMet: missing.length === 0,
    missing,
  };
};

/**
 * Auto-fix feature configuration dependencies
 *
 * @param {Object} config - Feature configuration
 * @returns {Object} Fixed configuration
 */
export const autoFixDependencies = (config) => {
  const fixed = { ...config };

  Object.keys(FEATURE_DEPENDENCIES).forEach((feature) => {
    if (fixed[feature]) {
      const deps = FEATURE_DEPENDENCIES[feature];
      // Check if ANY dependency is met (not all required)
      const hasAnyDep = deps.some((dep) => fixed[dep]);
      if (!hasAnyDep && deps.length > 0) {
        // Enable first dependency
        fixed[deps[0]] = true;
      }
    }
  });

  return fixed;
};

/**
 * Get feature description
 *
 * @param {string} feature - Feature name
 * @returns {string} Description
 */
export const getFeatureDescription = (feature) => {
  const descriptions = {
    enableCollapsible: 'Allow nodes to collapse/expand showing different levels of detail',
    enableContextMenus: 'Enable right-click context menus for nodes, edges, and canvas',
    enableNodeCreation: 'Allow creating new nodes via double-click or context menu',
    enableAnimations: 'Enable smooth animations and transitions',
    enableEnhancedEdges: 'Use enhanced edge types with advanced styling',
    enableNodeDragging: 'Allow dragging nodes to reposition them',
    enableNodeSelection: 'Allow selecting nodes by clicking',
    enableMultiSelection: 'Allow selecting multiple nodes with Shift key',
    enableNodeDeletion: 'Allow deleting nodes via keyboard or context menu',
    enableNodeDuplication: 'Allow duplicating nodes via context menu',
    enableEdgeSelection: 'Allow selecting edges by clicking',
    enableEdgeAnimation: 'Enable animated edges',
    enableEdgeStyling: 'Allow changing edge styles via context menu',
    enableEdgeDeletion: 'Allow deleting edges via context menu',
    enableDoubleClickCreate: 'Create nodes by double-clicking canvas',
    enableRightClickMenu: 'Show context menu on right-click',
    enableKeyboardShortcuts: 'Enable keyboard shortcuts for common actions',
    enablePanZoom: 'Allow panning and zooming the canvas',
    enableMinimap: 'Show minimap for navigation',
    enableControls: 'Show zoom and fit controls',
    enableExploration: 'Enable progressive disclosure exploration mode',
    enableAutoReveal: 'Automatically reveal connected nodes',
    enablePathHighlighting: 'Highlight guided path edges',
    enableGlassmorphism: 'Use glassmorphism effects on nodes',
    enableHandleDecorators: 'Show + decorators on node handles',
    enableEdgeLabels: 'Show labels on edges',
    enableNodeTooltips: 'Show tooltips on node hover',
    enableVirtualization: 'Only render visible elements for performance',
    enableLazyLoading: 'Lazy load node content for performance',
    enableDebounce: 'Debounce expensive operations',
    enableStatePersistence: 'Persist node expand/collapse state',
    enableLayoutPersistence: 'Persist node positions',
    enablePreferences: 'Save user preferences',
  };

  return descriptions[feature] || 'No description available';
};

/**
 * Export configuration to JSON
 *
 * @param {Object} config - Feature configuration
 * @param {Object} metadata - Additional metadata
 * @returns {string} JSON string
 */
export const exportConfig = (config, metadata = {}) => {
  return JSON.stringify(
    {
      version: '1.0',
      metadata: {
        exportDate: new Date().toISOString(),
        ...metadata,
      },
      features: config,
    },
    null,
    2
  );
};

/**
 * Import configuration from JSON
 *
 * @param {string} jsonString - JSON string
 * @returns {Object} Feature configuration
 */
export const importConfig = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    return data.features || DEFAULT_FEATURES;
  } catch (error) {
    console.error('Error importing config:', error);
    return DEFAULT_FEATURES;
  }
};

// Default export
export default {
  DEFAULT_FEATURES,
  FEATURE_PRESETS,
  getFeatureConfig,
  validateFeatureConfig,
  mergeFeatureConfigs,
  getReactFlowProps,
  FEATURE_DEPENDENCIES,
  checkFeatureDependencies,
  autoFixDependencies,
  getFeatureDescription,
  exportConfig,
  importConfig,
};
