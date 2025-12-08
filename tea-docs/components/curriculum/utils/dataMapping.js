/**
 * Data Mapping Utilities
 *
 * Utilities for converting between different data formats:
 * - Legacy InteractiveCaseViewer format
 * - Enhanced component format
 * - React Flow native format
 *
 * Ensures backward compatibility while supporting new features.
 *
 * @module dataMapping
 */

import { MarkerType } from 'reactflow';

/**
 * Map legacy node data to enhanced format
 *
 * @param {string} id - Node ID
 * @param {string} type - Node type (goal, strategy, etc.)
 * @param {Object} position - Node position {x, y}
 * @param {Object} data - Node data
 * @param {string} nodeType - Visual node type for rendering
 * @returns {Object} Enhanced node object
 */
export const mapNodeToEnhanced = (id, type, position, data, nodeType) => {
  return {
    id,
    type,
    position,
    data: {
      id,
      name: data.name || 'Unnamed Node',
      description: data.short_description || data.description || '',
      long_description: data.long_description || data.description || '',
      element: data.element || data,
      // Preserve all original data
      ...data,
    },
    // Store the node type for styling and behavior
    nodeType: nodeType || type,
  };
};

/**
 * Map legacy edge data to enhanced format
 *
 * @param {string} id - Edge ID
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 * @param {boolean} animated - Whether edge is animated
 * @param {string} type - Edge type
 * @param {Object} additionalData - Additional edge data
 * @returns {Object} Enhanced edge object
 */
export const mapEdgeToEnhanced = (
  id,
  source,
  target,
  animated = false,
  type = 'smart',
  additionalData = {}
) => {
  return {
    id,
    source,
    target,
    type,
    animated,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    data: {
      strength: 0.7,
      showStrengthIndicator: false,
      ...additionalData,
    },
  };
};

/**
 * Convert legacy case data structure to enhanced format
 *
 * @param {Object} caseData - Legacy case data
 * @param {Array} guidedPath - Array of node IDs in guided path
 * @param {boolean} useEnhancedEdges - Whether to use enhanced edge types
 * @returns {Object} {nodes, edges} in enhanced format
 */
export const convertCaseDataToEnhanced = (
  caseData,
  guidedPath = [],
  useEnhancedEdges = true
) => {
  if (!caseData || !caseData.goals || caseData.goals.length === 0) {
    console.warn('Invalid or empty case data provided');
    return { nodes: [], edges: [] };
  }

  const flowNodes = [];
  const flowEdges = [];
  let yOffset = 0;
  const xSpacing = 500;
  const ySpacing = 180;

  const goal = caseData.goals[0];

  // Add goal node
  flowNodes.push(
    mapNodeToEnhanced(
      'goal-1',
      'goal',
      { x: 400, y: yOffset },
      {
        name: goal.name,
        short_description: goal.short_description || goal.description,
        long_description: goal.long_description || goal.description,
        description: goal.description,
        element: goal,
      },
      'goal'
    )
  );
  yOffset += ySpacing;

  // Add context nodes
  if (goal.context && Array.isArray(goal.context)) {
    goal.context.forEach((ctx, idx) => {
      flowNodes.push(
        mapNodeToEnhanced(
          `context-${idx + 1}`,
          'context',
          { x: 100 + idx * 200, y: yOffset },
          {
            name: ctx.name,
            short_description: ctx.short_description || ctx.description,
            long_description: ctx.long_description || ctx.description,
            description: ctx.description,
            element: ctx,
          },
          'context'
        )
      );
    });
  }

  // Add strategies
  if (goal.strategies && Array.isArray(goal.strategies)) {
    goal.strategies.forEach((strategy, stratIdx) => {
      const strategyId = `strategy-${stratIdx + 1}`;

      flowNodes.push(
        mapNodeToEnhanced(
          strategyId,
          'strategy',
          { x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
          {
            name: strategy.name,
            short_description: strategy.short_description || strategy.description,
            long_description: strategy.long_description || strategy.description,
            description: strategy.description,
            element: strategy,
          },
          'strategy'
        )
      );

      // Add edge from goal to strategy
      const edgeType = useEnhancedEdges ? 'smart' : 'smoothstep';
      const isAnimated = guidedPath.includes(strategyId);
      flowEdges.push(
        mapEdgeToEnhanced(
          `goal-${strategyId}`,
          'goal-1',
          strategyId,
          isAnimated,
          edgeType,
          {
            relationshipType: 'supports',
          }
        )
      );

      // Add property claims for each strategy
      if (strategy.property_claims && Array.isArray(strategy.property_claims)) {
        strategy.property_claims.forEach((claim, claimIdx) => {
          const claimId = `claim-${stratIdx}-${claimIdx + 1}`;

          flowNodes.push(
            mapNodeToEnhanced(
              claimId,
              'propertyClaim',
              {
                x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
              },
              {
                name: claim.name,
                short_description: claim.short_description || claim.description,
                long_description: claim.long_description || claim.description,
                description: claim.description,
                element: claim,
              },
              'propertyClaim'
            )
          );

          // Add edge from strategy to claim
          flowEdges.push(
            mapEdgeToEnhanced(
              `${strategyId}-${claimId}`,
              strategyId,
              claimId,
              guidedPath.includes(claimId),
              edgeType,
              {
                relationshipType: 'decomposes',
              }
            )
          );

          // Add evidence for claims
          if (claim.evidence && Array.isArray(claim.evidence)) {
            claim.evidence.forEach((evid, evidIdx) => {
              const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;

              flowNodes.push(
                mapNodeToEnhanced(
                  evidId,
                  'evidence',
                  {
                    x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                    y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
                  },
                  {
                    name: evid.name,
                    short_description: evid.short_description || evid.description,
                    long_description: evid.long_description || evid.description,
                    description: evid.description,
                    element: evid,
                  },
                  'evidence'
                )
              );

              // Add edge from claim to evidence
              flowEdges.push(
                mapEdgeToEnhanced(
                  `${claimId}-${evidId}`,
                  claimId,
                  evidId,
                  guidedPath.includes(evidId),
                  edgeType,
                  {
                    relationshipType: 'supports',
                  }
                )
              );
            });
          }
        });
      }
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
};

/**
 * Apply progressive disclosure to nodes
 *
 * @param {Array} nodes - Array of node objects
 * @param {Set} revealedNodes - Set of revealed node IDs
 * @param {Array} guidedPath - Array of node IDs always visible
 * @returns {Array} Nodes with hidden property set
 */
export const applyProgressiveDisclosure = (nodes, revealedNodes, guidedPath = []) => {
  return nodes.map((node) => ({
    ...node,
    hidden: !revealedNodes.has(node.id) && !guidedPath.includes(node.id),
  }));
};

/**
 * Get child nodes of a given node
 *
 * @param {string} nodeId - Parent node ID
 * @param {Array} edges - Array of edge objects
 * @returns {Array} Array of child node IDs
 */
export const getChildNodes = (nodeId, edges) => {
  return edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
};

/**
 * Get parent nodes of a given node
 *
 * @param {string} nodeId - Child node ID
 * @param {Array} edges - Array of edge objects
 * @returns {Array} Array of parent node IDs
 */
export const getParentNodes = (nodeId, edges) => {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
};

/**
 * Get all connected nodes (parents and children)
 *
 * @param {string} nodeId - Node ID
 * @param {Array} edges - Array of edge objects
 * @returns {Object} {parents: [], children: []}
 */
export const getConnectedNodes = (nodeId, edges) => {
  return {
    parents: getParentNodes(nodeId, edges),
    children: getChildNodes(nodeId, edges),
  };
};

/**
 * Calculate node statistics
 *
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @returns {Object} Statistics object
 */
export const calculateGraphStats = (nodes, edges) => {
  const nodeTypeCount = nodes.reduce((acc, node) => {
    const type = node.nodeType || node.type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodeTypeCount,
    maxDepth: calculateMaxDepth(nodes, edges),
  };
};

/**
 * Calculate maximum depth of graph
 *
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @returns {number} Maximum depth
 */
const calculateMaxDepth = (nodes, edges) => {
  // Find root nodes (nodes with no parents)
  const rootNodes = nodes.filter(
    (node) => !edges.some((edge) => edge.target === node.id)
  );

  if (rootNodes.length === 0) return 0;

  let maxDepth = 0;

  const calculateDepth = (nodeId, currentDepth) => {
    const children = getChildNodes(nodeId, edges);
    if (children.length === 0) {
      maxDepth = Math.max(maxDepth, currentDepth);
    } else {
      children.forEach((childId) => {
        calculateDepth(childId, currentDepth + 1);
      });
    }
  };

  rootNodes.forEach((rootNode) => {
    calculateDepth(rootNode.id, 1);
  });

  return maxDepth;
};

/**
 * Validate node data structure
 *
 * @param {Object} node - Node object to validate
 * @returns {Object} {isValid: boolean, errors: []}
 */
export const validateNodeData = (node) => {
  const errors = [];

  if (!node.id) {
    errors.push('Node must have an id');
  }

  if (!node.type) {
    errors.push('Node must have a type');
  }

  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node must have valid position {x, y}');
  }

  if (!node.data) {
    errors.push('Node must have data object');
  } else {
    if (!node.data.name) {
      errors.push('Node data must have a name');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate edge data structure
 *
 * @param {Object} edge - Edge object to validate
 * @returns {Object} {isValid: boolean, errors: []}
 */
export const validateEdgeData = (edge) => {
  const errors = [];

  if (!edge.id) {
    errors.push('Edge must have an id');
  }

  if (!edge.source) {
    errors.push('Edge must have a source');
  }

  if (!edge.target) {
    errors.push('Edge must have a target');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate entire graph structure
 *
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @returns {Object} {isValid: boolean, errors: [], warnings: []}
 */
export const validateGraphData = (nodes, edges) => {
  const errors = [];
  const warnings = [];

  // Validate all nodes
  nodes.forEach((node) => {
    const validation = validateNodeData(node);
    if (!validation.isValid) {
      errors.push(...validation.errors.map((err) => `Node ${node.id}: ${err}`));
    }
  });

  // Validate all edges
  edges.forEach((edge) => {
    const validation = validateEdgeData(edge);
    if (!validation.isValid) {
      errors.push(...validation.errors.map((err) => `Edge ${edge.id}: ${err}`));
    }

    // Check if source and target nodes exist
    const sourceExists = nodes.some((n) => n.id === edge.source);
    const targetExists = nodes.some((n) => n.id === edge.target);

    if (!sourceExists) {
      errors.push(`Edge ${edge.id}: Source node ${edge.source} does not exist`);
    }

    if (!targetExists) {
      errors.push(`Edge ${edge.id}: Target node ${edge.target} does not exist`);
    }
  });

  // Check for orphaned nodes (no connections)
  nodes.forEach((node) => {
    const hasConnection =
      edges.some((e) => e.source === node.id) || edges.some((e) => e.target === node.id);
    if (!hasConnection && node.type !== 'goal') {
      warnings.push(`Node ${node.id} has no connections`);
    }
  });

  // Check for circular dependencies
  const hasCycle = detectCycle(nodes, edges);
  if (hasCycle) {
    warnings.push('Graph contains circular dependencies');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Detect if graph has cycles
 *
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @returns {boolean} True if cycle detected
 */
const detectCycle = (nodes, edges) => {
  const visited = new Set();
  const recursionStack = new Set();

  const hasCycleDFS = (nodeId) => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const children = getChildNodes(nodeId, edges);
    for (const childId of children) {
      if (!visited.has(childId)) {
        if (hasCycleDFS(childId)) {
          return true;
        }
      } else if (recursionStack.has(childId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycleDFS(node.id)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Export graph data to JSON
 *
 * @param {Array} nodes - Array of node objects
 * @param {Array} edges - Array of edge objects
 * @param {Object} metadata - Additional metadata
 * @returns {string} JSON string
 */
export const exportGraphToJSON = (nodes, edges, metadata = {}) => {
  return JSON.stringify(
    {
      version: '1.0',
      metadata: {
        exportDate: new Date().toISOString(),
        ...metadata,
      },
      nodes,
      edges,
      stats: calculateGraphStats(nodes, edges),
    },
    null,
    2
  );
};

/**
 * Import graph data from JSON
 *
 * @param {string} jsonString - JSON string
 * @returns {Object} {nodes, edges, metadata}
 */
export const importGraphFromJSON = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    return {
      nodes: data.nodes || [],
      edges: data.edges || [],
      metadata: data.metadata || {},
    };
  } catch (error) {
    console.error('Error importing graph data:', error);
    return {
      nodes: [],
      edges: [],
      metadata: {},
      error: error.message,
    };
  }
};

// Default export with all utilities
export default {
  mapNodeToEnhanced,
  mapEdgeToEnhanced,
  convertCaseDataToEnhanced,
  applyProgressiveDisclosure,
  getChildNodes,
  getParentNodes,
  getConnectedNodes,
  calculateGraphStats,
  validateNodeData,
  validateEdgeData,
  validateGraphData,
  exportGraphToJSON,
  importGraphFromJSON,
};
