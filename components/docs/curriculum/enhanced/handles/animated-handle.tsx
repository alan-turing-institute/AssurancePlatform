"use client";

/**
 * Animated Handle Component
 *
 * Advanced handle with continuous animations, glow effects, ripples,
 * and spring physics. Provides enhanced visual feedback for user interactions.
 *
 * @component
 * @example
 * <AnimatedHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   animationType="pulse"
 *   glowIntensity="high"
 * />
 */

import { motion, type TargetAndTransition, useAnimation } from "framer-motion";
import { Plus, Sparkles, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { Handle, type HandleProps } from "reactflow";
import { cn } from "@/lib/utils";
import { getHandleSizeClasses, getPositionClasses } from "./handle-utils";

type AnimationType = "pulse" | "glow" | "ripple" | "spring" | "breathe";
type GlowIntensity = "low" | "medium" | "high";
type ColorTheme = "blue" | "green" | "purple" | "orange" | "cyan";

type AnimationValue = TargetAndTransition;

type AnimatedHandleProps = HandleProps & {
	nodeId: string;
	animationType?: AnimationType;
	glowIntensity?: GlowIntensity;
	colorTheme?: ColorTheme;
	showParticles?: boolean;
	continuousAnimation?: boolean;
	className?: string;
};

type ColorConfig = {
	base: string;
	glow: string;
	border: string;
	ring: string;
};

const AnimatedHandle = ({
	type,
	position,
	nodeId,
	id,
	isConnectable = true,
	animationType = "pulse",
	glowIntensity = "medium",
	colorTheme = "blue",
	showParticles = false,
	continuousAnimation = true,
	className = "",
	...props
}: AnimatedHandleProps) => {
	const [isHovered, setIsHovered] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [showRipple, setShowRipple] = useState(false);
	const controls = useAnimation();

	// Trigger ripple effect on connection
	useEffect(() => {
		if (isConnecting) {
			setShowRipple(true);
			setTimeout(() => setShowRipple(false), 1000);
		}
	}, [isConnecting]);

	// Spring animation on hover
	useEffect(() => {
		if (isHovered && animationType === "spring") {
			controls
				.start({
					scale: [1, 1.2, 0.95, 1.05, 1],
					transition: {
						duration: 0.6,
						ease: "easeInOut",
					},
				})
				.catch(() => {
					// Ignore animation errors
				});
		}
	}, [isHovered, animationType, controls]);

	// Get styling
	const positionClass = getPositionClasses(position);
	const sizeClasses = getHandleSizeClasses("medium");

	// Color theme configurations
	const colorThemes: Record<ColorTheme, ColorConfig> = {
		blue: {
			base: "from-blue-400 to-blue-600",
			glow: "shadow-blue-500/50",
			border: "border-blue-400",
			ring: "ring-blue-500/50",
		},
		green: {
			base: "from-green-400 to-green-600",
			glow: "shadow-green-500/50",
			border: "border-green-400",
			ring: "ring-green-500/50",
		},
		purple: {
			base: "from-purple-400 to-purple-600",
			glow: "shadow-purple-500/50",
			border: "border-purple-400",
			ring: "ring-purple-500/50",
		},
		orange: {
			base: "from-orange-400 to-orange-600",
			glow: "shadow-orange-500/50",
			border: "border-orange-400",
			ring: "ring-orange-500/50",
		},
		cyan: {
			base: "from-cyan-400 to-cyan-600",
			glow: "shadow-cyan-500/50",
			border: "border-cyan-400",
			ring: "ring-cyan-500/50",
		},
	};

	const colors = colorThemes[colorTheme] || colorThemes.blue;

	// Glow intensity configurations
	const glowIntensities: Record<GlowIntensity, string> = {
		low: "shadow-md",
		medium: "shadow-lg shadow-current",
		high: "shadow-2xl shadow-current",
	};

	const glowClass = glowIntensities[glowIntensity] || glowIntensities.medium;

	// Animation variants
	const pulseAnimation: AnimationValue = {
		scale: [1, 1.1, 1],
		opacity: [1, 0.8, 1],
		transition: {
			duration: 1.5,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut" as const,
		},
	};

	const glowAnimation: AnimationValue = {
		boxShadow: [
			"0 0 10px rgba(59, 130, 246, 0.5)",
			"0 0 30px rgba(59, 130, 246, 0.8)",
			"0 0 10px rgba(59, 130, 246, 0.5)",
		],
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut" as const,
		},
	};

	const breatheAnimation: AnimationValue = {
		scale: [1, 1.05, 1],
		transition: {
			duration: 3,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut" as const,
		},
	};

	const rippleAnimation: AnimationValue = {
		scale: [1, 2],
		opacity: [0.8, 0],
		transition: {
			duration: 1,
			ease: "easeOut" as const,
		},
	};

	// Select animation based on type
	const getAnimation = (): AnimationValue => {
		if (!(continuousAnimation || isHovered)) {
			return {};
		}

		const animationMap: Record<AnimationType, AnimationValue> = {
			pulse: pulseAnimation,
			glow: glowAnimation,
			breathe: breatheAnimation,
			spring: {}, // Handled by controls
			ripple: {},
		};

		return animationMap[animationType] || pulseAnimation;
	};

	return (
		<Handle
			id={id}
			isConnectable={isConnectable}
			position={position}
			type={type}
			{...props}
			className={cn(
				"!bg-transparent",
				"!border-0",
				sizeClasses.outer,
				"flex items-center justify-center",
				positionClass,
				"group/handle",
				"cursor-pointer",
				"z-10",
				className
			)}
			onMouseDown={() => setIsConnecting(true)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onMouseUp={() => setIsConnecting(false)}
		>
			{/* Main animated decorator */}
			<motion.div
				animate={animationType === "spring" ? controls : getAnimation()}
				className="pointer-events-none relative"
				whileHover={{
					scale: 1.15,
					transition: { duration: 0.2 },
				}}
			>
				{/* Primary handle button with gradient */}
				<div
					className={cn(
						sizeClasses.inner,
						"rounded-full",
						"bg-gradient-to-br",
						colors.base,
						"border-2",
						colors.border,
						"flex items-center justify-center",
						glowClass,
						"transition-all duration-300",
						isHovered && "border-white",
						isHovered && "ring-2",
						isHovered && colors.ring
					)}
				>
					{/* Icon with sparkle effect on hover */}
					<motion.div
						animate={
							isHovered && showParticles
								? {
										rotate: [0, 10, -10, 0],
										transition: {
											duration: 0.5,
											repeat: Number.POSITIVE_INFINITY,
										},
									}
								: {}
						}
					>
						{showParticles ? (
							<Sparkles
								className={cn(sizeClasses.icon, "text-white")}
								strokeWidth={2.5}
							/>
						) : (
							<Plus
								className={cn(sizeClasses.icon, "text-white")}
								strokeWidth={2.5}
							/>
						)}
					</motion.div>
				</div>

				{/* Outer glow ring */}
				{animationType === "glow" && continuousAnimation && (
					<motion.div
						animate={{
							scale: [1, 1.3, 1],
							opacity: [0.5, 0, 0.5],
						}}
						className={cn(
							"absolute inset-0 rounded-full",
							"border-2",
							colors.border,
							"opacity-50"
						)}
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
					/>
				)}

				{/* Ripple effect on connection */}
				{showRipple && (
					<>
						<motion.div
							animate={rippleAnimation}
							className={cn(
								"absolute inset-0 rounded-full",
								"border-2",
								colors.border
							)}
							initial={{ scale: 1, opacity: 0.8 }}
						/>
						<motion.div
							animate={rippleAnimation}
							className={cn(
								"absolute inset-0 rounded-full",
								"border-2",
								colors.border
							)}
							initial={{ scale: 1, opacity: 0.6 }}
							transition={{ delay: 0.1 }}
						/>
						<motion.div
							animate={rippleAnimation}
							className={cn(
								"absolute inset-0 rounded-full",
								"border-2",
								colors.border
							)}
							initial={{ scale: 1, opacity: 0.4 }}
							transition={{ delay: 0.2 }}
						/>
					</>
				)}

				{/* Particle effects */}
				{showParticles &&
					isHovered &&
					[...new Array(6)].map((_, i) => (
						<motion.div
							animate={{
								x: Math.cos((i * Math.PI * 2) / 6) * 20,
								y: Math.sin((i * Math.PI * 2) / 6) * 20,
								opacity: 0,
							}}
							className={cn("absolute h-1 w-1 rounded-full", "bg-white")}
							initial={{
								x: 0,
								y: 0,
								opacity: 1,
							}}
							key={`particle-${i}-${nodeId}`}
							transition={{
								duration: 1,
								repeat: Number.POSITIVE_INFINITY,
								delay: i * 0.1,
							}}
						/>
					))}

				{/* Drag preview with spring animation */}
				{isConnecting && (
					<motion.div
						animate={{
							scale: [1, 1.3, 1.1],
						}}
						className={cn(
							"absolute inset-0 rounded-full",
							"bg-white/20",
							"border-2 border-white"
						)}
						initial={{ scale: 1 }}
						transition={{
							duration: 0.4,
							ease: "easeOut",
						}}
					/>
				)}
			</motion.div>

			{/* Pulsing availability indicator */}
			{continuousAnimation && animationType === "pulse" && (
				<motion.div
					animate={{
						scale: [1, 1.5, 1],
						opacity: [0.5, 0, 0.5],
					}}
					className={cn(
						"absolute inset-0 rounded-full",
						"border-2",
						colors.border,
						"pointer-events-none"
					)}
					transition={{
						duration: 2,
						repeat: Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
				/>
			)}

			{/* Lightning effect for 'zap' style */}
			{isHovered && animationType === "spring" && (
				<motion.div
					animate={{ opacity: [0, 1, 0] }}
					className="pointer-events-none absolute inset-0"
					initial={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
				>
					<Zap
						className={cn(
							"-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2",
							"h-6 w-6 text-yellow-300"
						)}
					/>
				</motion.div>
			)}
		</Handle>
	);
};

/**
 * Preset: Pulse Handle
 */
export const PulseHandle = (props: AnimatedHandleProps) => (
	<AnimatedHandle {...props} animationType="pulse" />
);

/**
 * Preset: Glow Handle
 */
export const GlowHandle = (props: AnimatedHandleProps) => (
	<AnimatedHandle {...props} animationType="glow" glowIntensity="high" />
);

/**
 * Preset: Spring Handle
 */
export const SpringHandle = (props: AnimatedHandleProps) => (
	<AnimatedHandle {...props} animationType="spring" />
);

/**
 * Preset: Breathe Handle
 */
export const BreatheHandle = (props: AnimatedHandleProps) => (
	<AnimatedHandle {...props} animationType="breathe" />
);

/**
 * Preset: Particle Handle
 */
export const ParticleHandle = (props: AnimatedHandleProps) => (
	<AnimatedHandle
		{...props}
		animationType="pulse"
		glowIntensity="high"
		showParticles={true}
	/>
);

export default AnimatedHandle;
