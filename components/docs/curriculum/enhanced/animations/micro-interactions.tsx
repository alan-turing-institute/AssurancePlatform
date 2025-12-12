"use client";

/**
 * Micro Interactions Component
 *
 * Small, delightful animations for UI feedback including:
 * - Button press effects
 * - Hover state enhancements
 * - Focus ring animations
 * - Success/error feedback
 * - Tooltip transitions
 * - Icon animations
 * - Number counter animations
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Info, type LucideIcon, X } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { INTERACTION_ANIMATIONS, SPRING } from "./animation-presets";
import { useAnimation } from "./animation-provider";

// ========================================================================
// Types
// ========================================================================

type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
type ToastType = "success" | "error" | "warning" | "info";
type TooltipPosition = "top" | "bottom" | "left" | "right";

type InteractiveButtonProps = {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: ButtonVariant;
	className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

type RippleEffectProps = {
	children: React.ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type AnimatedFocusRingProps = {
	children: React.ReactNode;
	isFocused?: boolean;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type FeedbackToastProps = {
	type?: ToastType;
	message?: string;
	isVisible?: boolean;
	onDismiss?: () => void;
	duration?: number;
	className?: string;
};

type SuccessCheckmarkProps = {
	isVisible?: boolean;
	size?: number;
	className?: string;
};

type AnimatedCounterProps = {
	value?: number;
	duration?: number;
	className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

type RotatingIconProps = {
	icon: LucideIcon;
	rotation?: number;
	className?: string;
} & React.SVGProps<SVGSVGElement>;

type BounceIconProps = {
	icon: LucideIcon;
	className?: string;
} & React.SVGProps<SVGSVGElement>;

type ShakeProps = {
	children: React.ReactNode;
	trigger?: boolean;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type WiggleProps = {
	children: React.ReactNode;
	trigger?: boolean;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type AnimatedTooltipProps = {
	children: React.ReactNode;
	content: string;
	position?: TooltipPosition;
	className?: string;
};

type BadgePulseProps = {
	count: string | number;
	pulse?: boolean;
	className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

type Ripple = {
	x: number;
	y: number;
	id: number;
};

type ToastConfig = {
	icon: LucideIcon;
	bgColor: string;
	iconColor: string;
};

// ========================================================================
// Interactive Button Component
// ========================================================================

export const InteractiveButton = ({
	children,
	onClick,
	variant = "primary",
	className = "",
	...props
}: InteractiveButtonProps) => {
	const { shouldAnimate, getSpring } = useAnimation();

	const variants: Record<ButtonVariant, string> = {
		primary: "bg-blue-600 hover:bg-blue-700 text-white",
		secondary: "bg-gray-700 hover:bg-gray-600 text-text-light",
		ghost:
			"bg-transparent hover:bg-background-transparent-white-hover text-text-light",
		success: "bg-green-600 hover:bg-green-700 text-white",
		danger: "bg-red-600 hover:bg-red-700 text-white",
	};

	const buttonClasses = cn(
		"px-4 py-2",
		"rounded-lg",
		"font-medium",
		"text-sm",
		"transition-colors",
		"duration-200",
		"focus:outline-none",
		"focus:ring-2",
		"focus:ring-blue-500/50",
		variants[variant],
		className
	);

	if (!shouldAnimate) {
		return (
			<button
				className={buttonClasses}
				onClick={onClick}
				type="button"
				{...props}
			>
				{children}
			</button>
		);
	}

	// Don't spread HTML props to motion.button to avoid event handler conflicts
	return (
		<motion.button
			className={buttonClasses}
			onClick={onClick}
			transition={getSpring(SPRING.stiff)}
			type="button"
			whileHover={INTERACTION_ANIMATIONS.hover}
			whileTap={INTERACTION_ANIMATIONS.press}
		>
			{children}
		</motion.button>
	);
};

// ========================================================================
// Ripple Effect Component
// ========================================================================

export const RippleEffect = ({
	children,
	className = "",
	...props
}: RippleEffectProps) => {
	const { shouldAnimate } = useAnimation();
	const [ripples, setRipples] = useState<Ripple[]>([]);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!(shouldAnimate && containerRef.current)) {
			return;
		}

		const rect = containerRef.current.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const ripple: Ripple = {
			x,
			y,
			id: Date.now(),
		};

		setRipples((prev) => [...prev, ripple]);

		setTimeout(() => {
			setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
		}, 600);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: Intentional div with button role for ripple effect container
		<div
			className={cn("relative overflow-hidden", className)}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
				}
			}}
			ref={containerRef}
			role="button"
			tabIndex={0}
			{...props}
		>
			{children}

			{shouldAnimate &&
				ripples.map((ripple) => (
					<motion.span
						animate={{
							width: 400,
							height: 400,
							x: -200,
							y: -200,
							opacity: 0,
						}}
						className="pointer-events-none absolute rounded-full bg-white/30"
						initial={{ width: 0, height: 0, x: 0, y: 0 }}
						key={ripple.id}
						style={{
							left: ripple.x,
							top: ripple.y,
						}}
						transition={{ duration: 0.6, ease: "easeOut" }}
					/>
				))}
		</div>
	);
};

// ========================================================================
// Focus Ring Component
// ========================================================================

export const AnimatedFocusRing = ({
	children,
	isFocused = false,
	className = "",
	...props
}: AnimatedFocusRingProps) => {
	const { shouldAnimate, getSpring } = useAnimation();

	if (!shouldAnimate) {
		return (
			<div
				className={cn(
					isFocused && "ring-2 ring-blue-500",
					"rounded-lg",
					className
				)}
				{...props}
			>
				{children}
			</div>
		);
	}

	// Don't spread HTML props to motion.div to avoid event handler conflicts
	return (
		<motion.div
			animate={{
				boxShadow: isFocused
					? "0 0 0 3px rgba(59, 130, 246, 0.5)"
					: "0 0 0 0px rgba(59, 130, 246, 0)",
			}}
			className={cn("rounded-lg", "relative", className)}
			transition={getSpring(SPRING.stiff)}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Feedback Toast Component
// ========================================================================

export const FeedbackToast = ({
	type = "success",
	message = "",
	isVisible = false,
	onDismiss,
	duration = 3000,
	className = "",
}: FeedbackToastProps) => {
	const { shouldAnimate } = useAnimation();

	useEffect(() => {
		if (isVisible && duration > 0) {
			const timer = setTimeout(() => {
				if (onDismiss) {
					onDismiss();
				}
			}, duration);
			return () => clearTimeout(timer);
		}
	}, [isVisible, duration, onDismiss]);

	const config: Record<ToastType, ToastConfig> = {
		success: {
			icon: Check,
			bgColor: "bg-green-600",
			iconColor: "text-white",
		},
		error: {
			icon: X,
			bgColor: "bg-red-600",
			iconColor: "text-white",
		},
		warning: {
			icon: AlertCircle,
			bgColor: "bg-yellow-600",
			iconColor: "text-white",
		},
		info: {
			icon: Info,
			bgColor: "bg-blue-600",
			iconColor: "text-white",
		},
	};

	const { icon: Icon, bgColor, iconColor } = config[type];

	const toastClasses = cn(
		"flex",
		"items-center",
		"gap-3",
		"px-4",
		"py-3",
		"rounded-lg",
		"shadow-lg",
		bgColor,
		"text-white",
		className
	);

	const variants = {
		hidden: { opacity: 0, y: -20, scale: 0.9 },
		visible: {
			opacity: 1,
			y: 0,
			scale: 1,
			transition: shouldAnimate ? SPRING.bouncy : { duration: 0 },
		},
		exit: {
			opacity: 0,
			y: -20,
			scale: 0.9,
			transition: { duration: shouldAnimate ? 0.2 : 0 },
		},
	};

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					animate="visible"
					className={toastClasses}
					exit="exit"
					initial="hidden"
					variants={variants}
				>
					<Icon className={cn("h-5 w-5", iconColor)} />
					<span className="font-medium text-sm">{message}</span>
					{onDismiss && (
						<button
							className="ml-auto rounded p-1 transition-colors hover:bg-white/10"
							onClick={onDismiss}
							type="button"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
};

// ========================================================================
// Success Checkmark Animation
// ========================================================================

export const SuccessCheckmark = ({
	isVisible = false,
	size = 48,
	className = "",
}: SuccessCheckmarkProps) => {
	const { shouldAnimate } = useAnimation();

	const circleVariants = {
		hidden: { scale: 0, opacity: 0 },
		visible: {
			scale: 1,
			opacity: 1,
			transition: shouldAnimate ? SPRING.bouncy : { duration: 0 },
		},
	};

	const checkVariants = {
		hidden: { pathLength: 0, opacity: 0 },
		visible: {
			pathLength: 1,
			opacity: 1,
			transition: {
				pathLength: {
					duration: shouldAnimate ? 0.4 : 0,
					ease: "easeOut" as const,
				},
				opacity: { duration: shouldAnimate ? 0.1 : 0 },
			},
		},
	};

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					animate="visible"
					className={className}
					initial="hidden"
					variants={circleVariants}
				>
					<svg
						aria-label="Success"
						fill="none"
						height={size}
						role="img"
						viewBox="0 0 50 50"
						width={size}
					>
						<title>Success</title>
						<motion.circle
							cx="25"
							cy="25"
							fill="none"
							r="20"
							stroke="#22c55e"
							strokeWidth="3"
							variants={circleVariants}
						/>
						<motion.path
							d="M15 25 L22 32 L35 18"
							stroke="#22c55e"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="3"
							variants={checkVariants}
						/>
					</svg>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

// ========================================================================
// Counter Animation Component
// ========================================================================

export const AnimatedCounter = ({
	value = 0,
	duration = 1,
	className = "",
	...props
}: AnimatedCounterProps) => {
	const { shouldAnimate, getDuration } = useAnimation();
	const [displayValue, setDisplayValue] = useState(0);

	useEffect(() => {
		if (!shouldAnimate) {
			setDisplayValue(value);
			return;
		}

		const startValue = displayValue;
		const endValue = value;
		const startTime = Date.now();
		const animDuration = getDuration(duration * 1000);

		const animate = () => {
			const now = Date.now();
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / animDuration, 1);

			const eased = 1 - (1 - progress) ** 3;

			const current = startValue + (endValue - startValue) * eased;
			setDisplayValue(Math.round(current));

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		requestAnimationFrame(animate);
	}, [value, duration, shouldAnimate, getDuration, displayValue]);

	return (
		<span className={className} {...props}>
			{displayValue}
		</span>
	);
};

// ========================================================================
// Icon Rotation Component
// ========================================================================

export const RotatingIcon = ({
	icon: Icon,
	rotation = 90,
	className = "",
	...props
}: RotatingIconProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return <Icon className={className} {...props} />;
	}

	return (
		<motion.div
			className="inline-block"
			transition={SPRING.default}
			whileHover={{ rotate: rotation }}
		>
			<Icon className={className} {...props} />
		</motion.div>
	);
};

// ========================================================================
// Bounce Icon Component
// ========================================================================

export const BounceIcon = ({
	icon: Icon,
	className = "",
	...props
}: BounceIconProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return <Icon className={className} {...props} />;
	}

	return (
		<motion.div
			className="inline-block"
			whileHover={{
				y: [0, -5, 0],
				transition: { duration: 0.3 },
			}}
		>
			<Icon className={className} {...props} />
		</motion.div>
	);
};

// ========================================================================
// Shake Component
// ========================================================================

export const Shake = ({
	children,
	trigger = false,
	className = "",
	...props
}: ShakeProps) => {
	const { shouldAnimate } = useAnimation();
	const [key, setKey] = useState(0);

	useEffect(() => {
		if (trigger) {
			setKey((prev) => prev + 1);
		}
	}, [trigger]);

	if (!shouldAnimate) {
		return (
			<div className={className} {...props}>
				{children}
			</div>
		);
	}

	// Don't spread HTML props to motion.div to avoid event handler conflicts
	return (
		<motion.div
			animate={trigger ? INTERACTION_ANIMATIONS.shake : {}}
			className={className}
			key={key}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Wiggle Component
// ========================================================================

export const Wiggle = ({
	children,
	trigger = false,
	className = "",
	...props
}: WiggleProps) => {
	const { shouldAnimate } = useAnimation();
	const [key, setKey] = useState(0);

	useEffect(() => {
		if (trigger) {
			setKey((prev) => prev + 1);
		}
	}, [trigger]);

	if (!shouldAnimate) {
		return (
			<div className={className} {...props}>
				{children}
			</div>
		);
	}

	// Don't spread HTML props to motion.div to avoid event handler conflicts
	return (
		<motion.div
			animate={trigger ? INTERACTION_ANIMATIONS.wiggle : {}}
			className={className}
			key={key}
		>
			{children}
		</motion.div>
	);
};

// ========================================================================
// Tooltip Component
// ========================================================================

export const AnimatedTooltip = ({
	children,
	content,
	position = "top",
	className = "",
}: AnimatedTooltipProps) => {
	const { shouldAnimate } = useAnimation();
	const [isVisible, setIsVisible] = useState(false);

	const positions: Record<TooltipPosition, string> = {
		top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
		bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
		left: "right-full top-1/2 -translate-y-1/2 mr-2",
		right: "left-full top-1/2 -translate-y-1/2 ml-2",
	};

	const variants = {
		hidden: { opacity: 0, scale: 0.8 },
		visible: {
			opacity: 1,
			scale: 1,
			transition: shouldAnimate ? SPRING.stiff : { duration: 0 },
		},
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Tooltip trigger uses mouse events for hover detection
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: Intentional span wrapper for tooltip hover
		<span
			className={cn("relative inline-block", className)}
			onMouseEnter={() => setIsVisible(true)}
			onMouseLeave={() => setIsVisible(false)}
		>
			{children}

			<AnimatePresence>
				{isVisible && (
					<motion.div
						animate="visible"
						className={cn(
							"absolute",
							"z-50",
							"px-3",
							"py-2",
							"bg-gray-900",
							"text-white",
							"text-xs",
							"rounded-lg",
							"whitespace-nowrap",
							"shadow-lg",
							positions[position]
						)}
						exit="hidden"
						initial="hidden"
						variants={variants}
					>
						{content}
					</motion.div>
				)}
			</AnimatePresence>
		</span>
	);
};

// ========================================================================
// Badge Pulse Component
// ========================================================================

export const BadgePulse = ({
	count,
	pulse = true,
	className = "",
	...props
}: BadgePulseProps) => {
	const { shouldAnimate } = useAnimation();

	const badgeClasses = cn(
		"inline-flex",
		"items-center",
		"justify-center",
		"min-w-[20px]",
		"h-5",
		"px-2",
		"text-xs",
		"font-semibold",
		"text-white",
		"bg-red-600",
		"rounded-full",
		className
	);

	if (!(shouldAnimate && pulse)) {
		return (
			<span className={badgeClasses} {...props}>
				{count}
			</span>
		);
	}

	// Don't spread HTML props to motion.span to avoid event handler conflicts
	return (
		<motion.span
			animate={{
				scale: [1, 1.1, 1],
			}}
			className={badgeClasses}
			transition={{
				duration: 1.5,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut" as const,
			}}
		>
			{count}
		</motion.span>
	);
};

// ========================================================================
// Export All
// ========================================================================

export default {
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
};
