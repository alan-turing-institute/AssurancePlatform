"use client";

/**
 * Smart Handle Component
 *
 * Intelligent handle that auto-hides, shows only on node hover, avoids overlaps,
 * displays connection type indicators (AND/OR), and provides visual feedback
 * for compatible connections.
 *
 * @component
 * @example
 * <SmartHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   autoHide={true}
 *   connectionType="AND"
 *   compatibleTypes={['strategy', 'evidence']}
 * />
 */

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
	AlertCircle,
	CheckCircle2,
	GitMerge,
	Layers,
	Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Handle,
	type HandleProps,
	Position,
	useReactFlow,
	useStore,
} from "reactflow";
import { cn } from "@/lib/utils";
import {
	areNodeTypesCompatible,
	getHandleSizeClasses,
	getPositionClasses,
} from "./handle-utils";

type ConnectionType = "AND" | "OR" | "single";

type SmartHandleProps = HandleProps & {
	nodeId: string;
	autoHide?: boolean;
	showOnNodeHover?: boolean;
	connectionType?: ConnectionType;
	compatibleTypes?: string[];
	smartPositioning?: boolean;
	nodeType?: string;
	showCompatibilityIndicator?: boolean;
	className?: string;
};

type ColorConfig = {
	bg: string;
	border: string;
	icon: string;
	glow: string;
};

const connectionTypeIconMap: Record<ConnectionType, LucideIcon> = {
	AND: GitMerge,
	OR: Layers,
	single: Plus,
};

const SmartHandle = ({
	type,
	position,
	nodeId,
	id,
	isConnectable = true,
	autoHide = false,
	showOnNodeHover = true,
	connectionType = "single",
	compatibleTypes = [],
	smartPositioning = false,
	nodeType = "default",
	showCompatibilityIndicator = true,
	className = "",
	...props
}: SmartHandleProps) => {
	const [isVisible, setIsVisible] = useState(!(autoHide || showOnNodeHover));
	const [isHovered, setIsHovered] = useState(false);
	const [isNodeHovered, setIsNodeHovered] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isCompatible, setIsCompatible] = useState<boolean | null>(null);
	const handleRef = useRef<HTMLDivElement>(null);
	const reactFlowInstance = useReactFlow();

	// Detect if connection drag is active
	const connectionNodeId = useStore((state) => state.connectionNodeId);
	const connectionHandleType = useStore((state) => state.connectionHandleType);

	useEffect(() => {
		setIsDragActive(connectionNodeId !== null);
	}, [connectionNodeId]);

	// Show handle when node is hovered
	useEffect(() => {
		if (showOnNodeHover) {
			setIsVisible(isNodeHovered || isDragActive);
		} else if (autoHide) {
			setIsVisible(isDragActive || isHovered);
		} else {
			setIsVisible(true);
		}
	}, [isNodeHovered, isDragActive, isHovered, showOnNodeHover, autoHide]);

	// Check compatibility when dragging
	useEffect(() => {
		if (!(isDragActive && connectionNodeId && reactFlowInstance)) {
			setIsCompatible(null);
			return;
		}

		const nodes = reactFlowInstance.getNodes();
		const sourceNode = nodes.find((n) => n.id === connectionNodeId);
		const targetNode = nodes.find((n) => n.id === nodeId);

		if (!(sourceNode && targetNode)) {
			return;
		}

		const sourceType = sourceNode.type || sourceNode.data?.type || "default";
		const targetType = targetNode.type || targetNode.data?.type || "default";

		// Check compatibility based on handle type
		if (connectionHandleType === "source" && type === "target") {
			const compatible = areNodeTypesCompatible(sourceType, targetType);
			setIsCompatible(compatible);
			return;
		}

		if (connectionHandleType === "target" && type === "source") {
			const compatible = areNodeTypesCompatible(targetType, sourceType);
			setIsCompatible(compatible);
		}
	}, [
		isDragActive,
		connectionNodeId,
		connectionHandleType,
		nodeId,
		type,
		reactFlowInstance,
	]);

	// Get styling
	const positionClass = getPositionClasses(position);
	const sizeClasses = getHandleSizeClasses("medium");

	const ConnectionIcon = connectionTypeIconMap[connectionType];

	// Get colors based on compatibility
	const getColors = (): ColorConfig => {
		if (isCompatible === false) {
			return {
				bg: "bg-red-500",
				border: "border-red-400",
				icon: "text-white",
				glow: "shadow-red-500/50",
			};
		}

		if (isCompatible === true) {
			return {
				bg: "bg-green-500",
				border: "border-green-400",
				icon: "text-white",
				glow: "shadow-green-500/50",
			};
		}

		return {
			bg: "bg-white",
			border: "border-gray-300",
			icon: "text-gray-700",
			glow: "shadow-gray-500/50",
		};
	};

	const colors = getColors();

	// Get tooltip text
	const getTooltipText = (): string => {
		if (isCompatible === false) {
			return "Incompatible connection";
		}
		if (isCompatible === true) {
			return "Compatible - drop to connect";
		}
		return `Connects to: ${compatibleTypes.join(", ")}`;
	};

	return (
		<Handle
			id={id}
			isConnectable={isConnectable && isCompatible !== false}
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
				className
			)}
			onMouseEnter={() => {
				setIsHovered(true);
				setIsNodeHovered(true);
			}}
			onMouseLeave={() => {
				setIsHovered(false);
				setTimeout(() => setIsNodeHovered(false), 100);
			}}
			ref={handleRef}
		>
			{/* Animated handle decorator */}
			<AnimatePresence>
				{isVisible && isConnectable && (
					<motion.div
						animate={{ scale: 1, opacity: 1 }}
						className="pointer-events-none relative"
						exit={{ scale: 0, opacity: 0 }}
						initial={{ scale: 0, opacity: 0 }}
						transition={{
							type: "spring",
							stiffness: 300,
							damping: 20,
						}}
					>
						{/* Main handle button */}
						<motion.div
							animate={
								isDragActive && isCompatible === true
									? {
											scale: [1, 1.15, 1],
											transition: {
												duration: 1,
												repeat: Number.POSITIVE_INFINITY,
												ease: "easeInOut",
											},
										}
									: {}
							}
							className={cn(
								sizeClasses.inner,
								"rounded-full",
								colors.bg,
								"border-2",
								colors.border,
								"flex items-center justify-center",
								"shadow-md",
								colors.glow,
								"transition-all duration-300"
							)}
							whileHover={{ scale: 1.1 }}
						>
							{/* Dynamic icon based on state */}
							{(() => {
								if (showCompatibilityIndicator && isCompatible === true) {
									return (
										<CheckCircle2
											className={cn(sizeClasses.icon, colors.icon)}
											strokeWidth={2.5}
										/>
									);
								}

								if (showCompatibilityIndicator && isCompatible === false) {
									return (
										<AlertCircle
											className={cn(sizeClasses.icon, colors.icon)}
											strokeWidth={2.5}
										/>
									);
								}

								return (
									<ConnectionIcon
										className={cn(
											sizeClasses.icon,
											colors.icon,
											"transition-transform duration-200",
											isHovered && "scale-110"
										)}
										strokeWidth={2.5}
									/>
								);
							})()}
						</motion.div>

						{/* Connection type badge */}
						{connectionType !== "single" && (
							<motion.div
								animate={{ scale: 1 }}
								className={cn(
									"-top-1 -right-1 absolute",
									"px-1.5 py-0.5",
									"rounded-full",
									"bg-purple-500",
									"text-white",
									"text-[10px]",
									"font-bold",
									"shadow-xs"
								)}
								initial={{ scale: 0 }}
							>
								{connectionType}
							</motion.div>
						)}

						{/* Compatibility ring when dragging */}
						{isDragActive && isCompatible !== null && (
							<motion.div
								animate={{
									scale: [1, 1.3, 1],
									opacity: [0.7, 0.3, 0.7],
								}}
								className={cn(
									"absolute inset-0 rounded-full border-2",
									isCompatible ? "border-green-400" : "border-red-400"
								)}
								transition={{
									duration: 1.5,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}}
							/>
						)}

						{/* Pulse indicator for compatible connections */}
						{isDragActive && isCompatible === true && (
							<>
								<motion.div
									animate={{
										scale: [1, 1.5, 1],
										opacity: [0.5, 0, 0.5],
									}}
									className="absolute inset-0 rounded-full border-2 border-green-400"
									transition={{
										duration: 1,
										repeat: Number.POSITIVE_INFINITY,
										ease: "easeOut",
									}}
								/>
								<motion.div
									animate={{
										scale: [1, 1.5, 1],
										opacity: [0.5, 0, 0.5],
									}}
									className="absolute inset-0 rounded-full border-2 border-green-400"
									transition={{
										duration: 1,
										repeat: Number.POSITIVE_INFINITY,
										ease: "easeOut",
										delay: 0.5,
									}}
								/>
							</>
						)}

						{/* Smart positioning indicator */}
						{smartPositioning && (
							<div
								className={cn(
									"-bottom-3 -translate-x-1/2 absolute left-1/2",
									"h-1 w-1 rounded-full bg-blue-500"
								)}
							/>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Tooltip showing compatible types */}
			{isHovered && compatibleTypes.length > 0 && (
				<AnimatePresence>
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className={cn(
							"absolute",
							"px-2 py-1",
							"bg-gray-900",
							"text-white",
							"text-xs",
							"rounded",
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
						{getTooltipText()}
					</motion.div>
				</AnimatePresence>
			)}
		</Handle>
	);
};

/**
 * Preset: Auto-hide Handle
 */
export const AutoHideHandle = (props: SmartHandleProps) => (
	<SmartHandle {...props} autoHide={true} showOnNodeHover={false} />
);

/**
 * Preset: Hover-show Handle
 */
export const HoverShowHandle = (props: SmartHandleProps) => (
	<SmartHandle {...props} autoHide={false} showOnNodeHover={true} />
);

/**
 * Preset: AND Gate Handle
 */
export const AndGateHandle = (props: SmartHandleProps) => (
	<SmartHandle {...props} connectionType="AND" />
);

/**
 * Preset: OR Gate Handle
 */
export const OrGateHandle = (props: SmartHandleProps) => (
	<SmartHandle {...props} connectionType="OR" />
);

/**
 * Preset: Smart Positioning Handle
 */
export const SmartPositionHandle = (props: SmartHandleProps) => (
	<SmartHandle {...props} smartPositioning={true} />
);

export default SmartHandle;
