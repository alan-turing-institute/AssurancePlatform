"use client";

/**
 * GlowingEdge Component
 *
 * Edge with soft glow effects, pulse animations, and neon-like appearance.
 * Features blur filters, shadow effects for depth, and colour intensity
 * variations based on data flow.
 *
 * Features:
 * - Soft glow effect with blur filter
 * - Pulse animation on active connections
 * - Colour intensity based on data flow
 * - Shadow effects for depth
 * - Neon-like appearance option
 * - Multiple glow layers
 *
 * @module GlowingEdge
 */

import { motion } from "framer-motion";
import { useState } from "react";
import type { EdgeProps } from "reactflow";
import { EdgeLabelRenderer, getBezierPath } from "reactflow";
import { getStateColor } from "./edge-utils";

type GlowingEdgeData = {
	state?: string;
	color?: string;
	strokeWidth?: number;
	glowIntensity?: number;
	pulse?: boolean;
	neon?: boolean;
	flowIntensity?: number;
	label?: string;
	showLabel?: boolean;
};

type GlowingEdgeProps = EdgeProps<GlowingEdgeData>;

/**
 * GlowingEdge Component
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex edge rendering with multiple visual effects
function GlowingEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data = {},
	style = {},
}: GlowingEdgeProps) {
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

	// Edge configuration
	const edgeState = data.state || "default";
	const baseColor = data.color || getStateColor(edgeState);
	const strokeWidth = data.strokeWidth || 2;
	const glowIntensity = data.glowIntensity || 1;
	const pulseEffect = data.pulse !== false;
	const neonStyle = data.neon;

	// Glow filter IDs
	const softGlowId = `soft-glow-${id}`;
	const mediumGlowId = `medium-glow-${id}`;
	const strongGlowId = `strong-glow-${id}`;
	const neonGlowId = `neon-glow-${id}`;

	// Calculate blur amounts based on intensity
	const softBlur = 3 * glowIntensity;
	const mediumBlur = 6 * glowIntensity;
	const strongBlur = 10 * glowIntensity;

	// Data flow intensity (0-1)
	const flowIntensity = data.flowIntensity || 0.5;

	// Label
	const label = data.label;
	const showLabel = label && data.showLabel !== false;

	return (
		<>
			<defs>
				{/* Soft glow filter */}
				<filter height="300%" id={softGlowId} width="300%" x="-100%" y="-100%">
					<feGaussianBlur result="coloredBlur" stdDeviation={softBlur} />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				{/* Medium glow filter */}
				<filter
					height="400%"
					id={mediumGlowId}
					width="400%"
					x="-150%"
					y="-150%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation={mediumBlur} />
					<feColorMatrix
						in="coloredBlur"
						type="matrix"
						values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"
					/>
					<feMerge>
						<feMergeNode />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				{/* Strong glow filter */}
				<filter
					height="500%"
					id={strongGlowId}
					width="500%"
					x="-200%"
					y="-200%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation={strongBlur} />
					<feColorMatrix
						in="coloredBlur"
						type="matrix"
						values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"
					/>
					<feMerge>
						<feMergeNode />
						<feMergeNode />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				{/* Neon glow filter */}
				<filter height="500%" id={neonGlowId} width="500%" x="-200%" y="-200%">
					<feGaussianBlur result="blur1" stdDeviation={strongBlur} />
					<feGaussianBlur result="blur2" stdDeviation={mediumBlur} />
					<feGaussianBlur result="blur3" stdDeviation={softBlur} />
					<feMerge>
						<feMergeNode in="blur1" />
						<feMergeNode in="blur2" />
						<feMergeNode in="blur3" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>

				{/* Arrow marker with glow */}
				<marker
					id={`glow-arrow-${id}`}
					markerHeight={6}
					markerWidth={6}
					orient="auto-start-reverse"
					refX={9}
					refY={5}
					viewBox="0 0 10 10"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill={baseColor} />
				</marker>
			</defs>

			{/* Outer glow layer (strongest) */}
			<motion.path
				animate={
					pulseEffect
						? {
								opacity: [
									0.1 * flowIntensity,
									0.3 * flowIntensity,
									0.1 * flowIntensity,
								],
								strokeWidth: [
									strokeWidth * 3,
									strokeWidth * 4,
									strokeWidth * 3,
								],
							}
						: {}
				}
				d={edgePath}
				fill="none"
				filter={`url(#${neonStyle ? neonGlowId : strongGlowId})`}
				opacity={0.2 * flowIntensity}
				stroke={baseColor}
				strokeWidth={strokeWidth * 3}
				transition={
					pulseEffect
						? {
								duration: 2,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}
						: {}
				}
			/>

			{/* Middle glow layer */}
			<motion.path
				animate={
					pulseEffect
						? {
								opacity: [
									0.3 * flowIntensity,
									0.5 * flowIntensity,
									0.3 * flowIntensity,
								],
							}
						: {}
				}
				d={edgePath}
				fill="none"
				filter={`url(#${mediumGlowId})`}
				opacity={0.4 * flowIntensity}
				stroke={baseColor}
				strokeWidth={strokeWidth * 2}
				transition={
					pulseEffect
						? {
								duration: 2,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
								delay: 0.2,
							}
						: {}
				}
			/>

			{/* Inner glow layer */}
			<motion.path
				animate={
					pulseEffect
						? {
								opacity: [
									0.5 * flowIntensity,
									0.7 * flowIntensity,
									0.5 * flowIntensity,
								],
							}
						: {}
				}
				d={edgePath}
				fill="none"
				filter={`url(#${softGlowId})`}
				opacity={0.6 * flowIntensity}
				stroke={baseColor}
				strokeWidth={strokeWidth * 1.5}
				transition={
					pulseEffect
						? {
								duration: 2,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
								delay: 0.4,
							}
						: {}
				}
			/>

			{/* Core path */}
			<motion.path
				animate={{
					pathLength: 1,
					opacity: 1,
				}}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				id={id}
				initial={{ pathLength: 0, opacity: 0 }}
				markerEnd={`url(#glow-arrow-${id})`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke={neonStyle ? "#ffffff" : baseColor}
				strokeWidth={strokeWidth}
				style={{
					...style,
					cursor: "pointer",
					filter: neonStyle ? "brightness(1.2)" : "none",
				}}
				transition={{
					pathLength: { duration: 1, ease: "easeInOut" },
					opacity: { duration: 0.5 },
				}}
			/>

			{/* Enhanced glow on hover */}
			{isHovered && (
				<motion.path
					animate={{ opacity: 0.3 }}
					d={edgePath}
					exit={{ opacity: 0 }}
					fill="none"
					filter={`url(#${strongGlowId})`}
					initial={{ opacity: 0 }}
					opacity={0.3}
					stroke={baseColor}
					strokeWidth={strokeWidth * 5}
					transition={{ duration: 0.3 }}
				/>
			)}

			{/* Invisible wider path for easier interaction */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG path used for hit area in React Flow edge */}
			<path
				d={edgePath}
				fill="none"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke="transparent"
				strokeWidth={Math.max(strokeWidth * 5, 20)}
				style={{ cursor: "pointer" }}
			/>

			{/* Edge label with glow effect */}
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
								background: "rgba(0, 0, 0, 0.85)",
								backdropFilter: "blur(10px)",
								border: `1px solid ${baseColor}`,
								color: "rgba(255, 255, 255, 0.9)",
								boxShadow: `0 0 20px ${baseColor}66, 0 2px 8px rgba(0, 0, 0, 0.15)`,
							}}
						>
							{label}
						</div>
					</motion.div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

/**
 * Neon Edge
 * Bright neon-style glowing edge
 */
export const NeonEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			neon: true,
			glowIntensity: 1.5,
			pulse: true,
		}}
	/>
);

/**
 * Soft Glow Edge
 * Subtle glow effect
 */
export const SoftGlowEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			glowIntensity: 0.5,
			pulse: false,
		}}
	/>
);

/**
 * Intense Glow Edge
 * Strong glow with high intensity
 */
export const IntenseGlowEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			glowIntensity: 2,
			pulse: true,
			flowIntensity: 1,
		}}
	/>
);

/**
 * Active Data Flow Edge
 * Glowing edge indicating active data transfer
 */
export const ActiveDataFlowEdge = (props: GlowingEdgeProps) => {
	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	const baseColor = props.data?.color || "#10b981"; // green for active

	return (
		<>
			<GlowingEdge
				{...props}
				data={{
					...props.data,
					color: baseColor,
					glowIntensity: 1.5,
					pulse: true,
					flowIntensity: 1,
				}}
			/>

			{/* Flowing particles effect */}
			{[0, 0.33, 0.66].map((offset) => (
				<motion.circle
					animate={{
						offsetDistance: ["0%", "100%"],
					}}
					fill={baseColor}
					filter={`url(#soft-glow-${props.id})`}
					key={`particle-${offset}`}
					r={3}
					style={{
						offsetPath: `path('${edgePath}')`,
					}}
					transition={{
						duration: 2,
						repeat: Number.POSITIVE_INFINITY,
						ease: "linear",
						delay: offset * 2,
					}}
				/>
			))}
		</>
	);
};

/**
 * Error Glow Edge
 * Red glowing edge for error states
 */
export const ErrorGlowEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			color: "#ef4444", // red
			state: "error",
			glowIntensity: 1.2,
			pulse: true,
			flowIntensity: 0.8,
		}}
	/>
);

/**
 * Success Glow Edge
 * Green glowing edge for success states
 */
export const SuccessGlowEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			color: "#10b981", // green
			state: "success",
			glowIntensity: 1,
			pulse: false,
			flowIntensity: 1,
		}}
	/>
);

/**
 * Warning Glow Edge
 * Amber glowing edge for warning states
 */
export const WarningGlowEdge = (props: GlowingEdgeProps) => (
	<GlowingEdge
		{...props}
		data={{
			...props.data,
			color: "#f59e0b", // amber
			state: "warning",
			glowIntensity: 1,
			pulse: true,
			flowIntensity: 0.7,
		}}
	/>
);

/**
 * Breathing Glow Edge
 * Gentle breathing animation
 */
export const BreathingGlowEdge = (props: GlowingEdgeProps) => {
	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	const baseColor = props.data?.color || "#8b5cf6";

	return (
		<>
			<defs>
				<filter
					height="500%"
					id={`breathing-glow-${props.id}`}
					width="500%"
					x="-200%"
					y="-200%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation="8" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<motion.path
				animate={{
					opacity: [0.4, 0.8, 0.4],
					strokeWidth: [2, 4, 2],
				}}
				d={edgePath}
				fill="none"
				filter={`url(#breathing-glow-${props.id})`}
				stroke={baseColor}
				strokeWidth={props.data?.strokeWidth || 2}
				transition={{
					duration: 4,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			/>
		</>
	);
};

export default GlowingEdge;
