"use client";

/**
 * Spring Animations Component
 *
 * Advanced spring-based animations using Framer Motion with support for:
 * - Spring physics for natural motion
 * - Stagger effects for multiple elements
 * - Chain animations for sequences
 * - Gesture-based animations (drag, pan, rotate)
 * - Scroll-triggered animations
 * - Parallax effects
 *
 * @component
 */

import {
	motion,
	useAnimationControls,
	useMotionValue,
	useScroll,
	useSpring,
	useTransform,
	useVelocity,
} from "framer-motion";
import React, { useEffect, useRef } from "react";
import { SPRING, STAGGER_ANIMATIONS } from "./animation-presets";
import { useAnimation } from "./animation-provider";

// ========================================================================
// Types
// ========================================================================

type StaggerType = "fast" | "normal" | "slow";

type SpringStaggerContainerProps = {
	children: React.ReactNode;
	stagger?: Record<string, unknown>;
	staggerType?: StaggerType;
	className?: string;
};

type SpringStaggerItemProps = {
	children: React.ReactNode;
	className?: string;
};

type SpringScaleProps = {
	children: React.ReactNode;
	scale?: number;
	spring?: Record<string, unknown>;
	className?: string;
};

type SpringRotateProps = {
	children: React.ReactNode;
	rotation?: number;
	spring?: Record<string, unknown>;
	className?: string;
};

type DragConstraints = {
	left?: number;
	right?: number;
	top?: number;
	bottom?: number;
};

type SpringDraggableProps = {
	children: React.ReactNode;
	constraints?: DragConstraints;
	onDragEnd?: () => void;
	elastic?: number;
	className?: string;
};

type SpringScrollTriggerProps = {
	children: React.ReactNode;
	offset?: number;
	className?: string;
};

type SpringParallaxProps = {
	children: React.ReactNode;
	speed?: number;
	className?: string;
};

type SpringVelocityProps = {
	children: React.ReactNode;
	transformVelocity?: (v: number) => number;
	className?: string;
};

type SpringChainProps = {
	children: React.ReactNode;
	sequence?: Record<string, string | number | number[]>[];
	className?: string;
};

type SpringGestureProps = {
	children: React.ReactNode;
	enableHover?: boolean;
	enableTap?: boolean;
	enableDrag?: boolean;
	hoverScale?: number;
	tapScale?: number;
	className?: string;
};

type SpringMagneticProps = {
	children: React.ReactNode;
	strength?: number;
	className?: string;
};

type SpringInertiaProps = {
	children: React.ReactNode;
	power?: number;
	className?: string;
};

type SpringKeyframesProps = {
	children: React.ReactNode;
	keyframes?: number[];
	property?: string;
	duration?: number;
	repeat?: number;
	className?: string;
};

// ========================================================================
// Spring Container Component
// ========================================================================

export const SpringStaggerContainer = ({
	children,
	stagger = STAGGER_ANIMATIONS.normal,
	staggerType = "normal",
	className = "",
}: SpringStaggerContainerProps) => {
	const { getVariants, shouldAnimate } = useAnimation();

	const staggerConfig = STAGGER_ANIMATIONS[staggerType] || stagger;

	const variants = getVariants({
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: staggerConfig,
		},
	});

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			animate="visible"
			className={className}
			initial="hidden"
			variants={variants}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Spring Item Component (for use with SpringStaggerContainer)
// ========================================================================

export const SpringStaggerItem = ({
	children,
	className = "",
}: SpringStaggerItemProps) => {
	const { getVariants, shouldAnimate } = useAnimation();

	const variants = getVariants({
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: SPRING.default,
		},
	});

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div className={className} variants={variants}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Spring Scale Component
// ========================================================================

export const SpringScale = ({
	children,
	scale = 1,
	spring = SPRING.default,
	className = "",
}: SpringScaleProps) => {
	const { getSpring, shouldAnimate } = useAnimation();

	const scaleValue = useSpring(shouldAnimate ? scale : 1, getSpring(spring));

	return (
		<motion.div className={className} style={{ scale: scaleValue }}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Spring Rotate Component
// ========================================================================

export const SpringRotate = ({
	children,
	rotation = 0,
	spring = SPRING.default,
	className = "",
}: SpringRotateProps) => {
	const { getSpring, shouldAnimate } = useAnimation();

	const rotateValue = useSpring(
		shouldAnimate ? rotation : 0,
		getSpring(spring)
	);

	return (
		<motion.div className={className} style={{ rotate: rotateValue }}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Draggable Spring Component
// ========================================================================

export const SpringDraggable = ({
	children,
	constraints = { left: 0, right: 0, top: 0, bottom: 0 },
	onDragEnd,
	elastic = 0.2,
	className = "",
}: SpringDraggableProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			className={className}
			drag
			dragConstraints={constraints}
			dragElastic={elastic}
			dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
			onDragEnd={onDragEnd}
			whileDrag={{ scale: 1.05, cursor: "grabbing" }}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Scroll-Triggered Spring Component
// ========================================================================

export const SpringScrollTrigger = ({
	children,
	offset = 100,
	className = "",
}: SpringScrollTriggerProps) => {
	const { shouldAnimate } = useAnimation();
	const ref = useRef<HTMLDivElement>(null);
	const [isInView, setIsInView] = React.useState(false);

	useEffect(() => {
		if (!(shouldAnimate && ref.current)) {
			return;
		}

		const handleScroll = () => {
			const element = ref.current;
			if (!element) {
				return;
			}

			const rect = element.getBoundingClientRect();
			const inView = rect.top < window.innerHeight - offset;

			setIsInView(inView);
		};

		handleScroll();
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, [offset, shouldAnimate]);

	if (!shouldAnimate) {
		return (
			<div className={className} ref={ref}>
				{children}
			</div>
		);
	}

	return (
		<motion.div
			animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
			className={className}
			initial={{ opacity: 0, y: 50 }}
			ref={ref}
			transition={SPRING.default}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Parallax Component
// ========================================================================

export const SpringParallax = ({
	children,
	speed = 0.5,
	className = "",
}: SpringParallaxProps) => {
	const { shouldAnimate } = useAnimation();
	const ref = useRef<HTMLDivElement>(null);
	const { scrollY } = useScroll();

	const y = useTransform(scrollY, (value) => {
		if (!(shouldAnimate && ref.current)) {
			return 0;
		}

		const element = ref.current;
		const rect = element.getBoundingClientRect();
		const elementTop = rect.top + value;
		const windowHeight = window.innerHeight;

		const scrollProgress =
			(value - elementTop + windowHeight) / (windowHeight + rect.height);
		return scrollProgress * speed * 100;
	});

	if (!shouldAnimate) {
		return (
			<div className={className} ref={ref}>
				{children}
			</div>
		);
	}

	return (
		<motion.div className={className} ref={ref} style={{ y }}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Velocity-Based Spring Component
// ========================================================================

export const SpringVelocity = ({
	children,
	transformVelocity = (v) => v / 10,
	className = "",
}: SpringVelocityProps) => {
	const { shouldAnimate } = useAnimation();
	const { scrollY } = useScroll();
	const scrollVelocity = useVelocity(scrollY);
	const skewX = useTransform(scrollVelocity, transformVelocity);

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div className={className} style={{ skewX }}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Chain Animation Component
// ========================================================================

export const SpringChain = ({
	children,
	sequence = [],
	className = "",
}: SpringChainProps) => {
	const { shouldAnimate } = useAnimation();
	const controls = useAnimationControls();

	useEffect(() => {
		if (!shouldAnimate || sequence.length === 0) {
			return;
		}

		const runSequence = async () => {
			for (const step of sequence) {
				await controls.start(step);
			}
		};

		runSequence();
	}, [sequence, shouldAnimate, controls]);

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div animate={controls} className={className}>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Gesture Spring Component
// ========================================================================

export const SpringGesture = ({
	children,
	enableHover = true,
	enableTap = true,
	enableDrag = false,
	hoverScale = 1.05,
	tapScale = 0.95,
	className = "",
}: SpringGestureProps) => {
	const { shouldAnimate } = useAnimation();

	const gestureProps: Record<string, unknown> = {};

	if (shouldAnimate) {
		if (enableHover) {
			gestureProps.whileHover = { scale: hoverScale };
		}
		if (enableTap) {
			gestureProps.whileTap = { scale: tapScale };
		}
		if (enableDrag) {
			gestureProps.drag = true;
			gestureProps.dragTransition = {
				bounceStiffness: 600,
				bounceDamping: 20,
			};
		}
	}

	return (
		<motion.div
			className={className}
			transition={{ type: "spring", stiffness: 400, damping: 30 }}
			{...gestureProps}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Magnetic Spring Component
// ========================================================================

export const SpringMagnetic = ({
	children,
	strength = 0.3,
	className = "",
}: SpringMagneticProps) => {
	const { shouldAnimate, getSpring } = useAnimation();
	const ref = useRef<HTMLDivElement>(null);
	const x = useMotionValue(0);
	const y = useMotionValue(0);

	const springX = useSpring(x, getSpring(SPRING.stiff));
	const springY = useSpring(y, getSpring(SPRING.stiff));

	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!(shouldAnimate && ref.current)) {
			return;
		}

		const rect = ref.current.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const deltaX = (event.clientX - centerX) * strength;
		const deltaY = (event.clientY - centerY) * strength;

		x.set(deltaX);
		y.set(deltaY);
	};

	const handleMouseLeave = () => {
		x.set(0);
		y.set(0);
	};

	if (!shouldAnimate) {
		return (
			<div className={className} ref={ref}>
				{children}
			</div>
		);
	}

	return (
		<motion.div
			className={className}
			onMouseLeave={handleMouseLeave}
			onMouseMove={handleMouseMove}
			ref={ref}
			style={{ x: springX, y: springY }}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Inertial Spring Component
// ========================================================================

export const SpringInertia = ({
	children,
	power = 0.2,
	className = "",
}: SpringInertiaProps) => {
	const { shouldAnimate } = useAnimation();
	const x = useMotionValue(0);
	const y = useMotionValue(0);

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	return (
		<motion.div
			className={className}
			drag
			dragElastic={power}
			dragMomentum={true}
			dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
			style={{ x, y }}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Keyframe Spring Component
// ========================================================================

export const SpringKeyframes = ({
	children,
	keyframes = [0, 1],
	property = "scale",
	duration = 1,
	repeat = 0,
	className = "",
}: SpringKeyframesProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return <div className={className}>{children}</div>;
	}

	const animateProps = {
		[property]: keyframes,
	};

	return (
		<motion.div
			animate={animateProps}
			className={className}
			transition={{
				duration,
				repeat,
				ease: "easeInOut" as const,
			}}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Export All
// ========================================================================

export default {
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
};
