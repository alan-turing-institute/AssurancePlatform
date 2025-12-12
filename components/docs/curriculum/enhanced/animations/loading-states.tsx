"use client";

/**
 * Loading States Component
 *
 * Comprehensive loading state components including:
 * - Skeleton loaders for nodes
 * - Shimmer effects
 * - Progress indicators
 * - Spinner variations
 * - Placeholder animations
 * - Content reveal animations
 *
 * @component
 */

import { motion } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";
import { LOADING_ANIMATIONS, SPRING, TIMING } from "./animation-presets";
import { useAnimation } from "./animation-provider";

// ========================================================================
// Types
// ========================================================================

type SkeletonVariant =
	| "text"
	| "title"
	| "circle"
	| "rectangle"
	| "avatar"
	| "button";

type SkeletonProps = {
	className?: string;
	variant?: SkeletonVariant;
	count?: number;
} & React.HTMLAttributes<HTMLDivElement>;

type NodeType = "goal" | "strategy" | "evidence";

type NodeSkeletonProps = {
	nodeType?: NodeType;
	expanded?: boolean;
	className?: string;
};

type SpinnerProps = {
	size?: number;
	className?: string;
} & React.SVGProps<SVGSVGElement>;

type DotsLoaderProps = {
	className?: string;
};

type ProgressBarProps = {
	progress?: number;
	className?: string;
	showLabel?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

type CircularProgressProps = {
	progress?: number;
	size?: number;
	strokeWidth?: number;
	className?: string;
	showLabel?: boolean;
};

type PulseLoaderProps = {
	className?: string;
};

type ShimmerContainerProps = {
	children: React.ReactNode;
	isLoading?: boolean;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type ContentRevealProps = {
	children: React.ReactNode;
	isLoading?: boolean;
	loader?: React.ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type PlaceholderProps = {
	text?: string;
	icon?: LucideIcon;
	className?: string;
};

type CardSkeletonProps = {
	className?: string;
};

type LoadingOverlayProps = {
	isLoading?: boolean;
	message?: string;
	className?: string;
};

// ========================================================================
// Skeleton Loader Component
// ========================================================================

export const Skeleton = ({
	className = "",
	variant = "text",
	count = 1,
	...props
}: SkeletonProps) => {
	const { shouldAnimate } = useAnimation();

	const variants: Record<SkeletonVariant, string> = {
		text: "h-4 w-full",
		title: "h-6 w-3/4",
		circle: "h-12 w-12 rounded-full",
		rectangle: "h-32 w-full",
		avatar: "h-10 w-10 rounded-full",
		button: "h-10 w-24 rounded-md",
	};

	const baseClasses = cn(
		"bg-gray-700/50",
		"rounded",
		"relative",
		"overflow-hidden",
		variants[variant],
		className
	);

	const shimmerClasses = cn(
		"absolute",
		"inset-0",
		"bg-gradient-to-r",
		"from-transparent",
		"via-gray-600/20",
		"to-transparent",
		"-translate-x-full"
	);

	const skeletons = Array.from({ length: count }, (_, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton list with fixed count, index is stable
		<div className={baseClasses} key={`skeleton-${i}`} {...props}>
			{shouldAnimate && (
				<motion.div
					animate={{
						x: ["-100%", "100%"],
						transition: {
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
						},
					}}
					className={shimmerClasses}
				/>
			)}
		</div>
	));

	return count === 1 ? (
		skeletons[0]
	) : (
		<div className="space-y-3">{skeletons}</div>
	);
};

// ========================================================================
// Node Skeleton Component
// ========================================================================

export const NodeSkeleton = ({
	expanded = false,
	className = "",
}: Omit<NodeSkeletonProps, "nodeType">) => {
	const containerClasses = cn(
		"min-w-[200px]",
		"max-w-[300px]",
		"bg-background-transparent-black",
		"border",
		"border-border-transparent",
		"f-effect-backdrop-blur-lg",
		"rounded-xl",
		"shadow-glassmorphic",
		"p-4",
		className
	);

	return (
		<div className={containerClasses}>
			<div className="mb-3 flex items-center gap-2">
				<Skeleton className="h-5 w-5 flex-shrink-0" variant="circle" />
				<Skeleton className="h-4 flex-1" variant="title" />
				<Skeleton className="h-4 w-4 flex-shrink-0" variant="circle" />
			</div>

			{expanded ? (
				<>
					<div className="mb-3 h-px bg-border-transparent" />
					<Skeleton count={3} variant="text" />
					<div className="my-3 h-px bg-border-transparent" />
					<Skeleton count={2} variant="text" />
				</>
			) : (
				<Skeleton count={2} variant="text" />
			)}
		</div>
	);
};

// ========================================================================
// Spinner Component
// ========================================================================

export const Spinner = ({
	size = 24,
	className = "",
	...props
}: SpinnerProps) => {
	const { shouldAnimate } = useAnimation();

	if (!shouldAnimate) {
		return (
			<Loader2
				className={cn("text-text-light/70", className)}
				size={size}
				{...props}
			/>
		);
	}

	return (
		<motion.div animate={LOADING_ANIMATIONS.spin}>
			<Loader2
				className={cn("text-text-light/70", className)}
				size={size}
				{...props}
			/>
		</motion.div>
	);
};

// ========================================================================
// Dots Loader Component
// ========================================================================

export const DotsLoader = ({ className = "" }: DotsLoaderProps) => {
	const { shouldAnimate, getDuration } = useAnimation();

	const dotClasses = cn("h-2 w-2", "bg-text-light", "rounded-full");

	const containerClasses = cn("flex items-center gap-1", className);

	if (!shouldAnimate) {
		return (
			<div className={containerClasses}>
				<div className={dotClasses} />
				<div className={dotClasses} />
				<div className={dotClasses} />
			</div>
		);
	}

	const dotVariants = {
		animate: {
			y: [0, -8, 0],
			transition: {
				duration: getDuration(600) / 1000,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut" as const,
			},
		},
	};

	return (
		<div className={containerClasses}>
			<motion.div
				animate="animate"
				className={dotClasses}
				transition={{ delay: 0 }}
				variants={dotVariants}
			/>
			<motion.div
				animate="animate"
				className={dotClasses}
				transition={{ delay: 0.2 }}
				variants={dotVariants}
			/>
			<motion.div
				animate="animate"
				className={dotClasses}
				transition={{ delay: 0.4 }}
				variants={dotVariants}
			/>
		</div>
	);
};

// ========================================================================
// Progress Bar Component
// ========================================================================

export const ProgressBar = ({
	progress = 0,
	className = "",
	showLabel = false,
	...props
}: ProgressBarProps) => {
	const { shouldAnimate, getSpring } = useAnimation();

	const containerClasses = cn(
		"w-full",
		"h-2",
		"bg-gray-700/50",
		"rounded-full",
		"overflow-hidden",
		"relative",
		className
	);

	const barClasses = cn(
		"h-full",
		"bg-gradient-to-r",
		"from-blue-500",
		"to-purple-500",
		"rounded-full"
	);

	const clampedProgress = Math.min(Math.max(progress, 0), 100);

	return (
		<div className="space-y-1">
			<div className={containerClasses} {...props}>
				<motion.div
					animate={{ width: `${clampedProgress}%` }}
					className={barClasses}
					initial={{ width: "0%" }}
					transition={
						shouldAnimate ? getSpring(SPRING.default) : { duration: 0 }
					}
				/>
			</div>
			{showLabel && (
				<div className="text-right text-text-light/70 text-xs">
					{Math.round(clampedProgress)}%
				</div>
			)}
		</div>
	);
};

// ========================================================================
// Circular Progress Component
// ========================================================================

export const CircularProgress = ({
	progress = 0,
	size = 48,
	strokeWidth = 4,
	className = "",
	showLabel = false,
}: CircularProgressProps) => {
	const { shouldAnimate } = useAnimation();

	const clampedProgress = Math.min(Math.max(progress, 0), 100);
	const radius = (size - strokeWidth) / 2;
	const circumference = radius * 2 * Math.PI;
	const offset = circumference - (clampedProgress / 100) * circumference;

	return (
		<div
			className={cn(
				"relative inline-flex items-center justify-center",
				className
			)}
		>
			<svg
				aria-label={`Progress: ${Math.round(clampedProgress)}%`}
				className="-rotate-90 transform"
				height={size}
				role="img"
				width={size}
			>
				<title>Progress Indicator</title>
				<circle
					className="text-gray-700/50"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					r={radius}
					stroke="currentColor"
					strokeWidth={strokeWidth}
				/>

				<motion.circle
					animate={{ strokeDashoffset: offset }}
					className="text-blue-500"
					cx={size / 2}
					cy={size / 2}
					fill="none"
					initial={{ strokeDashoffset: circumference }}
					r={radius}
					stroke="currentColor"
					strokeLinecap="round"
					strokeWidth={strokeWidth}
					style={{
						strokeDasharray: circumference,
					}}
					transition={
						shouldAnimate ? { duration: 1, ease: "easeInOut" } : { duration: 0 }
					}
				/>
			</svg>

			{showLabel && (
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="font-semibold text-text-light text-xs">
						{Math.round(clampedProgress)}%
					</span>
				</div>
			)}
		</div>
	);
};

// ========================================================================
// Pulse Loader Component
// ========================================================================

export const PulseLoader = ({ className = "" }: PulseLoaderProps) => {
	const { shouldAnimate } = useAnimation();

	const pulseClasses = cn(
		"h-12 w-12",
		"bg-blue-500/30",
		"rounded-full",
		className
	);

	if (!shouldAnimate) {
		return <div className={pulseClasses} />;
	}

	return (
		<motion.div animate={LOADING_ANIMATIONS.pulse} className={pulseClasses} />
	);
};

// ========================================================================
// Shimmer Container Component
// ========================================================================

export const ShimmerContainer = ({
	children,
	isLoading = true,
	className = "",
	...props
}: ShimmerContainerProps) => {
	const { shouldAnimate } = useAnimation();

	if (!isLoading) {
		return (
			<div className={className} {...props}>
				{children}
			</div>
		);
	}

	return (
		<div className={cn("relative overflow-hidden", className)} {...props}>
			<div className="opacity-50">{children}</div>
			{shouldAnimate && (
				<motion.div
					animate={LOADING_ANIMATIONS.shimmer}
					className={cn(
						"absolute",
						"inset-0",
						"bg-gradient-to-r",
						"from-transparent",
						"via-white/10",
						"to-transparent",
						"pointer-events-none"
					)}
				/>
			)}
		</div>
	);
};

// ========================================================================
// Content Reveal Component
// ========================================================================

export const ContentReveal = ({
	children,
	isLoading = false,
	loader = <Spinner />,
	className = "",
	...props
}: ContentRevealProps) => {
	const { shouldAnimate, getVariants } = useAnimation();

	const variants = getVariants({
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: TIMING.medium / 1000,
				ease: "easeOut",
			},
		},
	});

	if (isLoading) {
		return (
			<div className={cn("flex items-center justify-center p-8", className)}>
				{loader}
			</div>
		);
	}

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
// Placeholder Component
// ========================================================================

export const Placeholder = ({
	text = "Loading...",
	icon: Icon,
	className = "",
}: PlaceholderProps) => {
	const { shouldAnimate } = useAnimation();

	const containerClasses = cn(
		"flex",
		"flex-col",
		"items-center",
		"justify-center",
		"gap-3",
		"p-8",
		"text-text-light/50",
		className
	);

	return (
		<div className={containerClasses}>
			{Icon &&
				(shouldAnimate ? (
					<motion.div animate={LOADING_ANIMATIONS.pulse}>
						<Icon className="h-12 w-12" />
					</motion.div>
				) : (
					<Icon className="h-12 w-12" />
				))}
			<p className="text-sm">{text}</p>
		</div>
	);
};

// ========================================================================
// Card Skeleton Component
// ========================================================================

export const CardSkeleton = ({ className = "" }: CardSkeletonProps) => (
	<div
		className={cn(
			"p-4",
			"bg-background-transparent-black",
			"border",
			"border-border-transparent",
			"rounded-xl",
			className
		)}
	>
		<Skeleton className="mb-3" variant="title" />
		<Skeleton count={3} variant="text" />
	</div>
);

// ========================================================================
// Loading Overlay Component
// ========================================================================

export const LoadingOverlay = ({
	isLoading = false,
	message = "Loading...",
	className = "",
}: LoadingOverlayProps) => {
	const { shouldAnimate } = useAnimation();

	if (!isLoading) {
		return null;
	}

	return (
		<motion.div
			animate={{ opacity: 1 }}
			className={cn(
				"absolute",
				"inset-0",
				"bg-black/50",
				"backdrop-blur-sm",
				"flex",
				"flex-col",
				"items-center",
				"justify-center",
				"gap-4",
				"z-50",
				className
			)}
			exit={{ opacity: 0 }}
			initial={{ opacity: 0 }}
			transition={{ duration: shouldAnimate ? 0.2 : 0 }}
		>
			<Spinner size={48} />
			{message && <p className="text-sm text-text-light">{message}</p>}
		</motion.div>
	);
};

// ========================================================================
// Export All
// ========================================================================

export default {
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
};
