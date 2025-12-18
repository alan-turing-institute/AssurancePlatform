"use client";

/**
 * FlowingEdge Component
 *
 * Edge with animated particles/dots flowing along the path, direction indicators,
 * speed variations, traffic visualisation, and bi-directional flow support.
 *
 * Features:
 * - Animated particles flowing along edge
 * - Direction indicators (arrows/chevrons)
 * - Speed variations based on data
 * - Traffic visualisation (multiple particles)
 * - Bi-directional flow support
 * - Particle density control
 *
 * @module FlowingEdge
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { EdgeProps } from "reactflow";
import { EdgeLabelRenderer, getBezierPath } from "reactflow";
import { getStateColor, getStrokeWidth } from "./edge-utils";

type FlowingEdgeData = {
	state?: string;
	color?: string;
	strokeWidth?: number;
	particleCount?: number;
	particleSize?: number;
	flowSpeed?: number;
	bidirectional?: boolean;
	showDirectionIndicators?: boolean;
	indicatorCount?: number;
	trafficIntensity?: number;
	label?: string;
	showLabel?: boolean;
};

type FlowingEdgeProps = EdgeProps<FlowingEdgeData>;

/**
 * FlowingEdge Component
 */
const FlowingEdge = ({
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
}: FlowingEdgeProps) => {
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

	// Flow configuration
	const edgeState = data.state || "default";
	const baseColor = data.color || getStateColor(edgeState);
	const strokeWidth = getStrokeWidth(
		isHovered,
		selected,
		data.strokeWidth || 2
	);

	// Particle configuration
	const particleCount = data.particleCount || 3;
	const particleSize = data.particleSize || 4;
	const flowSpeed = data.flowSpeed || 1;
	const bidirectional = data.bidirectional;

	// Direction indicators
	const showDirectionIndicators = data.showDirectionIndicators !== false;
	const indicatorCount = data.indicatorCount || 2;

	// Traffic intensity (affects particle count and speed)
	const trafficIntensity = data.trafficIntensity || 0.5;
	const effectiveParticleCount = Math.max(
		1,
		Math.round(particleCount * trafficIntensity)
	);

	// Generate particle offsets for staggered animation
	const particles = useMemo(
		() =>
			Array.from({ length: effectiveParticleCount }, (_, i) => ({
				id: `particle-${id}-${i}`,
				delay: (i / effectiveParticleCount) * (3 / flowSpeed),
			})),
		[effectiveParticleCount, id, flowSpeed]
	);

	// Generate reverse particles for bidirectional flow
	const reverseParticles = useMemo(() => {
		if (!bidirectional) {
			return [];
		}
		return Array.from(
			{ length: Math.max(1, Math.floor(effectiveParticleCount / 2)) },
			(_, i) => ({
				id: `reverse-particle-${id}-${i}`,
				delay: (i / (effectiveParticleCount / 2)) * (3 / flowSpeed),
			})
		);
	}, [bidirectional, effectiveParticleCount, id, flowSpeed]);

	// Direction indicators positions
	const indicators = useMemo(
		() =>
			Array.from({ length: indicatorCount }, (_, i) => {
				const position = ((i + 1) / (indicatorCount + 1)) * 100;
				return {
					id: `indicator-${id}-${i}`,
					position,
				};
			}),
		[indicatorCount, id]
	);

	// Label
	const label = data.label;
	const showLabel = label && data.showLabel !== false;

	return (
		<>
			<defs>
				{/* Particle gradient for depth effect */}
				<radialGradient id={`particle-gradient-${id}`}>
					<stop offset="0%" stopColor={baseColor} stopOpacity={1} />
					<stop offset="100%" stopColor={baseColor} stopOpacity={0.3} />
				</radialGradient>

				{/* Arrow marker */}
				<marker
					id={`flow-arrow-${id}`}
					markerHeight={6}
					markerWidth={6}
					orient="auto-start-reverse"
					refX={9}
					refY={5}
					viewBox="0 0 10 10"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill={baseColor} />
				</marker>

				{/* Glow filter for particles */}
				<filter
					height="300%"
					id={`particle-glow-${id}`}
					width="300%"
					x="-100%"
					y="-100%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation="2" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* Base edge path */}
			<motion.path
				animate={{
					pathLength: 1,
					opacity: isHovered ? 0.7 : 0.5,
				}}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				id={id}
				initial={{ pathLength: 0, opacity: 0 }}
				markerEnd={`url(#flow-arrow-${id})`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke={baseColor}
				strokeWidth={strokeWidth}
				style={{
					...style,
					cursor: "pointer",
					opacity: 0.5,
				}}
				transition={{
					pathLength: { duration: 1, ease: "easeInOut" },
					opacity: { duration: 0.3 },
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

			{/* Flowing particles (forward direction) */}
			{particles.map((particle) => (
				<motion.circle
					animate={{
						offsetDistance: ["0%", "100%"],
						opacity: [0, 1, 1, 0],
					}}
					fill={`url(#particle-gradient-${id})`}
					filter={`url(#particle-glow-${id})`}
					initial={{ offsetDistance: "0%", opacity: 0 }}
					key={particle.id}
					r={particleSize}
					style={{
						offsetPath: `path('${edgePath}')`,
					}}
					transition={{
						offsetDistance: {
							duration: 3 / flowSpeed,
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
							delay: particle.delay,
						},
						opacity: {
							duration: 3 / flowSpeed,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: particle.delay,
							times: [0, 0.1, 0.9, 1],
						},
					}}
				/>
			))}

			{/* Flowing particles (reverse direction for bidirectional) */}
			{reverseParticles.map((particle) => (
				<motion.circle
					animate={{
						offsetDistance: ["100%", "0%"],
						opacity: [0, 0.6, 0.6, 0],
					}}
					fill={`url(#particle-gradient-${id})`}
					filter={`url(#particle-glow-${id})`}
					initial={{ offsetDistance: "100%", opacity: 0 }}
					key={particle.id}
					r={particleSize * 0.8}
					style={{ opacity: 0.6, offsetPath: `path('${edgePath}')` }}
					transition={{
						offsetDistance: {
							duration: 3.5 / flowSpeed,
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
							delay: particle.delay,
						},
						opacity: {
							duration: 3.5 / flowSpeed,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: particle.delay,
							times: [0, 0.1, 0.9, 1],
						},
					}}
				/>
			))}

			{/* Direction indicators (chevrons) */}
			{showDirectionIndicators &&
				indicators.map((indicator) => (
					<g key={indicator.id}>
						<motion.path
							animate={{
								opacity: [0.2, 0.6, 0.2],
							}}
							d="M -3 -6 L 3 0 L -3 6"
							fill="none"
							stroke={baseColor}
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							style={{ opacity: 0.4 }}
							transform={`translate(${
								sourceX + (targetX - sourceX) * (indicator.position / 100)
							}, ${sourceY + (targetY - sourceY) * (indicator.position / 100)})`}
							transition={{
								duration: 2,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
								delay: (indicator.position / 100) * 0.5,
							}}
						/>
					</g>
				))}

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
							className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-xs"
							style={{
								background: "rgba(0, 0, 0, 0.75)",
								backdropFilter: "blur(10px)",
								border: `1px solid ${baseColor}44`,
								color: "rgba(255, 255, 255, 0.9)",
								boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
							}}
						>
							{bidirectional && <span style={{ opacity: 0.5 }}>⇄</span>}
							{label}
							<motion.span
								animate={{
									opacity: [0.3, 1, 0.3],
								}}
								transition={{
									duration: 1.5,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}}
							>
								→
							</motion.span>
						</div>
					</motion.div>
				</EdgeLabelRenderer>
			)}
		</>
	);
};

/**
 * Fast Flow Edge
 * Rapid particle movement
 */
export const FastFlowEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			flowSpeed: 2,
			particleCount: 5,
		}}
	/>
);

/**
 * Slow Flow Edge
 * Gentle particle movement
 */
export const SlowFlowEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			flowSpeed: 0.5,
			particleCount: 2,
		}}
	/>
);

/**
 * Heavy Traffic Edge
 * Many particles indicating high data flow
 */
export const HeavyTrafficEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			particleCount: 8,
			flowSpeed: 1.5,
			trafficIntensity: 1,
			strokeWidth: 3,
		}}
	/>
);

/**
 * Light Traffic Edge
 * Few particles indicating low data flow
 */
export const LightTrafficEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			particleCount: 2,
			flowSpeed: 0.7,
			trafficIntensity: 0.3,
			strokeWidth: 2,
		}}
	/>
);

/**
 * Bidirectional Flow Edge
 * Particles flowing in both directions
 */
export const BidirectionalFlowEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			bidirectional: true,
			particleCount: 4,
			flowSpeed: 1,
		}}
	/>
);

/**
 * Data Stream Edge
 * Continuous stream of data particles
 */
export const DataStreamEdge = (props: FlowingEdgeProps) => (
	<FlowingEdge
		{...props}
		data={{
			...props.data,
			particleCount: 10,
			particleSize: 3,
			flowSpeed: 1.2,
			trafficIntensity: 0.8,
			showDirectionIndicators: true,
			indicatorCount: 3,
		}}
	/>
);

/**
 * Pulse Flow Edge
 * Particles with pulsing size animation
 */
export const PulseFlowEdge = (props: FlowingEdgeProps) => {
	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	const baseColor =
		props.data?.color || getStateColor(props.data?.state || "default");
	const particleCount = props.data?.particleCount || 3;

	// Pre-generate particles with stable IDs
	const pulseParticles = useMemo(
		() =>
			Array.from({ length: particleCount }, (_, i) => ({
				id: `pulse-${props.id}-${i}`,
				index: i,
			})),
		[particleCount, props.id]
	);

	return (
		<>
			<FlowingEdge {...props} />
			{pulseParticles.map((particle) => (
				<motion.circle
					animate={{
						r: [4, 8, 4],
						opacity: [0.2, 0.5, 0.2],
						offsetDistance: ["0%", "100%"],
					}}
					fill={baseColor}
					key={particle.id}
					r={6}
					style={{ opacity: 0.3, offsetPath: `path('${edgePath}')` }}
					transition={{
						r: {
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						},
						opacity: {
							duration: 1.5,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						},
						offsetDistance: {
							duration: 3,
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
							delay: (particle.index / particleCount) * 3,
						},
					}}
				/>
			))}
		</>
	);
};

/**
 * Trail Flow Edge
 * Particles with trailing effect
 */
export const TrailFlowEdge = (props: FlowingEdgeProps) => {
	const [edgePath] = getBezierPath({
		sourceX: props.sourceX,
		sourceY: props.sourceY,
		sourcePosition: props.sourcePosition,
		targetX: props.targetX,
		targetY: props.targetY,
		targetPosition: props.targetPosition,
	});

	const baseColor =
		props.data?.color || getStateColor(props.data?.state || "default");

	// Pre-generate trail particles with stable IDs
	const trailParticles = useMemo(
		() =>
			[0, 1, 2].map((i) => ({
				id: `trail-${props.id}-${i}`,
				index: i,
			})),
		[props.id]
	);

	return (
		<>
			<FlowingEdge {...props} />
			{trailParticles.map((particle) => (
				<motion.circle
					animate={{
						opacity: [0, 0.6 - particle.index * 0.2, 0],
						offsetDistance: ["0%", "100%"],
					}}
					fill={baseColor}
					key={particle.id}
					r={4 - particle.index}
					style={{
						offsetPath: `path('${edgePath}')`,
					}}
					transition={{
						offsetDistance: {
							duration: 3,
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
							delay: -particle.index * 0.15,
						},
						opacity: {
							duration: 3,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
							delay: -particle.index * 0.15,
							times: [0, 0.5, 1],
						},
					}}
				/>
			))}
		</>
	);
};

export default FlowingEdge;
