"use client";

/**
 * AnimatedEdge Component
 *
 * Smooth animated edge with hover states, thickness changes, ripple effects,
 * dash array animations, colour transitions, and animated arrows.
 *
 * Features:
 * - Smooth path animations on creation
 * - Hover state with thickness change
 * - Click interactions with ripple effect
 * - Dash array animations for flow indication
 * - Colour transitions based on state
 * - Animated arrow markers
 *
 * @module AnimatedEdge
 */

import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import type { EdgeProps } from "reactflow";
import { EdgeLabelRenderer, getBezierPath } from "reactflow";
import { getStateColor, getStrokeWidth } from "./edge-utils";

type AnimatedEdgeData = {
	state?: string;
	color?: string;
	strokeWidth?: number;
	animated?: boolean;
	animationSpeed?: number;
	label?: string;
	showLabel?: boolean;
	enterDuration?: number;
	onClick?: (
		event: React.MouseEvent,
		info: { id: string; source: string; target: string }
	) => void;
	onDoubleClick?: (
		event: React.MouseEvent,
		info: { id: string; source: string; target: string }
	) => void;
	onContextMenu?: (
		event: React.MouseEvent,
		info: { id: string; source: string; target: string }
	) => void;
};

type AnimatedEdgeProps = EdgeProps<AnimatedEdgeData>;

/**
 * AnimatedEdge Component
 */
const AnimatedEdge = ({
	id,
	source,
	target,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data = {},
	selected = false,
	style = {},
}: AnimatedEdgeProps) => {
	const [isHovered, setIsHovered] = useState(false);
	const [rippleKey, setRippleKey] = useState(0);

	// Calculate bezier path
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	// Determine edge state and colour
	const edgeState = data.state || "default";
	const baseColor = data.color || getStateColor(edgeState);
	const strokeWidth = getStrokeWidth(
		isHovered,
		selected,
		data.strokeWidth || 2
	);

	// Animation configuration
	const animated = data.animated !== false;
	const animationSpeed = data.animationSpeed || 1;

	// Handle click with ripple effect
	const handleClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			setRippleKey((prev) => prev + 1);

			if (data.onClick) {
				data.onClick(event, { id, source, target });
			}
		},
		[id, source, target, data]
	);

	// Handle double click
	const handleDoubleClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();

			if (data.onDoubleClick) {
				data.onDoubleClick(event, { id, source, target });
			}
		},
		[id, source, target, data]
	);

	// Context menu handler
	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();

			if (data.onContextMenu) {
				data.onContextMenu(event, { id, source, target });
			}
		},
		[id, source, target, data]
	);

	// Marker ID for arrow
	const markerId = `arrow-${id}`;

	// Animation variants
	const pathVariants = {
		initial: {
			pathLength: 0,
			opacity: 0,
		},
		animate: {
			pathLength: 1,
			opacity: 1,
			transition: {
				duration: data.enterDuration || 1,
				ease: "easeInOut" as const,
			},
		},
		hover: {
			filter: "drop-shadow(0 0 8px currentColor)",
			transition: {
				duration: 0.2,
			},
		},
	};

	// Dash animation for flowing effect
	const dashAnimation = animated
		? {
				strokeDasharray: "10 5",
				animate: {
					strokeDashoffset: [0, -15],
				},
				transition: {
					strokeDashoffset: {
						duration: 1 / animationSpeed,
						repeat: Number.POSITIVE_INFINITY,
						ease: "linear" as const,
					},
				},
			}
		: {};

	// Label content
	const label = data.label;
	const showLabel = label && data.showLabel !== false;

	return (
		<>
			<defs>
				{/* Animated arrow marker */}
				<marker
					id={markerId}
					markerHeight={6}
					markerWidth={6}
					orient="auto-start-reverse"
					refX={9}
					refY={5}
					viewBox="0 0 10 10"
				>
					<motion.path
						animate={{
							// biome-ignore lint/style/noNestedTernary: Scale calculation for marker based on hover and selection state
							scale: isHovered ? 1.2 : selected ? 1.1 : 1,
						}}
						d="M 0 0 L 10 5 L 0 10 z"
						fill={baseColor}
						initial={{ scale: 0.8 }}
						transition={{ duration: 0.2 }}
					/>
				</marker>

				{/* Glow filter for hover effect */}
				<filter height="200%" id={`glow-${id}`} width="200%" x="-50%" y="-50%">
					<feGaussianBlur result="coloredBlur" stdDeviation="3" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* Main edge path */}
			<motion.path
				animate={isHovered ? ["animate", "hover"] : "animate"}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				id={id}
				initial="initial"
				stroke={baseColor}
				strokeWidth={strokeWidth}
				style={{
					...style,
					cursor: "pointer",
				}}
				variants={pathVariants}
				{...dashAnimation}
				markerEnd={`url(#${markerId})`}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			/>

			{/* Invisible wider path for easier interaction */}
			{/* biome-ignore lint/a11y/useSemanticElements: SVG path element with interaction handlers for edge selection */}
			<path
				d={edgePath}
				fill="none"
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				role="button"
				stroke="transparent"
				strokeWidth={Math.max(strokeWidth * 3, 20)}
				style={{ cursor: "pointer" }}
				tabIndex={0}
			/>

			{/* Ripple effect on click */}
			{rippleKey > 0 && (
				<motion.circle
					animate={{
						r: 50,
						opacity: 0,
					}}
					cx={labelX}
					cy={labelY}
					fill="none"
					initial={{ r: 0, opacity: 0.8 }}
					key={rippleKey}
					r={0}
					stroke={baseColor}
					strokeWidth={2}
					transition={{
						duration: 0.8,
						ease: "easeOut",
					}}
				/>
			)}

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
								background: "rgba(0, 0, 0, 0.75)",
								backdropFilter: "blur(10px)",
								border: "1px solid rgba(255, 255, 255, 0.1)",
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
 * AnimatedEdge with custom animation preset
 */
export const FastAnimatedEdge = (props: AnimatedEdgeProps) => (
	<AnimatedEdge
		{...props}
		data={{
			...props.data,
			enterDuration: 0.5,
			animationSpeed: 2,
		}}
	/>
);

/**
 * AnimatedEdge with slow animation
 */
export const SlowAnimatedEdge = (props: AnimatedEdgeProps) => (
	<AnimatedEdge
		{...props}
		data={{
			...props.data,
			enterDuration: 2,
			animationSpeed: 0.5,
		}}
	/>
);

/**
 * AnimatedEdge with pulse effect
 */
export const PulseAnimatedEdge = (props: AnimatedEdgeProps) => {
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

	return (
		<>
			<AnimatedEdge {...props} />
			<motion.path
				animate={{
					strokeWidth: [2, 6, 2],
					opacity: [0.3, 0.6, 0.3],
				}}
				d={edgePath}
				fill="none"
				stroke={baseColor}
				strokeWidth={props.data?.strokeWidth || 2}
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
 * AnimatedEdge with glow effect
 */
export const GlowAnimatedEdge = (props: AnimatedEdgeProps) => {
	const [isHovered, setIsHovered] = useState(false);

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

	return (
		<>
			<defs>
				<filter
					height="300%"
					id={`strong-glow-${props.id}`}
					width="300%"
					x="-100%"
					y="-100%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation="5" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			<motion.path
				animate={{
					filter: isHovered
						? `drop-shadow(0 0 10px ${baseColor})`
						: "drop-shadow(0 0 0px transparent)",
				}}
				d={edgePath}
				fill="none"
				filter={isHovered ? `url(#strong-glow-${props.id})` : "none"}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke={baseColor}
				strokeWidth={props.data?.strokeWidth || 3}
				transition={{ duration: 0.3 }}
			/>

			<AnimatedEdge {...props} />
		</>
	);
};

/**
 * AnimatedEdge with thickness animation
 */
export const ThicknessAnimatedEdge = (props: AnimatedEdgeProps) => {
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

	return (
		<motion.path
			animate={{
				strokeWidth: [2, 4, 2],
			}}
			d={edgePath}
			fill="none"
			stroke={baseColor}
			transition={{
				duration: 1.5,
				repeat: Number.POSITIVE_INFINITY,
				ease: "easeInOut",
			}}
		/>
	);
};

export default AnimatedEdge;
