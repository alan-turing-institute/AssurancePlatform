/**
 * Demos Index
 *
 * Central export point for demo components showcasing the collapsible node system.
 *
 * @module demos
 */

export { default as CollapsibleNodeDemo } from './CollapsibleNodeDemo';
export {
  default as IntegrationExample,
  EnhancedInteractiveCaseViewer,
} from './IntegrationExample';

export default {
  CollapsibleNodeDemo: require('./CollapsibleNodeDemo').default,
  IntegrationExample: require('./IntegrationExample').default,
  EnhancedInteractiveCaseViewer: require('./IntegrationExample').EnhancedInteractiveCaseViewer,
};
