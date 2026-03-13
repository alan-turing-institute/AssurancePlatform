"use client";
/**
 * Animation Utilities
 *
 * Provides Framer Motion animation configurations, variants, and utility functions
 * for React Flow node animations with FloraFauna.ai-inspired spring transitions.
 *
 * @module animations
 */

import { collapseAnimationVariants } from "./theme-config";

// ========================================================================
// Type Definitions
// ========================================================================

interface AnimationTransition {
	damping?: number;
	delay?: number;
	delayChildren?: number;
	duration?: number;
	ease?: string | number[];
	mass?: number;
	repeat?: number;
	staggerChildren?: number;
	staggerDirection?: number;
	stiffness?: number;
	type?: string;
}

interface AnimationState {
	borderColor?: string;
	boxShadow?: string | string[];
	height?: number | string;
	marginBottom?: string;
	marginTop?: string;
	opacity?: number | number[];
	rotate?: number;
	scale?: number | number[];
	transition?: AnimationTransition | Record<string, AnimationTransition>;
	x?: number;
	y?: number;
}

type AnimationVariants = Record<string, AnimationState>;

interface SpringOptions {
	damping?: number;
	mass?: number;
	stiffness?: number;
}

interface EaseOptions {
	delay?: number;
	duration?: number;
	ease?: string | number[];
}

interface StaggerOptions {
	delayChildren?: number;
	staggerChildren?: number;
}

type RevealDirection = "up" | "down" | "left" | "right";

interface RevealOptions {
	direction?: RevealDirection;
	distance?: number;
	duration?: number;
}

type PresetName =
	| "entrance"
	| "fade"
	| "scale"
	| "collapse"
	| "hover"
	| "button"
	| "handle"
	| "selection"
	| "modal";

// ========================================================================
// Node Entry/Exit Animations
// ========================================================================

/**
 * Standard node entrance animation variants
 * Used when nodes are first rendered or revealed
 */
export const nodeEntranceVariants: AnimationVariants = {
	hidden: {
		scale: 0.8,
		opacity: 0,
		y: -20,
	},
	visible: {
		scale: 1,
		opacity: 1,
		y: 0,
		transition: {
			type: "spring",
			stiffness: 300,
			damping: 30,
			mass: 1,
		},
	},
	exit: {
		scale: 0.8,
		opacity: 0,
		y: 20,
		transition: {
			duration: 0.2,
		},
	},
};

/**
 * Fade-only entrance animation (more subtle)
 */
export const nodeFadeVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			duration: 0.3,
			ease: "easeOut",
		},
	},
	exit: {
		opacity: 0,
		transition: {
			duration: 0.2,
		},
	},
};

/**
 * Scale entrance animation (more dramatic)
 */
export const nodeScaleVariants: AnimationVariants = {
	hidden: {
		scale: 0,
		opacity: 0,
	},
	visible: {
		scale: 1,
		opacity: 1,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 25,
		},
	},
	exit: {
		scale: 0,
		opacity: 0,
		transition: {
			duration: 0.2,
		},
	},
};

// ========================================================================
// Collapse/Expand Animations
// ========================================================================

/**
 * Content collapse/expand animation variants
 * Used for collapsible sections within nodes
 */
export const contentCollapseVariants: AnimationVariants = {
	collapsed: {
		height: 0,
		opacity: 0,
		marginTop: "0",
		marginBottom: "0",
		transition: {
			height: {
				duration: 0.2,
				ease: "easeInOut",
			},
			opacity: {
				duration: 0.15,
				ease: "easeOut",
			},
			margin: {
				duration: 0.2,
			},
		},
	},
	expanded: {
		height: "auto",
		opacity: 1,
		marginTop: "0.75rem",
		marginBottom: "0.75rem",
		transition: {
			height: {
				duration: 0.3,
				ease: "easeOut",
			},
			opacity: {
				duration: 0.2,
				delay: 0.1,
				ease: "easeIn",
			},
			margin: {
				duration: 0.3,
			},
		},
	},
};

/**
 * Section expand/collapse with slide effect
 */
export const sectionSlideVariants: AnimationVariants = {
	collapsed: {
		height: 0,
		opacity: 0,
		y: -10,
		transition: {
			duration: 0.2,
			ease: "easeInOut",
		},
	},
	expanded: {
		height: "auto",
		opacity: 1,
		y: 0,
		transition: {
			height: {
				duration: 0.3,
				ease: "easeOut",
			},
			opacity: {
				duration: 0.2,
				delay: 0.05,
			},
			y: {
				duration: 0.25,
				ease: "easeOut",
			},
		},
	},
};

// ========================================================================
// Hover & Interaction Animations
// ========================================================================

/**
 * Standard hover animation variants
 */
export const hoverVariants: AnimationVariants = {
	rest: {
		scale: 1,
	},
	hover: {
		scale: 1.02,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 20,
		},
	},
	tap: {
		scale: 0.98,
		transition: {
			duration: 0.1,
		},
	},
};

/**
 * Icon hover animation variants
 */
export const iconHoverVariants: AnimationVariants = {
	rest: {
		scale: 1,
		rotate: 0,
	},
	hover: {
		scale: 1.1,
		rotate: 5,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 15,
		},
	},
};

/**
 * Button press animation variants
 */
export const buttonPressVariants: AnimationVariants = {
	rest: {
		scale: 1,
	},
	hover: {
		scale: 1.05,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 20,
		},
	},
	tap: {
		scale: 0.95,
		transition: {
			duration: 0.1,
		},
	},
};

// ========================================================================
// Stagger Animations
// ========================================================================

/**
 * Stagger container variants
 * Used to animate children with stagger delay
 */
export const staggerContainerVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1,
			delayChildren: 0.05,
		},
	},
	exit: {
		opacity: 0,
		transition: {
			staggerChildren: 0.05,
			staggerDirection: -1,
		},
	},
};

/**
 * Fast stagger for quick reveals
 */
export const fastStaggerContainerVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05,
			delayChildren: 0,
		},
	},
};

/**
 * Slow stagger for dramatic reveals
 */
export const slowStaggerContainerVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.2,
			delayChildren: 0.1,
		},
	},
};

/**
 * Stagger item variants (child elements)
 */
export const staggerItemVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
		y: 20,
	},
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			type: "spring",
			stiffness: 300,
			damping: 30,
		},
	},
};

// ========================================================================
// Handle Animations
// ========================================================================

/**
 * Handle decorator animation variants
 */
export const handleDecoratorVariants: AnimationVariants = {
	hidden: {
		scale: 0,
		opacity: 0,
	},
	visible: {
		scale: 1,
		opacity: 1,
		transition: {
			type: "spring",
			stiffness: 300,
			damping: 20,
			delay: 0.1,
		},
	},
	hover: {
		scale: 1.1,
		transition: {
			type: "spring",
			stiffness: 400,
			damping: 15,
		},
	},
	tap: {
		scale: 0.9,
		transition: {
			duration: 0.1,
		},
	},
};

/**
 * Handle pulse animation (to draw attention)
 */
export const handlePulseVariants: AnimationVariants = {
	rest: {
		scale: 1,
		boxShadow: "0 0 0 0 rgba(255, 255, 255, 0)",
	},
	pulse: {
		scale: [1, 1.05, 1],
		boxShadow: [
			"0 0 0 0 rgba(255, 255, 255, 0.7)",
			"0 0 0 8px rgba(255, 255, 255, 0)",
			"0 0 0 0 rgba(255, 255, 255, 0)",
		],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut",
		},
	},
};

// ========================================================================
// Selection Animations
// ========================================================================

/**
 * Selected state animation variants
 */
export const selectionVariants: AnimationVariants = {
	unselected: {
		scale: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
	},
	selected: {
		scale: 1.02,
		borderColor: "rgba(59, 130, 246, 0.5)",
		transition: {
			type: "spring",
			stiffness: 300,
			damping: 25,
		},
	},
};

/**
 * Ring pulse for selected nodes
 */
export const selectionRingVariants: AnimationVariants = {
	unselected: {
		scale: 1,
		opacity: 0,
	},
	selected: {
		scale: [1, 1.02, 1],
		opacity: [0.5, 0.8, 0.5],
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut",
		},
	},
};

// ========================================================================
// Modal/Dialog Animations
// ========================================================================

/**
 * Modal backdrop animation
 */
export const modalBackdropVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
	},
	visible: {
		opacity: 1,
		transition: {
			duration: 0.2,
		},
	},
	exit: {
		opacity: 0,
		transition: {
			duration: 0.2,
		},
	},
};

/**
 * Modal content animation
 */
export const modalContentVariants: AnimationVariants = {
	hidden: {
		opacity: 0,
		scale: 0.95,
		y: -20,
	},
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: {
			type: "spring",
			stiffness: 300,
			damping: 30,
		},
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		y: 20,
		transition: {
			duration: 0.2,
		},
	},
};

// ========================================================================
// Utility Functions
// ========================================================================

interface SpringTransition {
	damping: number;
	mass: number;
	stiffness: number;
	type: "spring";
}

/**
 * Create custom spring transition
 */
export const createSpringTransition = ({
	stiffness = 300,
	damping = 30,
	mass = 1,
}: SpringOptions = {}): SpringTransition => ({
	type: "spring",
	stiffness,
	damping,
	mass,
});

interface EaseTransition {
	delay: number;
	duration: number;
	ease: string | number[];
}

/**
 * Create custom ease transition
 */
export const createEaseTransition = ({
	duration = 0.3,
	ease = "easeOut",
	delay = 0,
}: EaseOptions = {}): EaseTransition => ({
	duration,
	ease,
	delay,
});

interface StaggerTransition {
	delayChildren: number;
	staggerChildren: number;
}

/**
 * Create stagger transition for container
 */
export const createStaggerTransition = ({
	staggerChildren = 0.1,
	delayChildren = 0,
}: StaggerOptions = {}): StaggerTransition => ({
	staggerChildren,
	delayChildren,
});

/**
 * Combine multiple animation variants
 */
export const combineVariants = (
	...variants: AnimationVariants[]
): AnimationVariants =>
	variants.reduce((acc, variant) => {
		for (const key of Object.keys(variant)) {
			acc[key] = {
				...(acc[key] || {}),
				...variant[key],
			};
		}
		return acc;
	}, {} as AnimationVariants);

interface DirectionOffset {
	x?: number;
	y?: number;
}

/**
 * Create reveal animation with custom direction
 */
export const createRevealAnimation = ({
	direction = "up",
	distance = 20,
	duration = 0.3,
}: RevealOptions = {}): AnimationVariants => {
	const directionMap: Record<RevealDirection, DirectionOffset> = {
		up: { y: distance },
		down: { y: -distance },
		left: { x: distance },
		right: { x: -distance },
	};

	const offset = directionMap[direction] || directionMap.up;

	return {
		hidden: {
			opacity: 0,
			...offset,
		},
		visible: {
			opacity: 1,
			x: 0,
			y: 0,
			transition: {
				duration,
				ease: "easeOut",
			},
		},
	};
};

/**
 * Get animation preset by name
 */
export const getAnimationPreset = (
	preset: PresetName = "entrance"
): AnimationVariants => {
	const presets: Record<PresetName, AnimationVariants> = {
		entrance: nodeEntranceVariants,
		fade: nodeFadeVariants,
		scale: nodeScaleVariants,
		collapse: contentCollapseVariants,
		hover: hoverVariants,
		button: buttonPressVariants,
		handle: handleDecoratorVariants,
		selection: selectionVariants,
		modal: modalContentVariants,
	};

	return presets[preset] || presets.entrance;
};

// ========================================================================
// Accessibility Utilities
// ========================================================================

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
	if (typeof window === "undefined") {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Get animation variants with reduced motion support
 */
export const withReducedMotion = (
	variants: AnimationVariants
): AnimationVariants => {
	if (prefersReducedMotion()) {
		// Convert all animations to simple fades
		const reducedVariants: AnimationVariants = {};
		for (const key of Object.keys(variants)) {
			const variant = variants[key];
			reducedVariants[key] = {
				opacity: variant?.opacity !== undefined ? variant.opacity : 1,
				transition: {
					duration: 0.01,
				},
			};
		}
		return reducedVariants;
	}
	return variants;
};

// ========================================================================
// Export All
// ========================================================================

export default {
	// Entry/Exit
	nodeEntranceVariants,
	nodeFadeVariants,
	nodeScaleVariants,

	// Collapse/Expand
	contentCollapseVariants,
	sectionSlideVariants,
	collapseAnimationVariants,

	// Hover/Interaction
	hoverVariants,
	iconHoverVariants,
	buttonPressVariants,

	// Stagger
	staggerContainerVariants,
	fastStaggerContainerVariants,
	slowStaggerContainerVariants,
	staggerItemVariants,

	// Handle
	handleDecoratorVariants,
	handlePulseVariants,

	// Selection
	selectionVariants,
	selectionRingVariants,

	// Modal
	modalBackdropVariants,
	modalContentVariants,

	// Utilities
	createSpringTransition,
	createEaseTransition,
	createStaggerTransition,
	combineVariants,
	createRevealAnimation,
	getAnimationPreset,
	prefersReducedMotion,
	withReducedMotion,
};
