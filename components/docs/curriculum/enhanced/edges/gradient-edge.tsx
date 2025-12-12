"use client";

/**
 * GradientEdge Component
 *
 * Edge with dynamic gradients from source to target node colours.
 * Supports gradient direction, opacity variations, animated gradient positions,
 * and multiple gradient stops.
 *
 * Features:
 * - Dynamic gradient from source to target node colours
 * - Gradient direction based on flow direction
 * - Opacity variations based on importance
 * - Animated gradient positions
 * - Multiple gradient stops support
 * - Custom colour interpolation
 *
 * @module GradientEdge
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { EdgeProps } from "reactflow";
import { EdgeLabelRenderer, getBezierPath } from "reactflow";
import {
	generateGradientId,
	getStrokeWidth,
	interpolateGradient,
} from "./edge-utils";

type GradientEdgeData = {
	sourceColor?: string;
	targetColor?: string;
	gradientStops?: number;
	strokeWidth?: number;
	opacity?: number;
	opacityVariation?: number;
	animateGradient?: boolean;
	label?: string;
	showLabel?: boolean;
};

type GradientEdgeProps = EdgeProps<GradientEdgeData>;

/**
 * GradientEdge Component
 */
const GradientEdge = ({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data = {},
	selected = false,
	style = {},
}: GradientEdgeProps) => {
	const [isHovered, setIsHovered] = useState(false);

	// Calculate bezier path
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	// Gradient configuration
	const sourceColor = data.sourceColor || "#3b82f6"; // blue-500
	const targetColor = data.targetColor || "#8b5cf6"; // purple-500
	const gradientId = generateGradientId(id);

	// Calculate gradient angle based on edge direction
	const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
	const angleDeg = (angle * 180) / Math.PI;

	// Gradient stops
	const stopCount = data.gradientStops || 3;
	const gradientColors = useMemo(
		() => interpolateGradient(sourceColor, targetColor, stopCount),
		[sourceColor, targetColor, stopCount]
	);

	// Stroke width
	const strokeWidth = getStrokeWidth(
		isHovered,
		selected,
		data.strokeWidth || 3
	);

	// Opacity configuration
	const baseOpacity = data.opacity || 0.8;
	const opacityVariation = data.opacityVariation || 0.2;

	// Animated gradient offset
	const animateGradient = data.animateGradient !== false;

	// Label
	const label = data.label;
	const showLabel = label && data.showLabel !== false;

	return (
		<>
			<defs>
				{/* Linear gradient definition */}
				<linearGradient
					gradientTransform={`rotate(${angleDeg} 0.5 0.5)`}
					id={gradientId}
					x1="0%"
					x2="100%"
					y1="0%"
					y2="0%"
				>
					{gradientColors.map((color, index) => {
						const offset = (index / (gradientColors.length - 1)) * 100;
						const opacity =
							baseOpacity -
							Math.abs(index - gradientColors.length / 2) *
								(opacityVariation / (gradientColors.length / 2));

						return (
							<motion.stop
								animate={
									animateGradient
										? {
												stopColor: [color, color, color],
												stopOpacity: [opacity, opacity * 0.7, opacity],
											}
										: {}
								}
								key={`stop-${offset}-${color}`}
								offset={`${offset}%`}
								stopColor={color}
								stopOpacity={opacity}
								transition={
									animateGradient
										? {
												duration: 3,
												repeat: Number.POSITIVE_INFINITY,
												ease: "easeInOut",
												delay: index * 0.2,
											}
										: {}
								}
							/>
						);
					})}
				</linearGradient>

				{/* Animated gradient with offset */}
				{animateGradient && (
					<linearGradient
						gradientTransform={`rotate(${angleDeg} 0.5 0.5)`}
						id={`${gradientId}-animated`}
						x1="0%"
						x2="200%"
						y1="0%"
						y2="0%"
					>
						{gradientColors.map((color, index) => {
							const offset = (index / (gradientColors.length - 1)) * 100;
							return (
								<stop key={color} offset={`${offset}%`} stopColor={color} />
							);
						})}
					</linearGradient>
				)}

				{/* Arrow marker with gradient */}
				<marker
					id={`gradient-arrow-${id}`}
					markerHeight={6}
					markerWidth={6}
					orient="auto-start-reverse"
					refX={9}
					refY={5}
					viewBox="0 0 10 10"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill={targetColor} />
				</marker>

				{/* Glow filter */}
				<filter
					height="200%"
					id={`gradient-glow-${id}`}
					width="200%"
					x="-50%"
					y="-50%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation="3" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* Background glow (when hovered) */}
			{isHovered && (
				<motion.path
					animate={{ opacity: 0.3 }}
					d={edgePath}
					exit={{ opacity: 0 }}
					fill="none"
					filter={`url(#gradient-glow-${id})`}
					initial={{ opacity: 0 }}
					opacity={0.3}
					stroke={`url(#${gradientId})`}
					strokeWidth={strokeWidth * 2}
					transition={{ duration: 0.3 }}
				/>
			)}

			{/* Main gradient path */}
			<motion.path
				animate={{
					pathLength: 1,
					opacity: 1,
					strokeDashoffset: animateGradient ? [-100, 0] : 0,
				}}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				id={id}
				initial={{ pathLength: 0, opacity: 0 }}
				markerEnd={`url(#gradient-arrow-${id})`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke={
					animateGradient
						? `url(#${gradientId}-animated)`
						: `url(#${gradientId})`
				}
				strokeWidth={strokeWidth}
				style={{
					...style,
					cursor: "pointer",
				}}
				transition={{
					pathLength: { duration: 1, ease: "easeInOut" },
					opacity: { duration: 0.5 },
					strokeDashoffset: animateGradient
						? {
								duration: 4,
								repeat: Number.POSITIVE_INFINITY,
								ease: "linear",
							}
						: {},
				}}
			/>

			{/* Invisible wider path for easier interaction */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG path used for hit area in React Flow edge */}
			<path
				d={edgePath}
				fill="none"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke="transparent"
				strokeWidth={Math.max(strokeWidth * 3, 20)}
				style={{ cursor: "pointer" }}
			/>

			{/* Edge label */}
			{showLabel && (
				<EdgeLabelRenderer>
					<motion.div
						animate={{ opacity: 1, scale: 1 }}
						className="nodrag nopan"
						initial={{ opacity: 0, scale: 0.8 }}
						style={{
							position: "absolute",
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
							pointerEvents: "all",
						}}
						transition={{ delay: 0.3, duration: 0.3 }}
					>
						<div
							className="rounded-md px-2 py-1 font-medium text-xs"
							style={{
								background: `linear-gradient(90deg, ${sourceColor}22, ${targetColor}22)`,
								backdropFilter: "blur(10px)",
								border: `1px solid ${targetColor}44`,
								color: "rgba(255, 255, 255, 0.9)",
								boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
							}}
						>
							{label}
						</div>
					</motion.div>
				</EdgeLabelRenderer>
			)}
		</>
	);
};

/**
 * Rainbow Gradient Edge
 * Multi-colour gradient edge with vibrant colours
 */
export const RainbowGradientEdge = (props: GradientEdgeProps) => {
	const rainbowColors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
	const gradientId = `rainbow-${props.id}`;

	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	return (
		<>
			<defs>
				<linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
					{rainbowColors.map((color, index) => (
						<stop
							key={color}
							offset={`${(index / (rainbowColors.length - 1)) * 100}%`}
							stopColor={color}
						/>
					))}
				</linearGradient>
			</defs>

			<motion.path
				animate={{ pathLength: 1 }}
				d={edgePath}
				fill="none"
				initial={{ pathLength: 0 }}
				stroke={`url(#${gradientId})`}
				strokeWidth={props.data?.strokeWidth || 3}
				transition={{ duration: 1.5, ease: "easeInOut" }}
			/>
		</>
	);
};

/**
 * Pulsing Gradient Edge
 * Gradient with pulsing opacity animation
 */
export const PulsingGradientEdge = (props: GradientEdgeProps) => {
	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	return (
		<>
			<GradientEdge {...props} />
			<motion.path
				animate={{
					opacity: [0.2, 0.6, 0.2],
				}}
				d={edgePath}
				fill="none"
				stroke={`url(#${generateGradientId(props.id)})`}
				strokeWidth={(props.data?.strokeWidth || 3) + 2}
				style={{ opacity: 0.5 }}
				transition={{
					duration: 2,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
		</>
	);
};

/**
 * Radial Gradient Edge
 * Edge with radial gradient emanating from centre
 */
export const RadialGradientEdge = (props: GradientEdgeProps) => {
	const gradientId = `radial-${props.id}`;
	const sourceColor = props.data?.sourceColor || "#3b82f6";
	const targetColor = props.data?.targetColor || "#8b5cf6";

	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	return (
		<>
			<defs>
				<radialGradient cx="50%" cy="50%" id={gradientId} r="50%">
					<stop offset="0%" stopColor={sourceColor} stopOpacity={1} />
					<stop offset="50%" stopColor={targetColor} stopOpacity={0.8} />
					<stop offset="100%" stopColor={sourceColor} stopOpacity={0.5} />
				</radialGradient>
			</defs>

			<motion.path
				animate={{ pathLength: 1 }}
				d={edgePath}
				fill="none"
				initial={{ pathLength: 0 }}
				stroke={`url(#${gradientId})`}
				strokeWidth={props.data?.strokeWidth || 3}
				transition={{ duration: 1, ease: "easeInOut" }}
			/>
		</>
	);
};

/**
 * Shimmer Gradient Edge
 * Gradient with animated shimmer effect
 */
export const ShimmerGradientEdge = (props: GradientEdgeProps) => {
	const gradientId = `shimmer-${props.id}`;
	const baseColor = props.data?.sourceColor || "#3b82f6";

	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	return (
		<>
			<defs>
				<linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
					<motion.stop
						animate={{
							stopOpacity: [0.3, 0.8, 0.3],
						}}
						offset="0%"
						stopColor={baseColor}
						transition={{
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
					/>
					<motion.stop
						animate={{
							stopOpacity: [0.5, 1, 0.5],
						}}
						offset="50%"
						stopColor="#ffffff"
						transition={{
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: 0.5,
						}}
					/>
					<motion.stop
						animate={{
							stopOpacity: [0.3, 0.8, 0.3],
						}}
						offset="100%"
						stopColor={baseColor}
						transition={{
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: 1,
						}}
					/>
				</linearGradient>
			</defs>

			<motion.path
				animate={{ pathLength: 1 }}
				d={edgePath}
				fill="none"
				initial={{ pathLength: 0 }}
				stroke={`url(#${gradientId})`}
				strokeWidth={props.data?.strokeWidth || 3}
				transition={{ duration: 1, ease: "easeInOut" }}
			/>
		</>
	);
};

/**
 * Temperature Gradient Edge
 * Cold to hot colour gradient (blue to red)
 */
export const TemperatureGradientEdge = (props: GradientEdgeProps) => (
	<GradientEdge
		{...props}
		data={{
			...props.data,
			sourceColor: "#3b82f6", // blue (cold)
			targetColor: "#ef4444", // red (hot)
			gradientStops: 5,
		}}
	/>
);

export default GradientEdge;
