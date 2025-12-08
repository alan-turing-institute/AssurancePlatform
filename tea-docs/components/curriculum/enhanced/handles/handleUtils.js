/**
 * Handle Utilities
 *
 * Helper functions for React Flow handle components including position calculation,
 * connection validation, animation timing, state management, and style generation.
 *
 * @module handleUtils
 */

import { Position } from 'reactflow';

// ========================================================================
// Position Calculation Helpers
// ========================================================================

/**
 * Get CSS positioning classes based on handle position
 * @param {Position} position - React Flow position (Position.Top, Position.Bottom, etc.)
 * @returns {string} CSS classes for positioning
 */
export const getPositionClasses = (position) => {
  const positionMap = {
    [Position.Top]: '-top-6 left-1/2 -translate-x-1/2',
    [Position.Bottom]: '-bottom-6 left-1/2 -translate-x-1/2',
    [Position.Left]: 'left-0 -translate-x-1/2 top-1/2 -translate-y-1/2',
    [Position.Right]: 'right-0 translate-x-1/2 top-1/2 -translate-y-1/2',
  };

  return positionMap[position] || positionMap[Position.Bottom];
};

/**
 * Calculate absolute position coordinates for a handle
 * @param {Position} position - React Flow position
 * @param {object} nodeBounds - Node bounding box {x, y, width, height}
 * @param {number} offset - Offset distance from node edge
 * @returns {object} Absolute coordinates {x, y}
 */
export const calculateHandlePosition = (position, nodeBounds, offset = 24) => {
  const { x, y, width, height } = nodeBounds;

  switch (position) {
    case Position.Top:
      return { x: x + width / 2, y: y - offset };
    case Position.Bottom:
      return { x: x + width / 2, y: y + height + offset };
    case Position.Left:
      return { x: x - offset, y: y + height / 2 };
    case Position.Right:
      return { x: x + width + offset, y: y + height / 2 };
    default:
      return { x: x + width / 2, y: y + height + offset };
  }
};

/**
 * Check if two handles are overlapping
 * @param {object} pos1 - First handle position {x, y}
 * @param {object} pos2 - Second handle position {x, y}
 * @param {number} threshold - Distance threshold for overlap detection
 * @returns {boolean} True if overlapping
 */
export const areHandlesOverlapping = (pos1, pos2, threshold = 30) => {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < threshold;
};

/**
 * Adjust handle position to avoid overlaps
 * @param {object} handlePos - Current handle position {x, y}
 * @param {Array<object>} existingHandles - Array of existing handle positions
 * @param {number} minDistance - Minimum distance between handles
 * @returns {object} Adjusted position {x, y}
 */
export const adjustHandlePosition = (handlePos, existingHandles, minDistance = 40) => {
  let adjusted = { ...handlePos };
  let hasOverlap = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (hasOverlap && attempts < maxAttempts) {
    hasOverlap = false;

    for (const existing of existingHandles) {
      if (areHandlesOverlapping(adjusted, existing, minDistance)) {
        hasOverlap = true;
        // Shift position slightly
        adjusted.y += 15;
        break;
      }
    }

    attempts++;
  }

  return adjusted;
};

// ========================================================================
// Connection Validation Functions
// ========================================================================

/**
 * Validate if a connection is allowed between two nodes
 * @param {object} source - Source node data
 * @param {object} target - Target node data
 * @param {object} rules - Validation rules
 * @returns {object} Validation result {valid: boolean, reason: string}
 */
export const validateConnection = (source, target, rules = {}) => {
  // Prevent self-connection
  if (source.id === target.id) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }

  // Prevent duplicate connections
  if (rules.checkDuplicates && source.edges) {
    const isDuplicate = source.edges.some(
      edge => edge.target === target.id
    );
    if (isDuplicate) {
      return { valid: false, reason: 'Connection already exists' };
    }
  }

  // Check connection limit
  if (rules.maxConnections && source.connectionCount >= rules.maxConnections) {
    return { valid: false, reason: `Maximum ${rules.maxConnections} connections reached` };
  }

  // Check node type compatibility
  if (rules.allowedConnections) {
    const sourceType = source.type || 'default';
    const targetType = target.type || 'default';
    const allowed = rules.allowedConnections[sourceType];

    if (allowed && !allowed.includes(targetType)) {
      return { valid: false, reason: `${sourceType} cannot connect to ${targetType}` };
    }
  }

  return { valid: true, reason: '' };
};

/**
 * Check if node types are compatible for connection
 * @param {string} sourceType - Source node type
 * @param {string} targetType - Target node type
 * @returns {boolean} True if compatible
 */
export const areNodeTypesCompatible = (sourceType, targetType) => {
  // Assurance case node type compatibility rules
  const compatibilityRules = {
    goal: ['strategy', 'context'],
    strategy: ['goal', 'propertyClaim', 'evidence'],
    propertyClaim: ['evidence', 'strategy'],
    evidence: [], // Evidence nodes are typically leaf nodes
    context: [], // Context nodes don't have outgoing connections
  };

  const normalizedSource = sourceType?.toLowerCase().replace(/[-_\s]/g, '');
  const normalizedTarget = targetType?.toLowerCase().replace(/[-_\s]/g, '');

  const allowed = compatibilityRules[normalizedSource] || [];
  return allowed.includes(normalizedTarget);
};

/**
 * Get connection validation message
 * @param {object} source - Source node
 * @param {object} target - Target node
 * @returns {string} Validation message
 */
export const getConnectionHint = (source, target) => {
  const validation = validateConnection(source, target);

  if (validation.valid) {
    return `Connect ${source.data?.name || 'node'} to ${target.data?.name || 'node'}`;
  }

  return validation.reason;
};

// ========================================================================
// Animation Timing Utilities
// ========================================================================

/**
 * Debounce function for rapid state changes
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 100) => {
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

/**
 * Throttle function for animation frame optimization
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit = 16) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Request animation frame with fallback
 * @param {Function} callback - Animation callback
 * @returns {number} Animation frame ID
 */
export const requestAnimFrame = (callback) => {
  return (
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    }
  )(callback);
};

/**
 * Get optimal animation duration based on distance
 * @param {number} distance - Distance to travel
 * @param {number} baseSpeed - Base speed in pixels per millisecond
 * @returns {number} Animation duration in milliseconds
 */
export const calculateAnimationDuration = (distance, baseSpeed = 0.5) => {
  const minDuration = 200;
  const maxDuration = 800;
  const duration = distance / baseSpeed;
  return Math.max(minDuration, Math.min(maxDuration, duration));
};

// ========================================================================
// State Management Helpers
// ========================================================================

/**
 * Get connection count for a node
 * @param {string} nodeId - Node identifier
 * @param {Array} edges - Array of edges
 * @param {string} handleType - 'source' or 'target'
 * @returns {number} Connection count
 */
export const getConnectionCount = (nodeId, edges, handleType = 'source') => {
  if (!edges || !nodeId) return 0;

  return edges.filter(edge => {
    if (handleType === 'source') {
      return edge.source === nodeId;
    }
    return edge.target === nodeId;
  }).length;
};

/**
 * Check if handle is connected
 * @param {string} nodeId - Node identifier
 * @param {string} handleId - Handle identifier
 * @param {Array} edges - Array of edges
 * @param {string} handleType - 'source' or 'target'
 * @returns {boolean} True if connected
 */
export const isHandleConnected = (nodeId, handleId, edges, handleType = 'source') => {
  if (!edges || !nodeId) return false;

  return edges.some(edge => {
    if (handleType === 'source') {
      return edge.source === nodeId && (!handleId || edge.sourceHandle === handleId);
    }
    return edge.target === nodeId && (!handleId || edge.targetHandle === handleId);
  });
};

/**
 * Get all edges connected to a handle
 * @param {string} nodeId - Node identifier
 * @param {string} handleId - Handle identifier (optional)
 * @param {Array} edges - Array of edges
 * @param {string} handleType - 'source' or 'target'
 * @returns {Array} Connected edges
 */
export const getConnectedEdges = (nodeId, handleId, edges, handleType = 'source') => {
  if (!edges || !nodeId) return [];

  return edges.filter(edge => {
    if (handleType === 'source') {
      return edge.source === nodeId && (!handleId || edge.sourceHandle === handleId);
    }
    return edge.target === nodeId && (!handleId || edge.targetHandle === handleId);
  });
};

/**
 * Calculate connection limit percentage
 * @param {number} currentCount - Current connection count
 * @param {number} maxCount - Maximum allowed connections
 * @returns {number} Percentage (0-100)
 */
export const getConnectionPercentage = (currentCount, maxCount) => {
  if (maxCount === 0 || maxCount === Infinity) return 0;
  return Math.min(100, (currentCount / maxCount) * 100);
};

// ========================================================================
// Style Generation Functions
// ========================================================================

/**
 * Generate handle color based on connection state
 * @param {boolean} isConnected - Whether handle is connected
 * @param {boolean} isValid - Whether pending connection is valid
 * @param {boolean} isHovered - Whether handle is hovered
 * @returns {object} Color configuration
 */
export const getHandleColors = (isConnected, isValid, isHovered) => {
  if (isConnected) {
    return {
      bg: 'bg-blue-500',
      border: 'border-blue-400',
      icon: 'text-white',
      ring: 'ring-blue-500/50',
    };
  }

  if (isValid === false) {
    return {
      bg: 'bg-red-500',
      border: 'border-red-400',
      icon: 'text-white',
      ring: 'ring-red-500/50',
    };
  }

  if (isValid === true) {
    return {
      bg: 'bg-green-500',
      border: 'border-green-400',
      icon: 'text-white',
      ring: 'ring-green-500/50',
    };
  }

  // Default state
  return {
    bg: isHovered ? 'bg-white' : 'bg-white',
    border: isHovered ? 'border-gray-400' : 'border-gray-300',
    icon: 'text-gray-700',
    ring: 'ring-gray-500/50',
  };
};

/**
 * Generate handle size classes based on variant
 * @param {string} size - Size variant ('small', 'medium', 'large')
 * @returns {object} Size classes
 */
export const getHandleSizeClasses = (size = 'medium') => {
  const sizeMap = {
    small: {
      outer: 'w-8 h-8',
      inner: 'w-6 h-6',
      icon: 'w-3 h-3',
      offset: 'top-4',
    },
    medium: {
      outer: 'w-12 h-12',
      inner: 'w-8 h-8',
      icon: 'w-4 h-4',
      offset: 'top-6',
    },
    large: {
      outer: 'w-16 h-16',
      inner: 'w-12 h-12',
      icon: 'w-6 h-6',
      offset: 'top-8',
    },
  };

  return sizeMap[size] || sizeMap.medium;
};

/**
 * Generate handle shape classes
 * @param {string} shape - Shape variant ('circle', 'square', 'diamond')
 * @returns {string} Shape classes
 */
export const getHandleShapeClasses = (shape = 'circle') => {
  const shapeMap = {
    circle: 'rounded-full',
    square: 'rounded-md',
    diamond: 'rounded-sm rotate-45',
  };

  return shapeMap[shape] || shapeMap.circle;
};

/**
 * Generate gradient background classes
 * @param {string} type - Gradient type ('blue', 'green', 'purple', etc.)
 * @returns {string} Gradient classes
 */
export const getGradientClasses = (type = 'default') => {
  const gradientMap = {
    default: 'bg-gradient-to-br from-gray-200 to-gray-300',
    blue: 'bg-gradient-to-br from-blue-400 to-blue-600',
    green: 'bg-gradient-to-br from-green-400 to-green-600',
    purple: 'bg-gradient-to-br from-purple-400 to-purple-600',
    orange: 'bg-gradient-to-br from-orange-400 to-orange-600',
    cyan: 'bg-gradient-to-br from-cyan-400 to-cyan-600',
  };

  return gradientMap[type] || gradientMap.default;
};

/**
 * Generate shadow classes based on intensity
 * @param {string} intensity - Shadow intensity ('subtle', 'medium', 'strong')
 * @returns {string} Shadow classes
 */
export const getShadowClasses = (intensity = 'medium') => {
  const shadowMap = {
    subtle: 'shadow-sm',
    medium: 'shadow-md',
    strong: 'shadow-lg',
  };

  return shadowMap[intensity] || shadowMap.medium;
};

// ========================================================================
// Export All Utilities
// ========================================================================

export default {
  // Position helpers
  getPositionClasses,
  calculateHandlePosition,
  areHandlesOverlapping,
  adjustHandlePosition,

  // Connection validation
  validateConnection,
  areNodeTypesCompatible,
  getConnectionHint,

  // Animation timing
  debounce,
  throttle,
  requestAnimFrame,
  calculateAnimationDuration,

  // State management
  getConnectionCount,
  isHandleConnected,
  getConnectedEdges,
  getConnectionPercentage,

  // Style generation
  getHandleColors,
  getHandleSizeClasses,
  getHandleShapeClasses,
  getGradientClasses,
  getShadowClasses,
};
