/**
 * Nodes Index
 *
 * Central export point for all node components.
 *
 * @module nodes
 */

// Base Node Components
export {
  default as BaseNode,
  BaseNodeWithActions,
  BaseNodeWithMetadata,
  CompactBaseNode,
  LargeBaseNode,
} from './BaseNode';

// Collapsible Node Components
export {
  default as CollapsibleNode,
  FocusCollapsibleNode,
  ProgressiveCollapsibleNode,
  ControlledCollapsibleNode,
  MemoizedCollapsibleNode,
} from './CollapsibleNode';

// State Management
export {
  default as NodeStateManager,
  NodeStateControls,
  useNodeStateContext,
  useNodeStateWithFlow,
  withNodeState,
} from './NodeStateManager';

export { default as useNodeState } from './useNodeState';

// Specialized Node Type Components
export {
  default as GoalNode,
  CompactGoalNode,
  LargeGoalNode,
} from './GoalNode';

export {
  default as StrategyNode,
  CompactStrategyNode,
  DecompositionStrategyNode,
  AlternativeStrategyNode,
} from './StrategyNode';

export {
  default as PropertyClaimNode,
  CompactPropertyClaimNode,
  VerifiedPropertyClaimNode,
  PendingPropertyClaimNode,
} from './PropertyClaimNode';

export {
  default as EvidenceNode,
  CompactEvidenceNode,
  HighConfidenceEvidenceNode,
  TestEvidenceNode,
  DocumentEvidenceNode,
} from './EvidenceNode';

export {
  default as ContextNode,
  CompactContextNode,
  AssumptionContextNode,
  ConstraintContextNode,
  JustificationContextNode,
  CriticalContextNode,
} from './ContextNode';

// React Flow Node Types Mapping
export {
  nodeTypes,
  getNodeComponent,
  getAvailableNodeTypes,
  isValidNodeType,
  createNodeData,
  createNode,
  nodeTypeMetadata,
  getNodeTypeMetadata,
  getNodeTypesByCategory,
} from './nodeTypes';

// Default export with all components
export default {
  // Base nodes
  BaseNode: require('./BaseNode').default,
  BaseNodeWithActions: require('./BaseNode').BaseNodeWithActions,
  BaseNodeWithMetadata: require('./BaseNode').BaseNodeWithMetadata,
  CompactBaseNode: require('./BaseNode').CompactBaseNode,
  LargeBaseNode: require('./BaseNode').LargeBaseNode,

  // Collapsible nodes
  CollapsibleNode: require('./CollapsibleNode').default,
  FocusCollapsibleNode: require('./CollapsibleNode').FocusCollapsibleNode,
  ProgressiveCollapsibleNode: require('./CollapsibleNode').ProgressiveCollapsibleNode,
  ControlledCollapsibleNode: require('./CollapsibleNode').ControlledCollapsibleNode,
  MemoizedCollapsibleNode: require('./CollapsibleNode').MemoizedCollapsibleNode,

  // State management
  NodeStateManager: require('./NodeStateManager').default,
  NodeStateControls: require('./NodeStateManager').NodeStateControls,
  useNodeStateContext: require('./NodeStateManager').useNodeStateContext,
  useNodeStateWithFlow: require('./NodeStateManager').useNodeStateWithFlow,
  withNodeState: require('./NodeStateManager').withNodeState,
  useNodeState: require('./useNodeState').default,

  // Specialized node types
  GoalNode: require('./GoalNode').default,
  CompactGoalNode: require('./GoalNode').CompactGoalNode,
  LargeGoalNode: require('./GoalNode').LargeGoalNode,
  StrategyNode: require('./StrategyNode').default,
  CompactStrategyNode: require('./StrategyNode').CompactStrategyNode,
  DecompositionStrategyNode: require('./StrategyNode').DecompositionStrategyNode,
  AlternativeStrategyNode: require('./StrategyNode').AlternativeStrategyNode,
  PropertyClaimNode: require('./PropertyClaimNode').default,
  CompactPropertyClaimNode: require('./PropertyClaimNode').CompactPropertyClaimNode,
  VerifiedPropertyClaimNode: require('./PropertyClaimNode').VerifiedPropertyClaimNode,
  PendingPropertyClaimNode: require('./PropertyClaimNode').PendingPropertyClaimNode,
  EvidenceNode: require('./EvidenceNode').default,
  CompactEvidenceNode: require('./EvidenceNode').CompactEvidenceNode,
  HighConfidenceEvidenceNode: require('./EvidenceNode').HighConfidenceEvidenceNode,
  TestEvidenceNode: require('./EvidenceNode').TestEvidenceNode,
  DocumentEvidenceNode: require('./EvidenceNode').DocumentEvidenceNode,
  ContextNode: require('./ContextNode').default,
  CompactContextNode: require('./ContextNode').CompactContextNode,
  AssumptionContextNode: require('./ContextNode').AssumptionContextNode,
  ConstraintContextNode: require('./ContextNode').ConstraintContextNode,
  JustificationContextNode: require('./ContextNode').JustificationContextNode,
  CriticalContextNode: require('./ContextNode').CriticalContextNode,

  // Node types mapping
  nodeTypes: require('./nodeTypes').nodeTypes,
  getNodeComponent: require('./nodeTypes').getNodeComponent,
  getAvailableNodeTypes: require('./nodeTypes').getAvailableNodeTypes,
  isValidNodeType: require('./nodeTypes').isValidNodeType,
  createNodeData: require('./nodeTypes').createNodeData,
  createNode: require('./nodeTypes').createNode,
  nodeTypeMetadata: require('./nodeTypes').nodeTypeMetadata,
  getNodeTypeMetadata: require('./nodeTypes').getNodeTypeMetadata,
  getNodeTypesByCategory: require('./nodeTypes').getNodeTypesByCategory,
};
