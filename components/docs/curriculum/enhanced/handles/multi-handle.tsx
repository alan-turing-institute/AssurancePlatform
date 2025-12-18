"use client";

/**
 * Multi Handle Component
 *
 * Handle that supports multiple connections with fan-out layout, connection limit
 * indicators, grouped connection management, and visual stacking of connections.
 *
 * @component
 * @example
 * <MultiHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   maxConnections={5}
 *   fanOutLayout={true}
 *   showConnectionStack={true}
 * />
 */

import { AnimatePresence, motion } from "framer-motion";
import { Layers2, Minus, Network, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Handle, type HandleProps, Position, useReactFlow } from "reactflow";
import { cn } from "@/lib/utils";
import {
	getConnectedEdges,
	getConnectionCount,
	getConnectionPercentage,
	getHandleSizeClasses,
	getPositionClasses,
} from "./handle-utils";

type StackDirection = "horizontal" | "vertical" | "radial";

type MultiHandleProps = HandleProps & {
	nodeId: string;
	maxConnections?: number;
	fanOutLayout?: boolean;
	showConnectionStack?: boolean;
	showConnectionList?: boolean;
	groupConnections?: boolean;
	stackDirection?: StackDirection;
	className?: string;
};

type StackPosition = {
	x: number;
	y: number;
	z: number;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex handle component with multiple visual states and interactions
function MultiHandle({
	type,
	position,
	nodeId,
	id,
	isConnectable = true,
	maxConnections = 5,
	fanOutLayout = true,
	showConnectionStack = true,
	showConnectionList = false,
	groupConnections = false,
	stackDirection = "radial",
	className = "",
	...props
}: MultiHandleProps) {
	const [isHovered, setIsHovered] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [_connections, setConnections] = useState<Array<{ id: string }>>([]);
	const [connectionCount, setConnectionCount] = useState(0);
	const reactFlowInstance = useReactFlow();

	// Update connection information
	useEffect(() => {
		if (reactFlowInstance && nodeId) {
			const edges = reactFlowInstance.getEdges();
			const connectedEdges = getConnectedEdges(nodeId, id, edges, type);
			const count = getConnectionCount(nodeId, edges, type);

			setConnections(connectedEdges.map((edge) => ({ id: edge.id })));
			setConnectionCount(count);
		}
	}, [reactFlowInstance, nodeId, id, type]);

	// Calculate derived values
	const isAtLimit = connectionCount >= maxConnections;
	const hasConnections = connectionCount > 0;
	const percentage = getConnectionPercentage(connectionCount, maxConnections);

	// Get styling
	const positionClass = getPositionClasses(position);
	const sizeClasses = getHandleSizeClasses("medium");

	// Calculate stack positions
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Stack position calculation with multiple layout directions
	function getStackPositions(): StackPosition[] {
		if (!showConnectionStack || connectionCount === 0) {
			return [];
		}

		const positions: StackPosition[] = [];
		const maxVisible = Math.min(connectionCount, 3);

		if (stackDirection === "horizontal") {
			for (let i = 0; i < maxVisible; i++) {
				positions.push({ x: i * 4, y: 0, z: i });
			}
		} else if (stackDirection === "vertical") {
			for (let i = 0; i < maxVisible; i++) {
				positions.push({ x: 0, y: i * 4, z: i });
			}
		} else {
			// Radial
			for (let i = 0; i < maxVisible; i++) {
				const angle = (i * 360) / maxVisible;
				const rad = (angle * Math.PI) / 180;
				positions.push({
					x: Math.cos(rad) * 8,
					y: Math.sin(rad) * 8,
					z: i,
				});
			}
		}

		return positions;
	}

	const stackPositions = getStackPositions();

	// Get connected node names
	const getConnectedNodeNames = (): string[] => {
		if (!reactFlowInstance) {
			return [];
		}

		const nodes = reactFlowInstance.getNodes();
		const edges = reactFlowInstance.getEdges();
		const connectedEdges = getConnectedEdges(nodeId, id, edges, type);

		return connectedEdges
			.map((edge) => {
				const connectedNodeId = type === "source" ? edge.target : edge.source;
				const node = nodes.find((n) => n.id === connectedNodeId);
				return (
					node?.data?.name || node?.data?.label || connectedNodeId || "Unknown"
				);
			})
			.slice(0, 5); // Show max 5 in tooltip
	};

	// Get bar color based on percentage
	const getBarColor = (): string => {
		if (percentage >= 100) {
			return "bg-red-500";
		}
		if (percentage >= 75) {
			return "bg-orange-500";
		}
		if (percentage >= 50) {
			return "bg-yellow-500";
		}
		return "bg-blue-500";
	};

	return (
		<Handle
			id={id}
			isConnectable={isConnectable && !isAtLimit}
			position={position}
			type={type}
			{...props}
			className={cn(
				"bg-transparent!",
				"border-0!",
				sizeClasses.outer,
				"flex items-center justify-center",
				positionClass,
				"group/handle",
				"cursor-pointer",
				"z-10",
				isAtLimit && "cursor-not-allowed",
				className
			)}
			onClick={(e) => {
				if (hasConnections) {
					e.stopPropagation();
					setIsExpanded(!isExpanded);
				}
			}}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* Main handle with connection stack */}
			<motion.div
				className="pointer-events-none relative"
				whileHover={{ scale: 1.05 }}
			>
				{/* Connection stack visualization */}
				{showConnectionStack && stackPositions.length > 0 && (
					<div className="absolute inset-0">
						{stackPositions.map((pos, index) => (
							<motion.div
								animate={{
									opacity: 0.3 + index * 0.2,
									scale: 1,
									x: pos.x - 16,
									y: pos.y - 16,
								}}
								className={cn(
									sizeClasses.inner,
									"rounded-full",
									"bg-blue-100",
									"border border-blue-300",
									"absolute top-1/2 left-1/2"
								)}
								initial={{ opacity: 0, scale: 0 }}
								key={`stack-${pos.x}-${pos.y}-${pos.z}`}
								style={{ zIndex: pos.z }}
								transition={{
									delay: index * 0.05,
									type: "spring",
									stiffness: 300,
								}}
							/>
						))}
					</div>
				)}

				{/* Primary handle button */}
				<motion.div
					animate={
						hasConnections && !isAtLimit
							? {
									scale: [1, 1.05, 1],
									transition: {
										duration: 2,
										repeat: Number.POSITIVE_INFINITY,
										ease: "easeInOut",
									},
								}
							: {}
					}
					className={cn(
						sizeClasses.inner,
						"rounded-full",
						hasConnections ? "bg-blue-500" : "bg-white",
						"border-2",
						hasConnections ? "border-blue-400" : "border-gray-300",
						"flex items-center justify-center",
						"shadow-md",
						"transition-all duration-300",
						"relative z-10",
						isHovered && "shadow-lg",
						isAtLimit && "opacity-50"
					)}
				>
					{/* Dynamic icon based on state */}
					{(() => {
						if (!hasConnections) {
							return (
								<Plus
									className={cn(
										sizeClasses.icon,
										"text-gray-700",
										"transition-transform",
										isHovered && "scale-110"
									)}
									strokeWidth={2.5}
								/>
							);
						}
						if (groupConnections) {
							return (
								<Layers2
									className={cn(sizeClasses.icon, "text-white")}
									strokeWidth={2.5}
								/>
							);
						}
						return (
							<Network
								className={cn(sizeClasses.icon, "text-white")}
								strokeWidth={2.5}
							/>
						);
					})()}
				</motion.div>

				{/* Connection count badge */}
				{hasConnections && (
					<motion.div
						animate={{ scale: 1 }}
						className={cn(
							"-top-1 -right-1 absolute z-20",
							"h-5 min-w-5 px-1",
							"rounded-full",
							"bg-blue-500",
							"border-2 border-white",
							"flex items-center justify-center",
							"font-bold text-white text-xs",
							"shadow-md"
						)}
						initial={{ scale: 0 }}
					>
						{connectionCount}
					</motion.div>
				)}

				{/* Connection limit indicator bar */}
				<div
					className={cn(
						"-bottom-2 -translate-x-1/2 absolute left-1/2",
						"h-1.5 w-full",
						"overflow-hidden rounded-full bg-gray-200"
					)}
				>
					<motion.div
						animate={{ width: `${percentage}%` }}
						className={cn("h-full rounded-full", getBarColor())}
						initial={{ width: 0 }}
						transition={{ duration: 0.3 }}
					/>
				</div>

				{/* Limit reached indicator */}
				{isAtLimit && (
					<motion.div
						animate={{ scale: 1 }}
						className={cn(
							"-bottom-1 -left-1 absolute z-20",
							"h-4 w-4",
							"rounded-full",
							"bg-red-500",
							"border border-white",
							"flex items-center justify-center"
						)}
						initial={{ scale: 0 }}
					>
						<Minus className="h-3 w-3 text-white" strokeWidth={3} />
					</motion.div>
				)}

				{/* Fan-out indicator */}
				{fanOutLayout && hasConnections && (
					<motion.div
						animate={{
							scale: [1, 1.2, 1],
							opacity: [0.3, 0, 0.3],
						}}
						className="pointer-events-none absolute inset-0"
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
					>
						{[...new Array(Math.min(connectionCount, 5))].map((_, i) => {
							const angle = -60 + (i * 120) / Math.max(connectionCount - 1, 1);
							return (
								<motion.div
									animate={{ scaleY: 1 }}
									className="absolute h-4 w-0.5 origin-bottom bg-blue-400"
									initial={{ scaleY: 0 }}
									key={`fan-line-${angle}`}
									style={{
										top: "50%",
										left: "50%",
										transform: `translate(-50%, -50%) rotate(${angle}deg)`,
									}}
									transition={{ delay: i * 0.05 }}
								/>
							);
						})}
					</motion.div>
				)}

				{/* Available connections pulse */}
				{!isAtLimit && hasConnections && (
					<motion.div
						animate={{
							scale: [1, 1.4, 1],
							opacity: [0.5, 0, 0.5],
						}}
						className="absolute inset-0 rounded-full border-2 border-blue-400"
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
					/>
				)}
			</motion.div>

			{/* Expanded connection list */}
			<AnimatePresence>
				{isExpanded && showConnectionList && hasConnections && (
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className={cn(
							"absolute",
							"min-w-48 max-w-64",
							"bg-white",
							"border border-gray-300",
							"rounded-lg",
							"shadow-xl",
							"p-2",
							"pointer-events-auto",
							"z-50",
							position === Position.Top && "top-full mt-2",
							position === Position.Bottom && "bottom-full mb-2",
							position === Position.Left && "left-full ml-2",
							position === Position.Right && "right-full mr-2"
						)}
						exit={{ opacity: 0, scale: 0.9, y: -10 }}
						initial={{ opacity: 0, scale: 0.9, y: -10 }}
					>
						<div className="mb-1 font-semibold text-gray-700 text-xs">
							Connected Nodes ({connectionCount})
						</div>
						<div className="space-y-1">
							{getConnectedNodeNames().map((name) => (
								<div
									className="rounded bg-gray-50 px-2 py-1 text-gray-600 text-xs"
									key={`node-${name}`}
								>
									{name}
								</div>
							))}
							{connectionCount > 5 && (
								<div className="text-gray-400 text-xs italic">
									+{connectionCount - 5} more
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Tooltip */}
			{isHovered && !isExpanded && (
				<AnimatePresence>
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className={cn(
							"absolute",
							"px-3 py-1.5",
							"bg-gray-900",
							"text-white",
							"text-xs",
							"rounded-md",
							"whitespace-nowrap",
							"pointer-events-none",
							"z-50",
							position === Position.Top && "top-full mt-2",
							position === Position.Bottom && "bottom-full mb-2",
							position === Position.Left && "left-full ml-2",
							position === Position.Right && "right-full mr-2",
							"-translate-x-1/2 left-1/2"
						)}
						exit={{ opacity: 0, y: -5 }}
						initial={{ opacity: 0, y: -5 }}
					>
						{(() => {
							if (isAtLimit) {
								return `Maximum connections (${maxConnections}) reached`;
							}
							if (hasConnections) {
								const suffix = showConnectionList ? " - click to expand" : "";
								return `${connectionCount}/${maxConnections} connections${suffix}`;
							}
							return `Add connection (max ${maxConnections})`;
						})()}
					</motion.div>
				</AnimatePresence>
			)}
		</Handle>
	);
}

/**
 * Preset: Fan-out Multi Handle
 */
export const FanOutHandle = (props: MultiHandleProps) => (
	<MultiHandle {...props} fanOutLayout={true} maxConnections={5} />
);

/**
 * Preset: Stacked Multi Handle
 */
export const StackedHandle = (props: MultiHandleProps) => (
	<MultiHandle
		{...props}
		maxConnections={5}
		showConnectionStack={true}
		stackDirection="radial"
	/>
);

/**
 * Preset: Grouped Multi Handle
 */
export const GroupedHandle = (props: MultiHandleProps) => (
	<MultiHandle
		{...props}
		groupConnections={true}
		maxConnections={10}
		showConnectionList={true}
	/>
);

/**
 * Preset: Limited Multi Handle (3 connections max)
 */
export const LimitedMultiHandle = (props: MultiHandleProps) => (
	<MultiHandle
		{...props}
		fanOutLayout={true}
		maxConnections={3}
		showConnectionStack={true}
	/>
);

export default MultiHandle;
