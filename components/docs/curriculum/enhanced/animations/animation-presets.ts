"use client";
/**
 * Animation Presets
 *
 * Comprehensive animation preset library for React Flow enhanced components.
 * Provides consistent timing, easing, and spring configurations.
 *
 * @module animationPresets
 */

// ========================================================================
// Type Definitions
// ========================================================================

type EasingValue = string | number[];

type SpringConfig = {
	type: "spring";
	stiffness: number;
	damping: number;
	mass: number;
};

type TransitionConfig = {
	duration?: number;
	ease?: EasingValue;
	type?: string;
	stiffness?: number;
	damping?: number;
	mass?: number;
	repeat?: number;
	delay?: number;
	height?: { duration: number; ease: EasingValue };
	opacity?: { duration: number; ease: EasingValue; delay?: number };
};

type AnimationPreset = {
	initial?: Record<string, unknown>;
	animate?: Record<string, unknown>;
	exit?: Record<string, unknown>;
	transition?: TransitionConfig | SpringConfig;
};

// biome-ignore lint/suspicious/noExplicitAny: Animation presets used with framer-motion
type InteractionPreset = Record<string, any>;

// Using generic Record type for flexibility with framer-motion's animate prop
// biome-ignore lint/suspicious/noExplicitAny: Animation presets are used with framer-motion's animate prop
type LoadingPreset = Record<string, any>;

type CollapseVariants = {
	collapsed: Record<string, unknown>;
	expanded: Record<string, unknown>;
};

type StaggerConfig = {
	staggerChildren: number;
	delayChildren?: number;
	staggerDirection?: number;
};

// ========================================================================
// Timing & Easing Constants
// ========================================================================

export const TIMING = {
	instant: 50,
	fast: 150,
	normal: 250,
	medium: 350,
	slow: 500,
	verySlow: 750,
} as const;

export const EASING: Record<string, EasingValue> = {
	// Standard CSS easing
	linear: "linear",
	easeIn: "easeIn",
	easeOut: "easeOut",
	easeInOut: "easeInOut",

	// Cubic bezier curves
	sharp: [0.4, 0, 0.6, 1],
	standard: [0.4, 0, 0.2, 1],
	emphasized: [0.4, 0, 0, 1],
	decelerated: [0, 0, 0.2, 1],
	accelerated: [0.4, 0, 1, 1],

	// Special easing
	spring: [0.68, -0.55, 0.265, 1.55],
	elastic: [0.68, -0.6, 0.32, 1.6],
	bounce: [0.68, -0.55, 0.265, 1.55],
	anticipate: [0.36, 0, 0.66, -0.56],
	backOut: [0.34, 1.56, 0.64, 1],
	backIn: [0.36, 0, 0.66, -0.56],
};

// ========================================================================
// Spring Physics Configurations
// ========================================================================

export const SPRING: Record<string, SpringConfig> = {
	// Gentle springs
	gentle: {
		type: "spring",
		stiffness: 100,
		damping: 15,
		mass: 0.8,
	},
	soft: {
		type: "spring",
		stiffness: 150,
		damping: 20,
		mass: 1,
	},

	// Standard springs
	default: {
		type: "spring",
		stiffness: 300,
		damping: 30,
		mass: 1,
	},
	medium: {
		type: "spring",
		stiffness: 260,
		damping: 26,
		mass: 1,
	},

	// Bouncy springs
	bouncy: {
		type: "spring",
		stiffness: 400,
		damping: 20,
		mass: 1,
	},
	veryBouncy: {
		type: "spring",
		stiffness: 500,
		damping: 15,
		mass: 1,
	},

	// Stiff springs (quick, minimal oscillation)
	stiff: {
		type: "spring",
		stiffness: 400,
		damping: 30,
		mass: 0.5,
	},
	veryStiff: {
		type: "spring",
		stiffness: 500,
		damping: 35,
		mass: 0.5,
	},

	// Wobbly springs
	wobbly: {
		type: "spring",
		stiffness: 180,
		damping: 12,
		mass: 1,
	},

	// Slow springs
	slow: {
		type: "spring",
		stiffness: 280,
		damping: 60,
		mass: 1.5,
	},
};

// ========================================================================
// Entry Animation Presets
// ========================================================================

export const ENTRY_ANIMATIONS: Record<string, AnimationPreset> = {
	// Fade animations
	fadeIn: {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: TIMING.normal / 1000, ease: EASING.easeOut },
	},

	fadeInSlow: {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: TIMING.slow / 1000, ease: EASING.easeOut },
	},

	// Slide animations
	slideInUp: {
		initial: { opacity: 0, y: 20 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -20 },
		transition: { duration: TIMING.medium / 1000, ease: EASING.backOut },
	},

	slideInDown: {
		initial: { opacity: 0, y: -20 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: 20 },
		transition: { duration: TIMING.medium / 1000, ease: EASING.backOut },
	},

	slideInLeft: {
		initial: { opacity: 0, x: -20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: 20 },
		transition: { duration: TIMING.medium / 1000, ease: EASING.backOut },
	},

	slideInRight: {
		initial: { opacity: 0, x: 20 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -20 },
		transition: { duration: TIMING.medium / 1000, ease: EASING.backOut },
	},

	// Scale animations
	scaleIn: {
		initial: { scale: 0.8, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0.8, opacity: 0 },
		transition: { duration: TIMING.normal / 1000, ease: EASING.backOut },
	},

	scaleInBig: {
		initial: { scale: 0, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0, opacity: 0 },
		transition: SPRING.bouncy,
	},

	popIn: {
		initial: { scale: 0.5, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0.5, opacity: 0 },
		transition: SPRING.veryBouncy,
	},

	// Combined animations
	slideScaleIn: {
		initial: { scale: 0.8, opacity: 0, y: 20 },
		animate: { scale: 1, opacity: 1, y: 0 },
		exit: { scale: 0.8, opacity: 0, y: -20 },
		transition: SPRING.default,
	},

	// Rotation animations
	rotateIn: {
		initial: { rotate: -180, scale: 0.5, opacity: 0 },
		animate: { rotate: 0, scale: 1, opacity: 1 },
		exit: { rotate: 180, scale: 0.5, opacity: 0 },
		transition: SPRING.bouncy,
	},

	// Flip animations
	flipIn: {
		initial: { rotateY: -90, opacity: 0 },
		animate: { rotateY: 0, opacity: 1 },
		exit: { rotateY: 90, opacity: 0 },
		transition: { duration: TIMING.medium / 1000, ease: EASING.backOut },
	},
};

// ========================================================================
// Exit Animation Presets
// ========================================================================

export const EXIT_ANIMATIONS: Record<string, AnimationPreset> = {
	fadeOut: {
		initial: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: TIMING.fast / 1000, ease: EASING.easeIn },
	},

	slideOut: {
		initial: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -20 },
		transition: { duration: TIMING.normal / 1000, ease: EASING.anticipate },
	},

	scaleOut: {
		initial: { scale: 1, opacity: 1 },
		exit: { scale: 0.8, opacity: 0 },
		transition: { duration: TIMING.fast / 1000, ease: EASING.easeIn },
	},

	shrinkOut: {
		initial: { scale: 1, opacity: 1 },
		exit: { scale: 0, opacity: 0 },
		transition: { duration: TIMING.fast / 1000, ease: EASING.easeIn },
	},

	collapseOut: {
		initial: { height: "auto", opacity: 1 },
		exit: { height: 0, opacity: 0 },
		transition: { duration: TIMING.normal / 1000, ease: EASING.easeInOut },
	},
};

// ========================================================================
// Interaction Animation Presets
// ========================================================================

export const INTERACTION_ANIMATIONS: Record<string, InteractionPreset> = {
	// Hover effects
	hover: {
		scale: 1.05,
		transition: { duration: TIMING.fast / 1000, ease: EASING.easeOut },
	},

	hoverSubtle: {
		scale: 1.02,
		transition: { duration: TIMING.fast / 1000, ease: EASING.easeOut },
	},

	hoverLift: {
		y: -2,
		scale: 1.02,
		transition: SPRING.stiff,
	},

	hoverGlow: {
		boxShadow: "0 0 20px rgba(255, 255, 255, 0.3)",
		transition: { duration: TIMING.normal / 1000, ease: EASING.easeOut },
	},

	// Press/tap effects
	press: {
		scale: 0.95,
		transition: { duration: TIMING.instant / 1000, ease: EASING.easeIn },
	},

	pressBig: {
		scale: 0.9,
		transition: { duration: TIMING.instant / 1000, ease: EASING.easeIn },
	},

	tap: {
		scale: 0.97,
		transition: { duration: TIMING.instant / 1000 },
	},

	// Bounce effect
	bounce: {
		scale: [1, 1.1, 0.95, 1.05, 1],
		transition: SPRING.bouncy,
	},

	// Shake effect
	shake: {
		x: [-2, 2, -2, 2, 0],
		transition: { duration: TIMING.medium / 1000 },
	},

	// Wiggle effect
	wiggle: {
		rotate: [-5, 5, -5, 5, 0],
		transition: { duration: TIMING.medium / 1000 },
	},
};

// ========================================================================
// Loading Animation Presets
// ========================================================================

export const LOADING_ANIMATIONS: Record<string, LoadingPreset> = {
	// Pulse animation
	pulse: {
		scale: [1, 1.05, 1],
		opacity: [1, 0.8, 1],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},

	// Breathing animation
	breathe: {
		scale: [1, 1.02, 1],
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},

	// Shimmer animation
	shimmer: {
		x: ["-100%", "100%"],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.linear,
		},
	},

	// Spin animation
	spin: {
		rotate: 360,
		transition: {
			duration: 1,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.linear,
		},
	},

	// Bounce animation
	bouncingLoader: {
		y: [0, -10, 0],
		transition: {
			duration: 0.6,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},

	// Fade pulse
	fadePulse: {
		opacity: [0.3, 1, 0.3],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},
};

// ========================================================================
// Collapse/Expand Animation Presets
// ========================================================================

export const COLLAPSE_ANIMATIONS: Record<string, CollapseVariants> = {
	// Height-based collapse
	height: {
		collapsed: {
			height: 0,
			opacity: 0,
			overflow: "hidden",
			transition: {
				height: { duration: TIMING.normal / 1000, ease: EASING.easeInOut },
				opacity: { duration: TIMING.fast / 1000, ease: EASING.easeOut },
			},
		},
		expanded: {
			height: "auto",
			opacity: 1,
			overflow: "visible",
			transition: {
				height: { duration: TIMING.medium / 1000, ease: EASING.easeOut },
				opacity: {
					duration: TIMING.normal / 1000,
					delay: 0.1,
					ease: EASING.easeIn,
				},
			},
		},
	},

	// Scale-based collapse
	scale: {
		collapsed: {
			scaleY: 0,
			opacity: 0,
			transition: { duration: TIMING.normal / 1000, ease: EASING.easeInOut },
		},
		expanded: {
			scaleY: 1,
			opacity: 1,
			transition: SPRING.default,
		},
	},

	// Slide collapse
	slide: {
		collapsed: {
			height: 0,
			y: -10,
			opacity: 0,
			transition: { duration: TIMING.normal / 1000, ease: EASING.easeInOut },
		},
		expanded: {
			height: "auto",
			y: 0,
			opacity: 1,
			transition: SPRING.medium,
		},
	},
};

// ========================================================================
// Stagger Animation Presets
// ========================================================================

export const STAGGER_ANIMATIONS: Record<string, StaggerConfig> = {
	// Fast stagger
	fast: {
		staggerChildren: 0.05,
		delayChildren: 0,
	},

	// Normal stagger
	normal: {
		staggerChildren: 0.1,
		delayChildren: 0.05,
	},

	// Slow stagger
	slow: {
		staggerChildren: 0.2,
		delayChildren: 0.1,
	},

	// Reverse stagger
	reverse: {
		staggerChildren: 0.1,
		staggerDirection: -1,
	},
};

// ========================================================================
// Edge/Connection Animation Presets
// ========================================================================

export const EDGE_ANIMATIONS: Record<string, LoadingPreset> = {
	// Draw animation
	draw: {
		pathLength: [0, 1],
		opacity: [0, 1],
		transition: { duration: TIMING.slow / 1000, ease: EASING.easeInOut },
	},

	// Flow animation (for particles)
	flow: {
		offsetDistance: ["0%", "100%"],
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.linear,
		},
	},

	// Pulse animation
	pulse: {
		strokeWidth: [2, 4, 2],
		opacity: [0.5, 1, 0.5],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},

	// Glow animation
	glow: {
		filter: [
			"drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))",
			"drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))",
			"drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))",
		],
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: EASING.easeInOut,
		},
	},
};

// ========================================================================
// Handle Animation Presets
// ========================================================================

export const HANDLE_ANIMATIONS: Record<
	string,
	AnimationPreset | InteractionPreset
> = {
	// Appear animation
	appear: {
		initial: { scale: 0, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0, opacity: 0 },
		transition: SPRING.bouncy,
	},

	// Magnetic pull effect
	magneticPull: {
		scale: [1, 1.2, 1.1],
		transition: SPRING.stiff,
	},

	// Connection preview
	preview: {
		scale: [0, 1.2, 1],
		opacity: [0, 0.5, 1],
		transition: SPRING.veryBouncy,
	},

	// Valid connection
	valid: {
		scale: 1.1,
		backgroundColor: "rgba(34, 197, 94, 0.3)",
		boxShadow: "0 0 15px rgba(34, 197, 94, 0.5)",
		transition: { duration: TIMING.fast / 1000 },
	},

	// Invalid connection
	invalid: {
		x: [-2, 2, -2, 2, 0],
		backgroundColor: "rgba(239, 68, 68, 0.3)",
		transition: { duration: TIMING.medium / 1000 },
	},

	// Ripple effect
	ripple: {
		scale: [1, 1.5],
		opacity: [0.5, 0],
		transition: { duration: TIMING.slow / 1000, ease: EASING.easeOut },
	},
};

// ========================================================================
// Notification/Toast Animation Presets
// ========================================================================

export const NOTIFICATION_ANIMATIONS: Record<string, AnimationPreset> = {
	slideInRight: {
		initial: { x: 400, opacity: 0 },
		animate: { x: 0, opacity: 1 },
		exit: { x: 400, opacity: 0 },
		transition: SPRING.default,
	},

	slideInTop: {
		initial: { y: -100, opacity: 0 },
		animate: { y: 0, opacity: 1 },
		exit: { y: -100, opacity: 0 },
		transition: SPRING.default,
	},

	scaleUp: {
		initial: { scale: 0.5, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0.5, opacity: 0 },
		transition: SPRING.bouncy,
	},
};

// ========================================================================
// Modal/Dialog Animation Presets
// ========================================================================

export const MODAL_ANIMATIONS: Record<string, AnimationPreset> = {
	backdrop: {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: TIMING.normal / 1000 },
	},

	content: {
		initial: { opacity: 0, scale: 0.95, y: -20 },
		animate: { opacity: 1, scale: 1, y: 0 },
		exit: { opacity: 0, scale: 0.95, y: 20 },
		transition: SPRING.default,
	},

	slideUp: {
		initial: { y: "100%", opacity: 0 },
		animate: { y: 0, opacity: 1 },
		exit: { y: "100%", opacity: 0 },
		transition: SPRING.medium,
	},

	zoom: {
		initial: { scale: 0, opacity: 0 },
		animate: { scale: 1, opacity: 1 },
		exit: { scale: 0, opacity: 0 },
		transition: SPRING.bouncy,
	},
};

// ========================================================================
// Performance Presets
// ========================================================================

export const PERFORMANCE = {
	// GPU-accelerated properties only
	gpuOnly: {
		willChange: "transform, opacity",
	},

	// Reduced motion
	reducedMotion: {
		transition: { duration: 0.01 },
		animate: { opacity: 1 },
	},
} as const;

// ========================================================================
// Preset Combinations
// ========================================================================

export const PRESETS = {
	// Node presets
	nodeEntrance: {
		...ENTRY_ANIMATIONS.slideScaleIn,
		transition: SPRING.default,
	},

	nodeExit: {
		...EXIT_ANIMATIONS.scaleOut,
		transition: { duration: TIMING.fast / 1000 },
	},

	nodeHover: INTERACTION_ANIMATIONS.hoverSubtle,

	nodePress: INTERACTION_ANIMATIONS.press,

	// Handle presets
	handleDefault: HANDLE_ANIMATIONS.appear,

	handleHover: HANDLE_ANIMATIONS.magneticPull,

	handleConnect: HANDLE_ANIMATIONS.valid,

	// Dialog presets
	dialogBackdrop: MODAL_ANIMATIONS.backdrop,

	dialogContent: MODAL_ANIMATIONS.content,

	// Menu presets
	menuContainer: {
		initial: { opacity: 0, scale: 0.95 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.95 },
		transition: { duration: TIMING.fast / 1000 },
	},

	menuItem: {
		hover: INTERACTION_ANIMATIONS.hover,
		tap: INTERACTION_ANIMATIONS.tap,
	},
} as const;

// ========================================================================
// Utility Functions
// ========================================================================

type PresetCategory =
	| "entry"
	| "exit"
	| "interaction"
	| "loading"
	| "collapse"
	| "stagger"
	| "edge"
	| "handle"
	| "notification"
	| "modal";

/**
 * Get animation preset by name
 */
export const getPreset = (
	category: PresetCategory,
	name: string
):
	| AnimationPreset
	| InteractionPreset
	| LoadingPreset
	| CollapseVariants
	| StaggerConfig => {
	const categories: Record<string, Record<string, unknown>> = {
		entry: ENTRY_ANIMATIONS,
		exit: EXIT_ANIMATIONS,
		interaction: INTERACTION_ANIMATIONS,
		loading: LOADING_ANIMATIONS,
		collapse: COLLAPSE_ANIMATIONS,
		stagger: STAGGER_ANIMATIONS,
		edge: EDGE_ANIMATIONS,
		handle: HANDLE_ANIMATIONS,
		notification: NOTIFICATION_ANIMATIONS,
		modal: MODAL_ANIMATIONS,
	};

	return (
		(categories[category]?.[name] as AnimationPreset) || PRESETS.nodeEntrance
	);
};

type CustomPresetOptions = {
	initial?: Record<string, unknown>;
	animate?: Record<string, unknown>;
	exit?: Record<string, unknown>;
	transition?: TransitionConfig | SpringConfig;
};

/**
 * Create custom animation preset
 */
export const createCustomPreset = ({
	initial = {},
	animate = {},
	exit = {},
	transition = SPRING.default,
}: CustomPresetOptions = {}): AnimationPreset => ({
	initial,
	animate,
	exit,
	transition,
});

/**
 * Merge animation presets
 */
export const mergePresets = (...presets: AnimationPreset[]): AnimationPreset =>
	presets.reduce(
		(acc, preset) => ({
			initial: { ...acc.initial, ...preset.initial },
			animate: { ...acc.animate, ...preset.animate },
			exit: { ...acc.exit, ...preset.exit },
			transition: preset.transition || acc.transition,
		}),
		{} as AnimationPreset
	);

// ========================================================================
// Default Export
// ========================================================================

export default {
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
};
