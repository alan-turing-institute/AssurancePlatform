/**
 * Curriculum Components Index
 *
 * Main export point for all curriculum-related components.
 * Provides both legacy and enhanced components for backward compatibility.
 *
 * @module curriculum
 */

// Legacy Components
export { default as InteractiveCaseViewer } from './InteractiveCaseViewer';
export { default as CaseViewerWrapper } from './CaseViewerWrapper';

// Enhanced Components
export { default as EnhancedInteractiveCaseViewer } from './EnhancedInteractiveCaseViewer';
export {
  convertCaseDataToEnhanced,
  mapNodeToEnhanced,
  mapEdgeToEnhanced,
} from './EnhancedInteractiveCaseViewer';

// Utilities
export * as dataMapping from './utils/dataMapping';
export * as featureConfig from './config/featureConfig';

// Re-export all enhanced components for convenience
export * from './enhanced';

/**
 * Default export with organized namespaces
 */
export default {
  // Legacy components
  legacy: {
    InteractiveCaseViewer: require('./InteractiveCaseViewer').default,
    CaseViewerWrapper: require('./CaseViewerWrapper').default,
  },

  // Enhanced components
  enhanced: {
    InteractiveCaseViewer: require('./EnhancedInteractiveCaseViewer').default,
  },

  // Utilities
  utils: {
    dataMapping: require('./utils/dataMapping').default,
    featureConfig: require('./config/featureConfig').default,
  },

  // Enhanced modules
  modules: require('./enhanced').default,
};
