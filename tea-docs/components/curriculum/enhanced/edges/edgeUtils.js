/**
 * Edge Utilities
 *
 * Comprehensive utility functions for React Flow custom edges including
 * path calculation, gradient generation, animation helpers, label positioning,
 * and color interpolation.
 *
 * @module edgeUtils
 */

/**
 * Path Calculation Helpers
 */

/**
 * Calculate bezier curve path for smooth connections
 * @param {Object} source - Source position {x, y}
 * @param {Object} target - Target position {x, y}
 * @param {number} curvature - Curve intensity (0-1)
 * @returns {string} SVG path string
 */
export function calculateBezierPath(source, target, curvature = 0.5) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Control point offset based on distance and curvature
  const controlOffset = Math.max(Math.abs(dx), Math.abs(dy)) * curvature;

  return `M ${source.x},${source.y} C ${source.x + controlOffset},${source.y} ${target.x - controlOffset},${target.y} ${target.x},${target.y}`;
}

/**
 * Calculate smooth step path with rounded corners
 * @param {Object} source - Source position {x, y}
 * @param {Object} target - Target position {x, y}
 * @param {number} cornerRadius - Radius of corners
 * @returns {string} SVG path string
 */
export function calculateSmoothStepPath(source, target, cornerRadius = 10) {
  const midX = (source.x + target.x) / 2;

  return `M ${source.x},${source.y} L ${midX - cornerRadius},${source.y} Q ${midX},${source.y} ${midX},${source.y + cornerRadius} L ${midX},${target.y - cornerRadius} Q ${midX},${target.y} ${midX + cornerRadius},${target.y} L ${target.x},${target.y}`;
}

/**
 * Calculate straight path with optional offset
 * @param {Object} source - Source position {x, y}
 * @param {Object} target - Target position {x, y}
 * @param {number} offset - Perpendicular offset for parallel edges
 * @returns {string} SVG path string
 */
export function calculateStraightPath(source, target, offset = 0) {
  if (offset === 0) {
    return `M ${source.x},${source.y} L ${target.x},${target.y}`;
  }

  // Calculate perpendicular offset
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const perpAngle = angle + Math.PI / 2;

  const offsetX = Math.cos(perpAngle) * offset;
  const offsetY = Math.sin(perpAngle) * offset;

  return `M ${source.x + offsetX},${source.y + offsetY} L ${target.x + offsetX},${target.y + offsetY}`;
}

/**
 * Get path length for animations
 * @param {string} pathString - SVG path string
 * @returns {number} Path length
 */
export function getPathLength(pathString) {
  if (typeof document === 'undefined') return 0;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathString);
  svg.appendChild(path);

  return path.getTotalLength();
}

/**
 * Gradient Generation Functions
 */

/**
 * Generate gradient ID for edge
 * @param {string} edgeId - Edge identifier
 * @returns {string} Unique gradient ID
 */
export function generateGradientId(edgeId) {
  return `edge-gradient-${edgeId}`;
}

/**
 * Create gradient stops from colors
 * @param {Array} colors - Array of color strings
 * @param {Array} positions - Optional array of positions (0-1)
 * @returns {Array} Gradient stop objects
 */
export function createGradientStops(colors, positions = null) {
  if (!positions) {
    positions = colors.map((_, i) => i / (colors.length - 1));
  }

  return colors.map((color, i) => ({
    offset: `${positions[i] * 100}%`,
    stopColor: color,
    stopOpacity: 1,
  }));
}

/**
 * Generate gradient based on node colors
 * @param {string} sourceColor - Source node color
 * @param {string} targetColor - Target node color
 * @param {number} steps - Number of intermediate steps
 * @returns {Array} Array of gradient colors
 */
export function interpolateGradient(sourceColor, targetColor, steps = 3) {
  const source = hexToRgb(sourceColor);
  const target = hexToRgb(targetColor);

  if (!source || !target) return [sourceColor, targetColor];

  const colors = [];
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const r = Math.round(source.r + (target.r - source.r) * ratio);
    const g = Math.round(source.g + (target.g - source.g) * ratio);
    const b = Math.round(source.b + (target.b - source.b) * ratio);
    colors.push(rgbToHex(r, g, b));
  }

  return colors;
}

/**
 * Animation Timing Utilities
 */

/**
 * Animation presets for different edge behaviors
 */
export const animationPresets = {
  fast: {
    duration: 0.3,
    ease: 'easeInOut',
  },
  normal: {
    duration: 0.6,
    ease: 'easeInOut',
  },
  slow: {
    duration: 1.2,
    ease: 'easeInOut',
  },
  bounce: {
    duration: 0.8,
    ease: [0.68, -0.55, 0.265, 1.55],
  },
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
  },
};

/**
 * Create dash array for animated edges
 * @param {number} pathLength - Total path length
 * @param {number} dashCount - Number of dashes
 * @returns {string} Dash array string
 */
export function createDashArray(pathLength, dashCount = 10) {
  const dashLength = pathLength / dashCount / 2;
  return `${dashLength} ${dashLength}`;
}

/**
 * Get animation keyframes for flowing effect
 * @param {number} speed - Animation speed multiplier
 * @returns {Object} Framer Motion animation object
 */
export function getFlowAnimation(speed = 1) {
  return {
    strokeDashoffset: [0, -20],
    transition: {
      duration: 1 / speed,
      repeat: Infinity,
      ease: 'linear',
    },
  };
}

/**
 * Label Positioning Algorithms
 */

/**
 * Calculate label position on edge
 * @param {Object} source - Source position {x, y}
 * @param {Object} target - Target position {x, y}
 * @param {number} position - Position along edge (0-1)
 * @returns {Object} Label position and angle {x, y, angle}
 */
export function calculateLabelPosition(source, target, position = 0.5) {
  const x = source.x + (target.x - source.x) * position;
  const y = source.y + (target.y - source.y) * position;
  const angle = Math.atan2(target.y - source.y, target.x - source.x) * (180 / Math.PI);

  return { x, y, angle };
}

/**
 * Calculate label position on bezier curve
 * @param {Object} source - Source position {x, y}
 * @param {Object} target - Target position {x, y}
 * @param {number} curvature - Curve intensity
 * @param {number} t - Position along curve (0-1)
 * @returns {Object} Label position {x, y}
 */
export function calculateBezierLabelPosition(source, target, curvature = 0.5, t = 0.5) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const controlOffset = Math.max(Math.abs(dx), Math.abs(dy)) * curvature;

  const p0 = source;
  const p1 = { x: source.x + controlOffset, y: source.y };
  const p2 = { x: target.x - controlOffset, y: target.y };
  const p3 = target;

  // Cubic bezier formula
  const x = Math.pow(1 - t, 3) * p0.x +
            3 * Math.pow(1 - t, 2) * t * p1.x +
            3 * (1 - t) * Math.pow(t, 2) * p2.x +
            Math.pow(t, 3) * p3.x;

  const y = Math.pow(1 - t, 3) * p0.y +
            3 * Math.pow(1 - t, 2) * t * p1.y +
            3 * (1 - t) * Math.pow(t, 2) * p2.y +
            Math.pow(t, 3) * p3.y;

  return { x, y };
}

/**
 * Edge Validation Functions
 */

/**
 * Check if edge connection is valid
 * @param {Object} edge - Edge data
 * @param {Array} nodes - Array of nodes
 * @returns {boolean} Whether edge is valid
 */
export function validateEdge(edge, nodes) {
  if (!edge.source || !edge.target) return false;

  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  return !!(sourceNode && targetNode);
}

/**
 * Check for edge overlap with nodes
 * @param {string} pathString - SVG path string
 * @param {Array} nodes - Array of nodes to check
 * @param {Object} exclude - Nodes to exclude {source, target}
 * @returns {boolean} Whether path overlaps with nodes
 */
export function checkPathOverlap(pathString, nodes, exclude = {}) {
  // Simplified overlap detection
  // In production, would use more sophisticated geometry checks
  return false; // Placeholder
}

/**
 * Color Interpolation
 */

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color string
 * @returns {Object|null} RGB object {r, g, b}
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Convert RGB to hex
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Interpolate between two colors
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @param {number} ratio - Interpolation ratio (0-1)
 * @returns {string} Interpolated color (hex)
 */
export function interpolateColor(color1, color2, ratio) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);

  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

  return rgbToHex(r, g, b);
}

/**
 * Get color based on edge state
 * @param {string} state - Edge state (active, inactive, error, success, warning)
 * @returns {string} Color for state
 */
export function getStateColor(state) {
  const stateColors = {
    active: '#3b82f6',     // blue-500
    inactive: '#6b7280',   // gray-500
    error: '#ef4444',      // red-500
    success: '#10b981',    // green-500
    warning: '#f59e0b',    // amber-500
    default: '#8b5cf6',    // purple-500
  };

  return stateColors[state] || stateColors.default;
}

/**
 * Edge Styling Helpers
 */

/**
 * Get stroke width based on state
 * @param {boolean} isHovered - Whether edge is hovered
 * @param {boolean} isSelected - Whether edge is selected
 * @param {number} baseWidth - Base stroke width
 * @returns {number} Calculated stroke width
 */
export function getStrokeWidth(isHovered, isSelected, baseWidth = 2) {
  if (isSelected) return baseWidth * 2;
  if (isHovered) return baseWidth * 1.5;
  return baseWidth;
}

/**
 * Get marker end configuration
 * @param {string} markerId - Marker ID
 * @param {string} color - Marker color
 * @returns {string} Marker URL
 */
export function getMarkerEnd(markerId, color) {
  return `url(#${markerId})`;
}

/**
 * Create arrow marker element
 * @param {string} id - Marker ID
 * @param {string} color - Arrow color
 * @returns {Object} Marker configuration
 */
export function createArrowMarker(id, color = '#999') {
  return {
    id,
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 6,
    markerHeight: 6,
    orient: 'auto-start-reverse',
    path: 'M 0 0 L 10 5 L 0 10 z',
    fill: color,
  };
}

/**
 * Performance Utilities
 */

/**
 * Debounce function for edge updates
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for animations
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Default export with all utilities
 */
export default {
  // Path calculations
  calculateBezierPath,
  calculateSmoothStepPath,
  calculateStraightPath,
  getPathLength,

  // Gradients
  generateGradientId,
  createGradientStops,
  interpolateGradient,

  // Animations
  animationPresets,
  createDashArray,
  getFlowAnimation,

  // Labels
  calculateLabelPosition,
  calculateBezierLabelPosition,

  // Validation
  validateEdge,
  checkPathOverlap,

  // Colors
  hexToRgb,
  rgbToHex,
  interpolateColor,
  getStateColor,

  // Styling
  getStrokeWidth,
  getMarkerEnd,
  createArrowMarker,

  // Performance
  debounce,
  throttle,
};
