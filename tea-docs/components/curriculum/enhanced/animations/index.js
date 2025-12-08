/**
 * Animation System Index
 *
 * Central export point for all animation components and utilities.
 * Provides a comprehensive animation system for React Flow enhanced components.
 *
 * @module animations
 */

// ========================================================================
// Core Components
// ========================================================================

export { AnimationProvider, useAnimation, useAnimationPerformance, useAnimationPreferences } from './AnimationProvider';

// ========================================================================
// Animation Presets
// ========================================================================

export {
  TIMING,
  EASING,
  SPRING,
  ENTRY_ANIMATIONS,
  EXIT_ANIMATIONS,
  INTERACTION_ANIMATIONS,
  LOADING_ANIMATIONS,
  COLLAPSE_ANIMATIONS,
  STAGGER_ANIMATIONS,
  EDGE_ANIMATIONS,
  HANDLE_ANIMATIONS,
  NOTIFICATION_ANIMATIONS,
  MODAL_ANIMATIONS,
  PERFORMANCE,
  PRESETS,
  getPreset,
  createCustomPreset,
  mergePresets,
} from './animationPresets';

// ========================================================================
// Spring Animations
// ========================================================================

export {
  SpringStaggerContainer,
  SpringStaggerItem,
  SpringScale,
  SpringRotate,
  SpringDraggable,
  SpringScrollTrigger,
  SpringParallax,
  SpringVelocity,
  SpringChain,
  SpringGesture,
  SpringMagnetic,
  SpringInertia,
  SpringKeyframes,
} from './SpringAnimations';

// ========================================================================
// Loading States
// ========================================================================

export {
  Skeleton,
  NodeSkeleton,
  Spinner,
  DotsLoader,
  ProgressBar,
  CircularProgress,
  PulseLoader,
  ShimmerContainer,
  ContentReveal,
  Placeholder,
  CardSkeleton,
  LoadingOverlay,
} from './LoadingStates';

// ========================================================================
// Micro Interactions
// ========================================================================

export {
  InteractiveButton,
  RippleEffect,
  AnimatedFocusRing,
  FeedbackToast,
  SuccessCheckmark,
  AnimatedCounter,
  RotatingIcon,
  BounceIcon,
  Shake,
  Wiggle,
  AnimatedTooltip,
  BadgePulse,
} from './MicroInteractions';

// ========================================================================
// Transition Effects
// ========================================================================

export {
  PageTransition,
  ModalTransition,
  TabTransition,
  AccordionTransition,
  CrossfadeTransition,
  SlideTransition,
  MorphTransition,
  CollapseTransition,
  DrawerTransition,
  FadeThroughTransition,
} from './TransitionEffects';

// ========================================================================
// Default Export
// ========================================================================

import AnimationProvider from './AnimationProvider';
import SpringAnimations from './SpringAnimations';
import LoadingStates from './LoadingStates';
import MicroInteractions from './MicroInteractions';
import TransitionEffects from './TransitionEffects';
import animationPresets from './animationPresets';

export default {
  // Provider
  AnimationProvider,

  // Components
  SpringAnimations,
  LoadingStates,
  MicroInteractions,
  TransitionEffects,

  // Presets
  animationPresets,
};
