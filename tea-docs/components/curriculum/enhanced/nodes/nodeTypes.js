/**
 * React Flow Node Type Mappings
 *
 * This file exports the mapping object required by React Flow to render
 * custom node types. It maps node type identifiers to their corresponding
 * React components.
 *
 * Usage in React Flow:
 * ```jsx
 * import { nodeTypes } from './nodes/nodeTypes';
 *
 * <ReactFlow
 *   nodes={nodes}
 *   edges={edges}
 *   nodeTypes={nodeTypes}
 * />
 * ```
 *
 * @module nodeTypes
 */

import React from 'react';
import BaseNode from './BaseNode';

/**
 * Wrapper components for each node type using BaseNode
 * These provide the correct nodeType prop for styling and behavior
 */
const GoalNodeWrapper = (props) => <BaseNode {...props} nodeType="goal" />;
const StrategyNodeWrapper = (props) => <BaseNode {...props} nodeType="strategy" />;
const PropertyClaimNodeWrapper = (props) => <BaseNode {...props} nodeType="propertyClaim" />;
const EvidenceNodeWrapper = (props) => <BaseNode {...props} nodeType="evidence" />;
const ContextNodeWrapper = (props) => <BaseNode {...props} nodeType="context" />;

/**
 * React Flow node type mapping
 *
 * Maps string identifiers to React components for custom node rendering.
 * React Flow uses this mapping to determine which component to render
 * for each node based on its `type` property.
 *
 * Node Type Identifiers:
 * - 'goal': Top-level goals with green theme
 * - 'strategy': Strategies with purple theme
 * - 'propertyClaim': Property claims with orange theme
 * - 'claim': Alias for propertyClaim
 * - 'evidence': Evidence nodes with cyan theme
 * - 'context': Context/assumption nodes with gray theme
 *
 * @type {Object.<string, React.Component>}
 */
export const nodeTypes = {
  // Primary node types
  goal: GoalNodeWrapper,
  strategy: StrategyNodeWrapper,
  propertyClaim: PropertyClaimNodeWrapper,
  evidence: EvidenceNodeWrapper,
  context: ContextNodeWrapper,

  // Aliases for backward compatibility
  claim: PropertyClaimNodeWrapper,
  Goal: GoalNodeWrapper,
  Strategy: StrategyNodeWrapper,
  PropertyClaim: PropertyClaimNodeWrapper,
  Evidence: EvidenceNodeWrapper,
  Context: ContextNodeWrapper,
};

/**
 * Get the React component for a given node type
 *
 * @param {string} nodeType - The node type identifier
 * @returns {React.Component} The corresponding React component
 *
 * @example
 * const NodeComponent = getNodeComponent('goal');
 * // Returns GoalNode component
 */
export const getNodeComponent = (nodeType) => {
  const normalizedType = nodeType?.toLowerCase().replace(/[-_\s]/g, '');

  const typeMap = {
    goal: GoalNodeWrapper,
    strategy: StrategyNodeWrapper,
    propertyclaim: PropertyClaimNodeWrapper,
    claim: PropertyClaimNodeWrapper,
    evidence: EvidenceNodeWrapper,
    context: ContextNodeWrapper,
  };

  return typeMap[normalizedType] || GoalNodeWrapper;
};

/**
 * Get all available node type identifiers
 *
 * @returns {string[]} Array of node type identifiers
 *
 * @example
 * const types = getAvailableNodeTypes();
 * // Returns ['goal', 'strategy', 'propertyClaim', 'evidence', 'context']
 */
export const getAvailableNodeTypes = () => {
  return ['goal', 'strategy', 'propertyClaim', 'evidence', 'context'];
};

/**
 * Check if a node type is valid
 *
 * @param {string} nodeType - The node type to check
 * @returns {boolean} True if the node type is valid
 *
 * @example
 * isValidNodeType('goal'); // true
 * isValidNodeType('invalid'); // false
 */
export const isValidNodeType = (nodeType) => {
  const normalizedType = nodeType?.toLowerCase().replace(/[-_\s]/g, '');
  const validTypes = [
    'goal',
    'strategy',
    'propertyclaim',
    'claim',
    'evidence',
    'context',
  ];
  return validTypes.includes(normalizedType);
};

/**
 * Create a node data object with default values
 *
 * @param {string} nodeType - The node type
 * @param {Object} customData - Custom data to merge with defaults
 * @returns {Object} Complete node data object
 *
 * @example
 * const nodeData = createNodeData('goal', {
 *   name: 'System Safety',
 *   description: 'System is safe to operate'
 * });
 */
export const createNodeData = (nodeType, customData = {}) => {
  const defaults = {
    goal: {
      name: 'New Goal',
      description: 'Goal description',
      importance: 'medium',
      progress: 0,
      subGoalsCount: 0,
      isRoot: false,
    },
    strategy: {
      name: 'New Strategy',
      description: 'Strategy description',
      strategyType: 'AND',
      approach: 'decomposition',
      pathCount: 0,
    },
    propertyClaim: {
      name: 'New Claim',
      description: 'Claim description',
      strength: 'moderate',
      verificationStatus: 'pending',
      linkedEvidenceCount: 0,
    },
    evidence: {
      name: 'New Evidence',
      description: 'Evidence description',
      evidenceType: 'document',
      confidence: 75,
      quality: 'medium',
    },
    context: {
      name: 'New Context',
      description: 'Context description',
      contextType: 'assumption',
      importance: 'medium',
      relatedNodesCount: 0,
    },
  };

  const normalizedType = nodeType?.toLowerCase().replace(/[-_\s]/g, '');
  const typeKey =
    normalizedType === 'claim' ? 'propertyClaim' : normalizedType;

  return {
    ...(defaults[typeKey] || defaults.goal),
    ...customData,
  };
};

/**
 * Create a complete React Flow node object
 *
 * @param {string} id - Node ID
 * @param {string} nodeType - Node type
 * @param {Object} position - Node position {x, y}
 * @param {Object} customData - Custom node data
 * @returns {Object} Complete React Flow node object
 *
 * @example
 * const node = createNode('goal-1', 'goal', { x: 100, y: 100 }, {
 *   name: 'System Safety',
 *   importance: 'critical'
 * });
 */
export const createNode = (id, nodeType, position, customData = {}) => {
  return {
    id,
    type: nodeType,
    position,
    data: createNodeData(nodeType, { id, ...customData }),
  };
};

/**
 * Valid children mapping for GSN (Goal Structuring Notation)
 * Defines which node types can be children of each parent type
 */
export const validChildrenMap = {
  goal: ['strategy', 'propertyClaim', 'context'],
  strategy: ['propertyClaim', 'strategy', 'evidence', 'context'],
  propertyClaim: ['propertyClaim', 'strategy', 'evidence', 'context'],
  evidence: [], // Leaf nodes
  context: [], // Supporting nodes
};

/**
 * Check if a connection between two node types is valid
 * @param {string} sourceType - Parent node type
 * @param {string} targetType - Child node type
 * @returns {boolean} True if connection is valid
 */
export const isValidConnection = (sourceType, targetType) => {
  const normalizedSource = sourceType?.toLowerCase().replace(/[-_\s]/g, '');
  const normalizedTarget = targetType?.toLowerCase().replace(/[-_\s]/g, '');

  const sourceKey = normalizedSource === 'claim' ? 'propertyClaim' : normalizedSource;
  const targetKey = normalizedTarget === 'claim' ? 'propertyClaim' : normalizedTarget;

  const validChildren = validChildrenMap[sourceKey] || [];
  return validChildren.includes(targetKey);
};

/**
 * Get valid child types for a parent node
 * @param {string} parentType - Parent node type
 * @returns {string[]} Array of valid child type identifiers
 */
export const getValidChildren = (parentType) => {
  const normalizedType = parentType?.toLowerCase().replace(/[-_\s]/g, '');
  const typeKey = normalizedType === 'claim' ? 'propertyClaim' : normalizedType;
  return validChildrenMap[typeKey] || [];
};

/**
 * Node type metadata for UI display
 * Useful for creating node selection menus, documentation, etc.
 */
export const nodeTypeMetadata = {
  goal: {
    id: 'goal',
    name: 'Goal',
    description: 'Top-level system property to be assured',
    category: 'Primary',
    color: 'green',
    icon: 'Target',
    shortcut: 'G',
    validChildren: ['strategy', 'propertyClaim', 'context'],
  },
  strategy: {
    id: 'strategy',
    name: 'Strategy',
    description: 'Approach for decomposing a goal',
    category: 'Primary',
    color: 'purple',
    icon: 'GitBranch',
    shortcut: 'S',
    validChildren: ['propertyClaim', 'strategy', 'evidence', 'context'],
  },
  propertyClaim: {
    id: 'propertyClaim',
    name: 'Property Claim',
    description: 'Specific property or sub-claim',
    category: 'Primary',
    color: 'orange',
    icon: 'FileText',
    shortcut: 'C',
    validChildren: ['propertyClaim', 'strategy', 'evidence', 'context'],
  },
  evidence: {
    id: 'evidence',
    name: 'Evidence',
    description: 'Supporting evidence or artifact',
    category: 'Supporting',
    color: 'cyan',
    icon: 'CheckCircle',
    shortcut: 'E',
    validChildren: [],
  },
  context: {
    id: 'context',
    name: 'Context',
    description: 'Contextual information or assumption',
    category: 'Supporting',
    color: 'gray',
    icon: 'AlertCircle',
    shortcut: 'X',
    validChildren: [],
  },
};

/**
 * Get node type metadata
 *
 * @param {string} nodeType - The node type identifier
 * @returns {Object} Node type metadata
 */
export const getNodeTypeMetadata = (nodeType) => {
  const normalizedType = nodeType?.toLowerCase().replace(/[-_\s]/g, '');
  const typeKey =
    normalizedType === 'claim' ? 'propertyClaim' : normalizedType;
  return nodeTypeMetadata[typeKey] || nodeTypeMetadata.goal;
};

/**
 * Get node types grouped by category
 *
 * @returns {Object} Node types grouped by category
 */
export const getNodeTypesByCategory = () => {
  return {
    Primary: [
      nodeTypeMetadata.goal,
      nodeTypeMetadata.strategy,
      nodeTypeMetadata.propertyClaim,
    ],
    Supporting: [nodeTypeMetadata.evidence, nodeTypeMetadata.context],
  };
};

// Default export
export default nodeTypes;
