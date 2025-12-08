/**
 * Node Creation Utilities
 *
 * Utility functions for node creation workflow including ID generation,
 * position calculation, validation, and smart positioning algorithms.
 *
 * @module creationUtils
 */

import { nodeTypeMetadata, createNodeData } from '../nodes/nodeTypes';

/**
 * Generate a unique node ID
 * @param {string} nodeType - The type of node
 * @returns {string} Unique node ID
 */
export const generateNodeId = (nodeType) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 7);
  return `${nodeType}-${timestamp}-${random}`;
};

/**
 * Convert screen coordinates to React Flow coordinates
 * @param {Object} screenPosition - Screen position {x, y}
 * @param {Object} reactFlowInstance - React Flow instance
 * @returns {Object} Flow coordinates {x, y}
 */
export const screenToFlowPosition = (screenPosition, reactFlowInstance) => {
  if (!reactFlowInstance) {
    return screenPosition;
  }

  const flowPosition = reactFlowInstance.screenToFlowPosition({
    x: screenPosition.x,
    y: screenPosition.y,
  });

  return flowPosition;
};

/**
 * Snap position to grid
 * @param {Object} position - Position {x, y}
 * @param {number} gridSize - Grid cell size (default: 20)
 * @returns {Object} Snapped position {x, y}
 */
export const snapToGrid = (position, gridSize = 20) => {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
};

/**
 * Calculate distance between two points
 * @param {Object} point1 - First point {x, y}
 * @param {Object} point2 - Second point {x, y}
 * @returns {number} Distance
 */
export const calculateDistance = (point1, point2) => {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if position overlaps with existing nodes
 * @param {Object} position - Position to check {x, y}
 * @param {Array} nodes - Existing nodes
 * @param {Object} nodeSize - Node size {width, height}
 * @param {number} padding - Minimum padding between nodes
 * @returns {boolean} True if overlaps
 */
export const checkPositionOverlap = (
  position,
  nodes,
  nodeSize = { width: 300, height: 150 },
  padding = 20
) => {
  return nodes.some((node) => {
    const nodeWidth = node.width || nodeSize.width;
    const nodeHeight = node.height || nodeSize.height;

    const overlapX =
      position.x < node.position.x + nodeWidth + padding &&
      position.x + nodeSize.width + padding > node.position.x;

    const overlapY =
      position.y < node.position.y + nodeHeight + padding &&
      position.y + nodeSize.height + padding > node.position.y;

    return overlapX && overlapY;
  });
};

/**
 * Find nearest non-overlapping position
 * @param {Object} desiredPosition - Desired position {x, y}
 * @param {Array} nodes - Existing nodes
 * @param {Object} nodeSize - Node size {width, height}
 * @param {number} maxAttempts - Maximum positioning attempts
 * @returns {Object} Valid position {x, y}
 */
export const findNonOverlappingPosition = (
  desiredPosition,
  nodes,
  nodeSize = { width: 300, height: 150 },
  maxAttempts = 20
) => {
  let position = { ...desiredPosition };

  // If no overlap at desired position, use it
  if (!checkPositionOverlap(position, nodes, nodeSize)) {
    return position;
  }

  // Try positions in a spiral pattern
  const step = 50;
  let attempt = 0;
  let radius = step;
  let angle = 0;

  while (attempt < maxAttempts) {
    // Calculate position on spiral
    position = {
      x: desiredPosition.x + radius * Math.cos(angle),
      y: desiredPosition.y + radius * Math.sin(angle),
    };

    if (!checkPositionOverlap(position, nodes, nodeSize)) {
      return position;
    }

    // Move to next position on spiral
    angle += Math.PI / 4; // 45 degrees
    if (angle >= 2 * Math.PI) {
      angle = 0;
      radius += step;
    }

    attempt++;
  }

  // If all attempts failed, return position far from existing nodes
  return {
    x: desiredPosition.x + radius + step,
    y: desiredPosition.y,
  };
};

/**
 * Calculate smart position based on connected nodes
 * @param {Array} sourceNodes - Nodes that will connect to the new node
 * @param {Array} allNodes - All existing nodes
 * @param {string} direction - Preferred direction ('bottom', 'right', 'auto')
 * @returns {Object} Calculated position {x, y}
 */
export const calculateSmartPosition = (
  sourceNodes,
  allNodes,
  direction = 'auto'
) => {
  if (!sourceNodes || sourceNodes.length === 0) {
    // No source nodes, return center position
    return { x: 100, y: 100 };
  }

  // Calculate average position of source nodes
  const avgPosition = sourceNodes.reduce(
    (acc, node) => ({
      x: acc.x + node.position.x / sourceNodes.length,
      y: acc.y + node.position.y / sourceNodes.length,
    }),
    { x: 0, y: 0 }
  );

  const nodeSize = { width: 300, height: 150 };
  const spacing = 200;

  let calculatedPosition;

  switch (direction) {
    case 'bottom':
      calculatedPosition = {
        x: avgPosition.x,
        y: avgPosition.y + spacing,
      };
      break;

    case 'right':
      calculatedPosition = {
        x: avgPosition.x + spacing,
        y: avgPosition.y,
      };
      break;

    case 'auto':
    default:
      // Determine best direction based on available space
      const bottomPosition = {
        x: avgPosition.x,
        y: avgPosition.y + spacing,
      };
      const rightPosition = {
        x: avgPosition.x + spacing,
        y: avgPosition.y,
      };

      const bottomOverlap = checkPositionOverlap(
        bottomPosition,
        allNodes,
        nodeSize
      );
      const rightOverlap = checkPositionOverlap(
        rightPosition,
        allNodes,
        nodeSize
      );

      if (!bottomOverlap) {
        calculatedPosition = bottomPosition;
      } else if (!rightOverlap) {
        calculatedPosition = rightPosition;
      } else {
        calculatedPosition = bottomPosition;
      }
      break;
  }

  // Ensure final position doesn't overlap
  return findNonOverlappingPosition(calculatedPosition, allNodes, nodeSize);
};

/**
 * Get default node data for a type
 * @param {string} nodeType - Node type
 * @param {Object} customData - Custom data to merge
 * @returns {Object} Node data
 */
export const getDefaultNodeData = (nodeType, customData = {}) => {
  return createNodeData(nodeType, {
    ...customData,
    createdAt: new Date().toISOString(),
  });
};

/**
 * Create a complete node object
 * @param {string} nodeType - Node type
 * @param {Object} position - Node position {x, y}
 * @param {Object} customData - Custom data
 * @returns {Object} Complete React Flow node object
 */
export const createNodeObject = (nodeType, position, customData = {}) => {
  const id = generateNodeId(nodeType);
  const data = getDefaultNodeData(nodeType, { id, ...customData });

  return {
    id,
    type: nodeType,
    position,
    data,
  };
};

/**
 * Get recently used node types from history
 * @param {Array} creationHistory - Array of created node types
 * @param {number} maxRecent - Maximum number of recent types to return
 * @returns {Array} Recently used node types
 */
export const getRecentNodeTypes = (creationHistory = [], maxRecent = 3) => {
  const uniqueTypes = [...new Set(creationHistory)];
  return uniqueTypes.slice(-maxRecent).reverse();
};

/**
 * Validate node creation
 * @param {string} nodeType - Node type
 * @param {Object} position - Node position
 * @param {Array} existingNodes - Existing nodes
 * @returns {Object} Validation result {valid, error}
 */
export const validateNodeCreation = (nodeType, position, existingNodes) => {
  // Check if node type is valid
  const validTypes = Object.keys(nodeTypeMetadata);
  if (!validTypes.includes(nodeType)) {
    return {
      valid: false,
      error: `Invalid node type: ${nodeType}`,
    };
  }

  // Check if position is valid
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    return {
      valid: false,
      error: 'Invalid position: must have numeric x and y coordinates',
    };
  }

  // Check for extreme positions
  if (position.x < -10000 || position.x > 10000 || position.y < -10000 || position.y > 10000) {
    return {
      valid: false,
      error: 'Position out of bounds',
    };
  }

  return {
    valid: true,
    error: null,
  };
};

/**
 * Calculate connection hints for new node
 * @param {Object} newNodePosition - New node position
 * @param {Array} existingNodes - Existing nodes
 * @param {number} maxDistance - Maximum distance to consider for hints
 * @returns {Array} Suggested connections [{nodeId, direction, distance}]
 */
export const calculateConnectionHints = (
  newNodePosition,
  existingNodes,
  maxDistance = 300
) => {
  return existingNodes
    .map((node) => {
      const distance = calculateDistance(newNodePosition, node.position);
      const dx = newNodePosition.x - node.position.x;
      const dy = newNodePosition.y - node.position.y;

      let direction = 'none';
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'bottom' : 'top';
      }

      return {
        nodeId: node.id,
        nodeName: node.data?.name || 'Unnamed',
        direction,
        distance,
      };
    })
    .filter((hint) => hint.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5); // Top 5 closest nodes
};

/**
 * Get node creation templates
 * @returns {Array} Common node patterns/templates
 */
export const getNodeTemplates = () => {
  return [
    {
      id: 'simple-goal',
      name: 'Simple Goal',
      description: 'Single goal with strategy',
      nodes: [
        { type: 'goal', name: 'Main Goal' },
        { type: 'strategy', name: 'Decomposition Strategy', offsetY: 150 },
      ],
    },
    {
      id: 'evidence-chain',
      name: 'Evidence Chain',
      description: 'Claim with supporting evidence',
      nodes: [
        { type: 'propertyClaim', name: 'Property Claim' },
        { type: 'evidence', name: 'Supporting Evidence', offsetY: 150 },
      ],
    },
    {
      id: 'context-pattern',
      name: 'Context Pattern',
      description: 'Goal with context',
      nodes: [
        { type: 'goal', name: 'Goal' },
        { type: 'context', name: 'Context/Assumption', offsetX: 200 },
      ],
    },
  ];
};

/**
 * Storage keys for persistence
 */
export const STORAGE_KEYS = {
  RECENT_TYPES: 'tea_node_creation_recent_types',
  PREFERENCES: 'tea_node_creation_preferences',
};

/**
 * Save recent node types to local storage
 * @param {Array} recentTypes - Recent node types
 */
export const saveRecentTypes = (recentTypes) => {
  try {
    localStorage.setItem(STORAGE_KEYS.RECENT_TYPES, JSON.stringify(recentTypes));
  } catch (error) {
    console.warn('Failed to save recent node types:', error);
  }
};

/**
 * Load recent node types from local storage
 * @returns {Array} Recent node types
 */
export const loadRecentTypes = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TYPES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load recent node types:', error);
    return [];
  }
};

/**
 * Save creation preferences
 * @param {Object} preferences - User preferences
 */
export const saveCreationPreferences = (preferences) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save creation preferences:', error);
  }
};

/**
 * Load creation preferences
 * @returns {Object} User preferences
 */
export const loadCreationPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return stored
      ? JSON.parse(stored)
      : {
          gridSnap: true,
          autoConnect: false,
          quickCreateEnabled: true,
          defaultNodeType: 'goal',
        };
  } catch (error) {
    console.warn('Failed to load creation preferences:', error);
    return {
      gridSnap: true,
      autoConnect: false,
      quickCreateEnabled: true,
      defaultNodeType: 'goal',
    };
  }
};

/**
 * Debounce function for double-click detection
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default {
  generateNodeId,
  screenToFlowPosition,
  snapToGrid,
  calculateDistance,
  checkPositionOverlap,
  findNonOverlappingPosition,
  calculateSmartPosition,
  getDefaultNodeData,
  createNodeObject,
  getRecentNodeTypes,
  validateNodeCreation,
  calculateConnectionHints,
  getNodeTemplates,
  saveRecentTypes,
  loadRecentTypes,
  saveCreationPreferences,
  loadCreationPreferences,
  debounce,
};
