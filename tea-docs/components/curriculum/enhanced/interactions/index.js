/**
 * Node Creation Interactions
 *
 * Exports all components and utilities for double-click node creation workflow.
 *
 * @module interactions
 */

// Components
export { default as DoubleClickHandler, useDoubleClickHandler, withDoubleClickHandler } from './DoubleClickHandler';
export { default as NodeCreator, useNodeCreator } from './NodeCreator';
export { default as NodeTypeSelector, CompactNodeTypeSelector } from './NodeTypeSelector';
export { default as NodePositioner, useNodePositioner } from './NodePositioner';

// Utilities
export * from './creationUtils';

/**
 * Default export with all modules
 */
export default {
  DoubleClickHandler: require('./DoubleClickHandler').default,
  NodeCreator: require('./NodeCreator').default,
  NodeTypeSelector: require('./NodeTypeSelector').default,
  NodePositioner: require('./NodePositioner').default,
  utils: require('./creationUtils'),
};
