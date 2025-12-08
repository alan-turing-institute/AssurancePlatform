/**
 * Enhanced Handles - Export Index
 *
 * Central export point for all enhanced handle components.
 * Provides easy access to all handle types and their variants.
 *
 * @module handles
 */

// CustomHandle and variants
export {
  default as CustomHandle,
  CustomHandleWithIndicator,
  PulsingHandle,
  CustomHandleWithTooltip,
} from './CustomHandle';

// AnimatedHandle and variants
export {
  default as AnimatedHandle,
  PulseHandle,
  GlowHandle,
  SpringHandle,
  BreatheHandle,
  ParticleHandle,
} from './AnimatedHandle';

// SmartHandle and variants
export {
  default as SmartHandle,
  AutoHideHandle,
  HoverShowHandle,
  AndGateHandle,
  OrGateHandle,
  SmartPositionHandle,
} from './SmartHandle';

// MultiHandle and variants
export {
  default as MultiHandle,
  FanOutHandle,
  StackedHandle,
  GroupedHandle,
  LimitedMultiHandle,
} from './MultiHandle';

// ConditionalHandle and variants
export {
  default as ConditionalHandle,
  ApprovedHandle,
  LockedHandle,
  ErrorHandle,
  PendingHandle,
  DependencyHandle,
  ConditionalVisibilityHandle,
} from './ConditionalHandle';

// Utilities
export * from './handleUtils';

// Default export with all components
export default {
  CustomHandle: require('./CustomHandle').default,
  CustomHandleWithIndicator: require('./CustomHandle').CustomHandleWithIndicator,
  PulsingHandle: require('./CustomHandle').PulsingHandle,
  CustomHandleWithTooltip: require('./CustomHandle').CustomHandleWithTooltip,

  AnimatedHandle: require('./AnimatedHandle').default,
  PulseHandle: require('./AnimatedHandle').PulseHandle,
  GlowHandle: require('./AnimatedHandle').GlowHandle,
  SpringHandle: require('./AnimatedHandle').SpringHandle,
  BreatheHandle: require('./AnimatedHandle').BreatheHandle,
  ParticleHandle: require('./AnimatedHandle').ParticleHandle,

  SmartHandle: require('./SmartHandle').default,
  AutoHideHandle: require('./SmartHandle').AutoHideHandle,
  HoverShowHandle: require('./SmartHandle').HoverShowHandle,
  AndGateHandle: require('./SmartHandle').AndGateHandle,
  OrGateHandle: require('./SmartHandle').OrGateHandle,
  SmartPositionHandle: require('./SmartHandle').SmartPositionHandle,

  MultiHandle: require('./MultiHandle').default,
  FanOutHandle: require('./MultiHandle').FanOutHandle,
  StackedHandle: require('./MultiHandle').StackedHandle,
  GroupedHandle: require('./MultiHandle').GroupedHandle,
  LimitedMultiHandle: require('./MultiHandle').LimitedMultiHandle,

  ConditionalHandle: require('./ConditionalHandle').default,
  ApprovedHandle: require('./ConditionalHandle').ApprovedHandle,
  LockedHandle: require('./ConditionalHandle').LockedHandle,
  ErrorHandle: require('./ConditionalHandle').ErrorHandle,
  PendingHandle: require('./ConditionalHandle').PendingHandle,
  DependencyHandle: require('./ConditionalHandle').DependencyHandle,
  ConditionalVisibilityHandle: require('./ConditionalHandle').ConditionalVisibilityHandle,
};
