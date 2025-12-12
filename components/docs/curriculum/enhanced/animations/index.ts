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

export {
	AnimationProvider,
	useAnimation,
	useAnimationPerformance,
	useAnimationPreferences,
} from "./animation-provider";

// ========================================================================
// Animation Presets
// ========================================================================

export {
	COLLAPSE_ANIMATIONS,
	createCustomPreset,
	EASING,
	EDGE_ANIMATIONS,
	ENTRY_ANIMATIONS,
	EXIT_ANIMATIONS,
	getPreset,
	HANDLE_ANIMATIONS,
	INTERACTION_ANIMATIONS,
	LOADING_ANIMATIONS,
	MODAL_ANIMATIONS,
	mergePresets,
	NOTIFICATION_ANIMATIONS,
	PERFORMANCE,
	PRESETS,
	SPRING,
	STAGGER_ANIMATIONS,
	TIMING,
} from "./animation-presets";

// ========================================================================
// Spring Animations
// ========================================================================

export {
	SpringChain,
	SpringDraggable,
	SpringGesture,
	SpringInertia,
	SpringKeyframes,
	SpringMagnetic,
	SpringParallax,
	SpringRotate,
	SpringScale,
	SpringScrollTrigger,
	SpringStaggerContainer,
	SpringStaggerItem,
	SpringVelocity,
} from "./spring-animations";

// ========================================================================
// Loading States
// ========================================================================

export {
	CardSkeleton,
	CircularProgress,
	ContentReveal,
	DotsLoader,
	LoadingOverlay,
	NodeSkeleton,
	Placeholder,
	ProgressBar,
	PulseLoader,
	ShimmerContainer,
	Skeleton,
	Spinner,
} from "./loading-states";

// ========================================================================
// Micro Interactions
// ========================================================================

export {
	AnimatedCounter,
	AnimatedFocusRing,
	AnimatedTooltip,
	BadgePulse,
	BounceIcon,
	FeedbackToast,
	InteractiveButton,
	RippleEffect,
	RotatingIcon,
	Shake,
	SuccessCheckmark,
	Wiggle,
} from "./micro-interactions";

// ========================================================================
// Transition Effects
// ========================================================================

export {
	AccordionTransition,
	CollapseTransition,
	CrossfadeTransition,
	DrawerTransition,
	FadeThroughTransition,
	ModalTransition,
	MorphTransition,
	PageTransition,
	SlideTransition,
	TabTransition,
} from "./transition-effects";

// ========================================================================
// Default Export
// ========================================================================

import animationPresets from "./animation-presets";
import AnimationProvider from "./animation-provider";
import LoadingStates from "./loading-states";
import MicroInteractions from "./micro-interactions";
import SpringAnimations from "./spring-animations";
import TransitionEffects from "./transition-effects";

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
