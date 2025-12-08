/**
 * Enhanced Edges - Export Index
 *
 * Central export point for all enhanced edge components.
 * Provides easy access to all edge types and their variants.
 *
 * @module edges
 */

// AnimatedEdge and variants
export {
  default as AnimatedEdge,
  FastAnimatedEdge,
  SlowAnimatedEdge,
  PulseAnimatedEdge,
  GlowAnimatedEdge,
  ThicknessAnimatedEdge,
} from './AnimatedEdge';

// GradientEdge and variants
export {
  default as GradientEdge,
  RainbowGradientEdge,
  PulsingGradientEdge,
  RadialGradientEdge,
  ShimmerGradientEdge,
  TemperatureGradientEdge,
} from './GradientEdge';

// GlowingEdge and variants
export {
  default as GlowingEdge,
  NeonEdge,
  SoftGlowEdge,
  IntenseGlowEdge,
  ActiveDataFlowEdge,
  ErrorGlowEdge,
  SuccessGlowEdge,
  WarningGlowEdge,
  BreathingGlowEdge,
} from './GlowingEdge';

// FlowingEdge and variants
export {
  default as FlowingEdge,
  FastFlowEdge,
  SlowFlowEdge,
  HeavyTrafficEdge,
  LightTrafficEdge,
  BidirectionalFlowEdge,
  DataStreamEdge,
  PulseFlowEdge,
  TrailFlowEdge,
} from './FlowingEdge';

// SmartEdge and variants
export {
  default as SmartEdge,
  StrongConnectionEdge,
  WeakConnectionEdge,
  TypedSmartEdge,
  DependencyEdge,
  InheritanceEdge,
  AssociationEdge,
  AdaptivePathEdge,
  InfoEdge,
  ActivityEdge,
} from './SmartEdge';

// Utilities
export * from './edgeUtils';

/**
 * Edge type definitions for React Flow
 * Use this object to register edge types with React Flow
 *
 * @example
 * ```jsx
 * import { edgeTypes } from './edges';
 *
 * <ReactFlow
 *   edges={edges}
 *   edgeTypes={edgeTypes}
 * />
 * ```
 */
export const edgeTypes = {
  // Animated edges
  animated: require('./AnimatedEdge').default,
  fastAnimated: require('./AnimatedEdge').FastAnimatedEdge,
  slowAnimated: require('./AnimatedEdge').SlowAnimatedEdge,
  pulseAnimated: require('./AnimatedEdge').PulseAnimatedEdge,
  glowAnimated: require('./AnimatedEdge').GlowAnimatedEdge,
  thicknessAnimated: require('./AnimatedEdge').ThicknessAnimatedEdge,

  // Gradient edges
  gradient: require('./GradientEdge').default,
  rainbowGradient: require('./GradientEdge').RainbowGradientEdge,
  pulsingGradient: require('./GradientEdge').PulsingGradientEdge,
  radialGradient: require('./GradientEdge').RadialGradientEdge,
  shimmerGradient: require('./GradientEdge').ShimmerGradientEdge,
  temperatureGradient: require('./GradientEdge').TemperatureGradientEdge,

  // Glowing edges
  glowing: require('./GlowingEdge').default,
  neon: require('./GlowingEdge').NeonEdge,
  softGlow: require('./GlowingEdge').SoftGlowEdge,
  intenseGlow: require('./GlowingEdge').IntenseGlowEdge,
  activeDataFlow: require('./GlowingEdge').ActiveDataFlowEdge,
  errorGlow: require('./GlowingEdge').ErrorGlowEdge,
  successGlow: require('./GlowingEdge').SuccessGlowEdge,
  warningGlow: require('./GlowingEdge').WarningGlowEdge,
  breathingGlow: require('./GlowingEdge').BreathingGlowEdge,

  // Flowing edges
  flowing: require('./FlowingEdge').default,
  fastFlow: require('./FlowingEdge').FastFlowEdge,
  slowFlow: require('./FlowingEdge').SlowFlowEdge,
  heavyTraffic: require('./FlowingEdge').HeavyTrafficEdge,
  lightTraffic: require('./FlowingEdge').LightTrafficEdge,
  bidirectionalFlow: require('./FlowingEdge').BidirectionalFlowEdge,
  dataStream: require('./FlowingEdge').DataStreamEdge,
  pulseFlow: require('./FlowingEdge').PulseFlowEdge,
  trailFlow: require('./FlowingEdge').TrailFlowEdge,

  // Smart edges
  smart: require('./SmartEdge').default,
  strongConnection: require('./SmartEdge').StrongConnectionEdge,
  weakConnection: require('./SmartEdge').WeakConnectionEdge,
  typedSmart: require('./SmartEdge').TypedSmartEdge,
  dependency: require('./SmartEdge').DependencyEdge,
  inheritance: require('./SmartEdge').InheritanceEdge,
  association: require('./SmartEdge').AssociationEdge,
  adaptivePath: require('./SmartEdge').AdaptivePathEdge,
  info: require('./SmartEdge').InfoEdge,
  activity: require('./SmartEdge').ActivityEdge,
};

/**
 * Default edge options for React Flow
 * Provides sensible defaults for all edge types
 */
export const defaultEdgeOptions = {
  animated: true,
  type: 'smart',
  style: {
    strokeWidth: 2,
  },
  data: {
    showLabel: true,
    strength: 0.7,
  },
};

/**
 * Edge style presets
 * Common configurations for different use cases
 */
export const edgeStylePresets = {
  // Default modern style
  modern: {
    type: 'smart',
    animated: true,
    data: {
      showStrengthIndicator: true,
      pathType: 'auto',
    },
  },

  // High-traffic data flow
  dataFlow: {
    type: 'flowing',
    data: {
      particleCount: 5,
      flowSpeed: 1.2,
      showDirectionIndicators: true,
    },
  },

  // Elegant gradient
  elegant: {
    type: 'gradient',
    data: {
      gradientStops: 3,
      animateGradient: true,
      strokeWidth: 3,
    },
  },

  // Neon cyberpunk style
  neon: {
    type: 'neon',
    data: {
      glowIntensity: 1.5,
      pulse: true,
      strokeWidth: 2,
    },
  },

  // Minimal clean style
  minimal: {
    type: 'animated',
    data: {
      animated: false,
      strokeWidth: 1.5,
      showLabel: false,
    },
  },

  // Active connection
  active: {
    type: 'activeDataFlow',
    data: {
      glowIntensity: 1.5,
      pulse: true,
      flowIntensity: 1,
    },
  },

  // Error state
  error: {
    type: 'errorGlow',
    data: {
      state: 'error',
      pulse: true,
    },
  },

  // Success state
  success: {
    type: 'successGlow',
    data: {
      state: 'success',
      pulse: false,
    },
  },

  // Strong relationship
  strong: {
    type: 'strongConnection',
    data: {
      strength: 1,
      strokeWidth: 3,
      showStrengthIndicator: true,
    },
  },

  // Weak relationship
  weak: {
    type: 'weakConnection',
    data: {
      strength: 0.3,
      strokeWidth: 1.5,
      showStrengthIndicator: true,
    },
  },
};

/**
 * Helper function to apply edge preset
 * @param {Object} edge - Base edge object
 * @param {string} presetName - Name of preset to apply
 * @returns {Object} Edge with preset applied
 */
export function applyEdgePreset(edge, presetName) {
  const preset = edgeStylePresets[presetName];
  if (!preset) {
    console.warn(`Edge preset "${presetName}" not found`);
    return edge;
  }

  return {
    ...edge,
    type: preset.type,
    animated: preset.animated,
    data: {
      ...edge.data,
      ...preset.data,
    },
  };
}

/**
 * Helper function to create edge with type
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 * @param {string} type - Edge type
 * @param {Object} data - Additional edge data
 * @returns {Object} Edge object
 */
export function createEdge(source, target, type = 'smart', data = {}) {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type,
    data,
  };
}

/**
 * Helper function to create edges from node connections
 * @param {Array} connections - Array of {source, target, type?, data?}
 * @returns {Array} Array of edge objects
 */
export function createEdges(connections) {
  return connections.map(({ source, target, type = 'smart', data = {} }) =>
    createEdge(source, target, type, data)
  );
}

/**
 * Default export with all edge types organized
 */
export default {
  // Component exports
  AnimatedEdge: require('./AnimatedEdge').default,
  GradientEdge: require('./GradientEdge').default,
  GlowingEdge: require('./GlowingEdge').default,
  FlowingEdge: require('./FlowingEdge').default,
  SmartEdge: require('./SmartEdge').default,

  // Utilities
  utils: require('./edgeUtils').default,

  // Type definitions
  edgeTypes,
  defaultEdgeOptions,
  edgeStylePresets,

  // Helper functions
  applyEdgePreset,
  createEdge,
  createEdges,
};
