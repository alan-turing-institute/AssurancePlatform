"use client";

/**
 * SmartEdge Component
 *
 * Intelligent edge with curved paths avoiding node overlaps, dynamic path
 * recalculation, labels with background, connection strength indicators,
 * and conditional styling based on edge data.
 *
 * Features:
 * - Curved paths avoiding node overlaps
 * - Dynamic path recalculation on layout changes
 * - Labels with glassmorphism background
 * - Connection strength indicators (thickness, opacity)
 * - Conditional styling based on edge data
 * - Adaptive curvature based on distance
 *
 * @module SmartEdge
 */

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertCircle, CheckCircle, Info } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { EdgeProps, Position } from "reactflow";
import {
	EdgeLabelRenderer,
	getBezierPath,
	getSmoothStepPath,
	getStraightPath,
} from "reactflow";
import { getStateColor, getStrokeWidth } from "./edge-utils";

type EdgeState = "error" | "success" | "active" | "default";

type PositionParams = {
	sourceX: number;
	sourceY: number;
	targetX: number;
	targetY: number;
	sourcePosition: Position;
	targetPosition: Position;
};

/**
 * Get icon based on edge state
 */
function getStateIcon(edgeState: EdgeState | string): LucideIcon {
	switch (edgeState) {
		case "error":
			return AlertCircle;
		case "success":
			return CheckCircle;
		case "active":
			return Activity;
		default:
			return Info;
	}
}

type PathType = "auto" | "straight" | "smoothstep" | "bezier";

type SmartEdgeData = {
	state?: EdgeState | string;
	color?: string;
	strength?: number;
	strokeWidth?: number;
	pathType?: PathType;
	curvature?: number;
	cornerRadius?: number;
	label?: string;
	showLabel?: boolean;
	labelIcon?: LucideIcon;
	showStrengthIndicator?: boolean;
	showTypeIndicator?: boolean;
	type?: string;
	metadata?: string;
	onClick?: (
		event: React.MouseEvent,
		info: { id: string; source: string; target: string; data: SmartEdgeData }
	) => void;
	onContextMenu?: (
		event: React.MouseEvent,
		info: { id: string; source: string; target: string; data: SmartEdgeData }
	) => void;
};

type SmartEdgeProps = EdgeProps<SmartEdgeData>;

/**
 * Helper: Select path type based on layout
 */
function selectPathType(
	pathType: PathType,
	distance: number,
	sourcePosition: string,
	targetPosition: string
): PathType {
	if (pathType !== "auto") {
		return pathType;
	}

	if (distance < 150) {
		return "straight";
	}

	if (
		(sourcePosition === "right" && targetPosition === "left") ||
		(sourcePosition === "left" && targetPosition === "right")
	) {
		return "bezier";
	}

	return "smoothstep";
}

/**
 * Helper: Calculate path based on type
 */
function calculatePathByType(
	pathType: PathType,
	positions: PositionParams,
	data: SmartEdgeData
): [string, number, number] {
	const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } =
		positions;

	if (pathType === "straight") {
		const result = getStraightPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
		});
		return [result[0], result[1], result[2]];
	}

	if (pathType === "smoothstep") {
		const result = getSmoothStepPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			borderRadius: data.cornerRadius || 10,
		});
		return [result[0], result[1], result[2]];
	}

	// Default to bezier
	const result = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		curvature: data.curvature || 0.25,
	});
	return [result[0], result[1], result[2]];
}

/**
 * Helper: Calculate edge styling based on strength
 */
function calculateEdgeStyle(
	connectionStrength: number,
	baseStrokeWidth: number,
	isHovered: boolean,
	selected: boolean
) {
	const strengthModifier = 0.5 + connectionStrength * 1.5;
	const strokeWidth = getStrokeWidth(
		isHovered,
		selected,
		baseStrokeWidth * strengthModifier
	);
	const pathOpacity = 0.4 + connectionStrength * 0.6;
	return { strokeWidth, pathOpacity };
}

/**
 * SmartEdge Component
 */
const SmartEdge = (
	{
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
	}: SmartEdgeProps // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Component handles multiple interaction states and path calculations
) => {
	const [isHovered, setIsHovered] = useState(false);

	// Edge configuration
	const edgeState = data.state || "default";
	const baseColor = data.color || getStateColor(edgeState);
	const connectionStrength = data.strength || 0.5;
	const baseStrokeWidth = data.strokeWidth || 2;

	// Calculate styling
	const { strokeWidth, pathOpacity } = calculateEdgeStyle(
		connectionStrength,
		baseStrokeWidth,
		isHovered,
		selected
	);

	// Path type selection based on configuration or auto-detection
	const pathType = data.pathType || "auto";

	// Calculate optimal path
	const [edgePath, labelX, labelY] = useMemo(() => {
		const distance = Math.sqrt(
			(targetX - sourceX) ** 2 + (targetY - sourceY) ** 2
		);

		// Auto-select path type
		const selectedPathType = selectPathType(
			pathType,
			distance,
			sourcePosition,
			targetPosition
		);

		// Calculate path
		return calculatePathByType(
			selectedPathType,
			{ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition },
			data
		);
	}, [
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		pathType,
		data,
	]);

	// Label configuration
	const label = data.label;
	const showLabel = label && data.showLabel !== false;
	const labelIcon = data.labelIcon;

	// Metadata indicators
	const showStrengthIndicator = data.showStrengthIndicator !== false;
	const showTypeIndicator = data.showTypeIndicator;

	// Interaction handlers
	const handleClick = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation();
			if (data.onClick) {
				data.onClick(event, { id, source, target, data });
			}
		},
		[id, source, target, data]
	);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			if (data.onContextMenu) {
				data.onContextMenu(event, { id, source, target, data });
			}
		},
		[id, source, target, data]
	);

	const StateIcon = labelIcon || getStateIcon(edgeState);

	return (
		<>
			<defs>
				{/* Arrow marker */}
				<marker
					id={`smart-arrow-${id}`}
					markerHeight={6}
					markerWidth={6}
					orient="auto-start-reverse"
					refX={9}
					refY={5}
					viewBox="0 0 10 10"
				>
					<motion.path
						animate={{
							scale: selected ? 1.2 : 1,
						}}
						d="M 0 0 L 10 5 L 0 10 z"
						fill={baseColor}
						transition={{ duration: 0.2 }}
					/>
				</marker>

				{/* Strength indicator gradient */}
				<linearGradient
					id={`strength-gradient-${id}`}
					x1="0%"
					x2="100%"
					y1="0%"
					y2="0%"
				>
					<stop
						offset="0%"
						stopColor={baseColor}
						stopOpacity={pathOpacity * 0.5}
					/>
					<stop offset="50%" stopColor={baseColor} stopOpacity={pathOpacity} />
					<stop
						offset="100%"
						stopColor={baseColor}
						stopOpacity={pathOpacity * 0.5}
					/>
				</linearGradient>

				{/* Glow filter */}
				<filter
					height="200%"
					id={`smart-glow-${id}`}
					width="200%"
					x="-50%"
					y="-50%"
				>
					<feGaussianBlur result="coloredBlur" stdDeviation="2" />
					<feMerge>
						<feMergeNode in="coloredBlur" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* Background glow (when selected or hovered) */}
			{(selected || isHovered) && (
				<motion.path
					animate={{ opacity: 0.2 }}
					d={edgePath}
					exit={{ opacity: 0 }}
					fill="none"
					filter={`url(#smart-glow-${id})`}
					initial={{ opacity: 0 }}
					opacity={0.2}
					stroke={baseColor}
					strokeWidth={strokeWidth * 2}
					transition={{ duration: 0.3 }}
				/>
			)}

			{/* Main edge path */}
			<motion.path
				animate={{
					pathLength: 1,
					opacity: pathOpacity,
				}}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				id={id}
				initial={{ pathLength: 0, opacity: 0 }}
				markerEnd={`url(#smart-arrow-${id})`}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				stroke={
					showStrengthIndicator ? `url(#strength-gradient-${id})` : baseColor
				}
				strokeWidth={strokeWidth}
				style={{
					...style,
					cursor: "pointer",
					opacity: pathOpacity,
				}}
				transition={{
					pathLength: { duration: 0.8, ease: "easeInOut" },
					opacity: { duration: 0.3 },
				}}
				whileHover={{
					opacity: Math.min(pathOpacity + 0.2, 1),
					strokeWidth: strokeWidth * 1.2,
				}}
			/>

			{/* Connection strength indicator (dashed underline) */}
			{showStrengthIndicator && (
				<motion.path
					animate={{ pathLength: 1 }}
					d={edgePath}
					fill="none"
					initial={{ pathLength: 0 }}
					stroke={baseColor}
					strokeDasharray={`${connectionStrength * 10} ${(1 - connectionStrength) * 10}`}
					strokeWidth={strokeWidth * 0.5}
					style={{ opacity: 0.3 }}
					transition={{ duration: 1, ease: "easeInOut" }}
				/>
			)}

			{/* Invisible wider path for easier interaction */}
			{/* biome-ignore lint/a11y/useSemanticElements: SVG path element with interaction handlers for edge selection */}
			<path
				d={edgePath}
				fill="none"
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				role="button"
				stroke="transparent"
				strokeWidth={Math.max(strokeWidth * 3, 20)}
				style={{ cursor: "pointer" }}
				tabIndex={0}
			/>

			{/* Edge label with glassmorphism */}
			{showLabel && (
				<EdgeLabelRenderer>
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className="nodrag nopan"
						initial={{ opacity: 0, scale: 0.8, y: 10 }}
						style={{
							position: "absolute",
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
							pointerEvents: "all",
						}}
						transition={{ delay: 0.2, duration: 0.4, type: "spring" }}
						whileHover={{ scale: 1.05 }}
					>
						<div
							className="flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium text-xs shadow-lg"
							style={{
								background: "rgba(0, 0, 0, 0.75)",
								backdropFilter: "blur(12px)",
								border: `1px solid ${baseColor}44`,
								color: "rgba(255, 255, 255, 0.95)",
								boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px ${baseColor}22`,
							}}
						>
							{StateIcon && (
								<StateIcon
									className="h-3.5 w-3.5"
									style={{ color: baseColor }}
								/>
							)}
							<span>{label}</span>

							{/* Connection strength badge */}
							{showStrengthIndicator && (
								<div
									className="rounded px-1.5 py-0.5 font-semibold text-[10px]"
									style={{
										background: `${baseColor}33`,
										color: baseColor,
									}}
								>
									{Math.round(connectionStrength * 100)}%
								</div>
							)}

							{/* Type indicator */}
							{showTypeIndicator && data.type && (
								<div
									className="rounded px-1.5 py-0.5 text-[10px]"
									style={{
										background: "rgba(255, 255, 255, 0.1)",
										color: "rgba(255, 255, 255, 0.7)",
									}}
								>
									{data.type}
								</div>
							)}
						</div>

						{/* Metadata tooltip (on hover) */}
						{isHovered && data.metadata && (
							<motion.div
								animate={{ opacity: 1, y: -10 }}
								className="-translate-x-1/2 absolute top-full left-1/2 mt-2 transform whitespace-nowrap rounded px-2 py-1 text-[10px]"
								exit={{ opacity: 0 }}
								initial={{ opacity: 0, y: -5 }}
								style={{
									background: "rgba(0, 0, 0, 0.9)",
									backdropFilter: "blur(8px)",
									border: "1px solid rgba(255, 255, 255, 0.1)",
									color: "rgba(255, 255, 255, 0.8)",
									pointerEvents: "none",
								}}
							>
								{data.metadata}
							</motion.div>
						)}
					</motion.div>
				</EdgeLabelRenderer>
			)}
		</>
	);
};

/**
 * Strong Connection Edge
 * High strength connection
 */
export const StrongConnectionEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			strength: 1,
			showStrengthIndicator: true,
			strokeWidth: 3,
		}}
	/>
);

/**
 * Weak Connection Edge
 * Low strength connection
 */
export const WeakConnectionEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			strength: 0.3,
			showStrengthIndicator: true,
			strokeWidth: 1.5,
		}}
	/>
);

/**
 * Typed Smart Edge
 * Edge with type indicator
 */
export const TypedSmartEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			showTypeIndicator: true,
			showStrengthIndicator: true,
		}}
	/>
);

/**
 * Dependency Edge
 * Represents a dependency relationship
 */
export const DependencyEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			type: "depends",
			color: "#f59e0b", // amber
			pathType: "bezier",
			curvature: 0.3,
		}}
	/>
);

/**
 * Inheritance Edge
 * Represents an inheritance relationship
 */
export const InheritanceEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			type: "inherits",
			color: "#8b5cf6", // purple
			pathType: "smoothstep",
		}}
	/>
);

/**
 * Association Edge
 * Represents an association relationship
 */
export const AssociationEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			type: "associates",
			color: "#3b82f6", // blue
			pathType: "auto",
		}}
	/>
);

/**
 * Adaptive Path Edge
 * Automatically adapts path based on node positions
 */
export const AdaptivePathEdge = (props: SmartEdgeProps) => {
	const distance = Math.sqrt(
		(props.targetX - props.sourceX) ** 2 + (props.targetY - props.sourceY) ** 2
	);

	let pathType: PathType = "bezier";
	let curvature = 0.25;

	if (distance < 100) {
		pathType = "straight";
	} else if (distance > 400) {
		curvature = 0.15; // Less curved for long distances
	}

	return (
		<SmartEdge
			{...props}
			data={{
				...props.data,
				pathType,
				curvature,
			}}
		/>
	);
};

/**
 * Info Edge
 * Edge with informational styling
 */
export const InfoEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			state: "default",
			color: "#3b82f6",
			labelIcon: Info,
		}}
	/>
);

/**
 * Activity Edge
 * Edge showing active connection
 */
export const ActivityEdge = (props: SmartEdgeProps) => (
	<SmartEdge
		{...props}
		data={{
			...props.data,
			state: "active",
			color: "#10b981",
			labelIcon: Activity,
			strength: 0.8,
		}}
	/>
);

export default SmartEdge;
