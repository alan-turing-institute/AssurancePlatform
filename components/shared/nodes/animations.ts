"use client";

/**
 * Animation Utilities
 *
 * Provides Framer Motion animation configurations for node animations.
 */

type PropertyTransition = {
	duration?: number;
	ease?: string | number[];
	delay?: number;
};

type AnimationTransition = PropertyTransition & {
	type?: string;
	stiffness?: number;
	damping?: number;
	height?: PropertyTransition;
	opacity?: PropertyTransition;
};

type AnimationState = {
	scale?: number;
	opacity?: number;
	y?: number;
	height?: number | string;
	transition?: AnimationTransition;
};

type AnimationVariants = Record<string, AnimationState>;

/**
 * Content collapse/expand animation variants
 */
export const contentCollapseVariants: AnimationVariants = {
	collapsed: {
		height: 0,
		opacity: 0,
		transition: {
			height: {
				duration: 0.2,
				ease: "easeInOut",
			},
			opacity: {
				duration: 0.15,
				ease: "easeOut",
			},
		},
	},
	expanded: {
		height: "auto",
		opacity: 1,
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
		},
	},
};

/**
 * Chevron rotation animation variants
 */
export const chevronRotateVariants: AnimationVariants = {
	collapsed: {
		transition: {
			duration: 0.2,
		},
	},
	expanded: {
		transition: {
			duration: 0.2,
		},
	},
};

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get animation variants with reduced motion support
 */
export function withReducedMotion(
	variants: AnimationVariants
): AnimationVariants {
	if (prefersReducedMotion()) {
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
}
