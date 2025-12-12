"use client";

/**
 * Enhanced Custom Handle Component
 *
 * React Flow handle styled as a decorative + button, inspired by FloraFauna.ai.
 * Features include connection state indicators, validation feedback, drag preview,
 * connection count badges, pulse animations, and tooltips.
 *
 * @component
 */

import { AnimatePresence, motion } from "framer-motion";
import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { HandleProps, Node } from "reactflow";
import { Handle, Position, useReactFlow } from "reactflow";
import { cn } from "@/lib/utils";
import {
	getConnectionPercentage,
	getHandleColors,
	getHandleShapeClasses,
	getHandleSizeClasses,
	getPositionClasses,
	isHandleConnected,
} from "./handle-utils";

// ========================================================================
// Types
// ========================================================================

type ValidationState = {
	valid: boolean;
	message?: string;
};

type FlowPosition = {
	x: number;
	y: number;
};

type CustomHandleProps = Omit<HandleProps, "id"> & {
	type: "source" | "target";
	position: Position;
	nodeId: string;
	id?: string;
	isConnectable?: boolean;
	isConnected?: boolean;
	connectionCount?: number;
	maxConnections?: number;
	validation?: ValidationState | null;
	showBadge?: boolean;
	showPulse?: boolean;
	showTooltip?: boolean;
	tooltipText?: string;
	size?: "small" | "medium" | "large";
	shape?: "circle" | "square" | "diamond";
	variant?: "default" | "gradient";
	className?: string;
	onConnect?: (nodeId: string, handleId: string | undefined) => void;
	onHandleClick?: (
		nodeId: string,
		handleId: string | undefined,
		position: { x: number; y: number },
		nodeData?: Node["data"]
	) => void;
	nodeData?: Node["data"];
};

// ========================================================================
// Helper Functions
// ========================================================================

const getConnectionLimitColor = (percentage: number): string => {
	if (percentage >= 100) {
		return "bg-red-500";
	}
	if (percentage >= 75) {
		return "bg-orange-500";
	}
	return "bg-blue-500";
};

const getPulseRingColor = (isValid: boolean | undefined): string => {
	if (isValid === true) {
		return "border-green-400";
	}
	if (isValid === false) {
		return "border-red-400";
	}
	return "border-blue-400";
};

const getTooltipMessage = (
	customText: string,
	isAtLimit: boolean,
	maxConnections: number,
	isConnected: boolean,
	hasValidation: boolean,
	isValid: boolean | undefined,
	validationMessage: string | undefined,
	handleType: "source" | "target"
): string => {
	if (customText) {
		return customText;
	}
	if (isAtLimit) {
		return `Maximum connections reached (${maxConnections})`;
	}
	if (isConnected) {
		return "Connected - click to disconnect";
	}
	if (hasValidation && !isValid) {
		return validationMessage || "Invalid connection";
	}
	if (hasValidation && isValid) {
		return validationMessage || "Valid connection";
	}
	if (handleType === "source") {
		return "Click to create connection";
	}
	return "Connect here";
};

const getIconForState = (
	isConnected: boolean,
	hasValidation: boolean,
	isValid: boolean | undefined
) => {
	if (isConnected) {
		return Minus;
	}
	if (hasValidation && isValid === false) {
		return X;
	}
	if (hasValidation && isValid === true) {
		return Check;
	}
	return Plus;
};

const getVariantName = (
	isConnectable: boolean,
	isAtLimit: boolean,
	isDragging: boolean,
	shouldPulse: boolean,
	isHovered: boolean
): string => {
	if (!isConnectable || isAtLimit) {
		return "connected";
	}
	if (isDragging) {
		return "hover";
	}
	if (shouldPulse) {
		return "pulse";
	}
	if (isHovered) {
		return "hover";
	}
	return "visible";
};

const detectClick = (
	startTime: number | null,
	startPosition: FlowPosition | null,
	endX: number,
	endY: number
): boolean => {
	if (!(startTime && startPosition)) {
		return false;
	}
	const timeDiff = Date.now() - startTime;
	const distanceX = Math.abs(endX - startPosition.x);
	const distanceY = Math.abs(endY - startPosition.y);
	const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
	return timeDiff < 200 && distance < 5;
};

// Animation variants for framer-motion
const handleDecoratorVariants = {
	hidden: { scale: 0, opacity: 0 },
	visible: { scale: 1, opacity: 1 },
	hover: { scale: 1.1, opacity: 1 },
	pulse: {
		scale: [1, 1.05, 1],
		opacity: 1,
		transition: {
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut" as const,
		},
	},
	connected: { scale: 1, opacity: 1 },
};

// ========================================================================
// Sub-Components (extracted to reduce main component complexity)
// ========================================================================

type ConnectionBadgeProps = {
	count: number;
};

const ConnectionBadge = ({ count }: ConnectionBadgeProps) => (
	<motion.div
		animate={{ scale: 1 }}
		className={cn(
			"absolute",
			"-top-1 -right-1",
			"h-5 w-5",
			"rounded-full",
			"bg-blue-500",
			"border-2 border-white",
			"flex items-center justify-center",
			"font-semibold text-white text-xs",
			"shadow-xs"
		)}
		exit={{ scale: 0 }}
		initial={{ scale: 0 }}
	>
		{count}
	</motion.div>
);

type LimitIndicatorProps = {
	percentage: number;
};

const LimitIndicator = ({ percentage }: LimitIndicatorProps) => (
	<div
		className={cn(
			"-bottom-1 -translate-x-1/2 absolute left-1/2",
			"h-1 w-full",
			"overflow-hidden rounded-full bg-gray-200"
		)}
	>
		<motion.div
			animate={{ width: `${percentage}%` }}
			className={cn("h-full", getConnectionLimitColor(percentage))}
			initial={{ width: 0 }}
			transition={{ duration: 0.3 }}
		/>
	</div>
);

type PulseRingProps = {
	isValid: boolean | undefined;
};

const PulseRing = ({ isValid }: PulseRingProps) => (
	<motion.div
		animate={{
			scale: [1, 1.5, 1],
			opacity: [0.5, 0, 0.5],
		}}
		className={cn(
			"absolute inset-0 rounded-full border-2",
			getPulseRingColor(isValid)
		)}
		transition={{
			duration: 2,
			repeat: Number.POSITIVE_INFINITY,
			ease: "easeInOut",
		}}
	/>
);

const DragPreview = () => (
	<motion.div
		animate={{ scale: 1.2 }}
		className={cn(
			"absolute inset-0 rounded-full",
			"border-2 border-blue-500",
			"bg-blue-500/20"
		)}
		initial={{ scale: 1 }}
	/>
);

const getValidationRingClass = (
	hasValidation: boolean,
	isValid: boolean | undefined
): string => {
	if (hasValidation && isValid === false) {
		return "ring-2 ring-red-500/50";
	}
	if (hasValidation && isValid === true) {
		return "ring-2 ring-green-500/50";
	}
	return "";
};

const getDisabledClass = (
	isConnectable: boolean,
	isAtLimit: boolean
): string => {
	if (!isConnectable || isAtLimit) {
		return "cursor-not-allowed opacity-50";
	}
	return "";
};

type HandleTooltipProps = {
	position: Position;
	text: string;
};

const HandleTooltip = ({ position, text }: HandleTooltipProps) => (
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
		transition={{ duration: 0.2 }}
	>
		{text}
		<div
			className={cn(
				"-translate-x-1/2 absolute left-1/2",
				position === Position.Top && "-mt-1 top-0",
				position === Position.Bottom && "-mb-1 bottom-0 rotate-180",
				position === Position.Left && "-ml-1 -rotate-90 left-0",
				position === Position.Right && "-mr-1 right-0 rotate-90"
			)}
		>
			<div className="border-4 border-transparent border-t-gray-900" />
		</div>
	</motion.div>
);

// ========================================================================
// Main Component
// ========================================================================

const CustomHandle = ({
	type,
	position,
	nodeId,
	id,
	isConnectable = true,
	isConnected = false,
	connectionCount = 0,
	maxConnections = Number.POSITIVE_INFINITY,
	validation = null,
	showBadge = false,
	showPulse = true,
	showTooltip = true,
	tooltipText = "",
	size = "medium",
	shape = "circle",
	className = "",
	onHandleClick,
	nodeData,
	...props
}: CustomHandleProps) => {
	const [isHovered, setIsHovered] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [showTooltipState, setShowTooltipState] = useState(false);
	const [clickStartTime, setClickStartTime] = useState<number | null>(null);
	const [clickStartPosition, setClickStartPosition] =
		useState<FlowPosition | null>(null);
	const reactFlowInstance = useReactFlow();

	// Auto-detect connection state from React Flow
	useEffect(() => {
		if (reactFlowInstance && nodeId) {
			const edges = reactFlowInstance.getEdges();
			isHandleConnected(nodeId, id, edges, type);
		}
	}, [reactFlowInstance, nodeId, id, type]);

	// Clean up dragging state on global mouseup
	useEffect(() => {
		if (!isDragging) {
			return;
		}
		const handleGlobalMouseUp = () => setIsDragging(false);
		window.addEventListener("mouseup", handleGlobalMouseUp);
		return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
	}, [isDragging]);

	// Calculate derived states
	const actualConnectionCount = connectionCount || 0;
	const isAtLimit = actualConnectionCount >= maxConnections;
	const hasValidation = validation !== null;
	const isValid = validation?.valid;
	const shouldPulse = showPulse && !isConnected && isConnectable && !isAtLimit;
	const shouldShowBadge = showBadge && actualConnectionCount > 0;
	const percentage = getConnectionPercentage(
		actualConnectionCount,
		maxConnections
	);

	// Get dynamic styling
	const positionClass = getPositionClasses(position);
	const colors = getHandleColors(isConnected, isValid ?? null, isHovered);
	const sizeClasses = getHandleSizeClasses(size);
	const shapeClass = getHandleShapeClasses(shape);

	// Compute values using helper functions
	const Icon = getIconForState(isConnected, hasValidation, isValid);
	const animationVariant = getVariantName(
		isConnectable,
		isAtLimit,
		isDragging,
		shouldPulse,
		isHovered
	);
	const computedTooltipText = getTooltipMessage(
		tooltipText,
		isAtLimit,
		maxConnections,
		isConnected,
		hasValidation,
		isValid,
		validation?.message,
		type
	);

	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true);
		setClickStartTime(Date.now());
		setClickStartPosition({ x: e.clientX, y: e.clientY });
	};

	const handleMouseEnter = () => {
		setIsHovered(true);
		setShowTooltipState(true);
	};

	const handleMouseLeave = () => {
		setIsHovered(false);
		setShowTooltipState(false);
		setIsDragging(false);
		setClickStartTime(null);
		setClickStartPosition(null);
	};

	const handleMouseUp = (e: React.MouseEvent) => {
		setIsDragging(false);
		const isClick = detectClick(
			clickStartTime,
			clickStartPosition,
			e.clientX,
			e.clientY
		);

		if (isClick && onHandleClick && isConnectable && !isAtLimit) {
			const flowPosition = reactFlowInstance?.screenToFlowPosition({
				x: e.clientX,
				y: e.clientY,
			}) || { x: e.clientX, y: e.clientY };
			onHandleClick(nodeId, id, flowPosition, nodeData);
		}

		setClickStartTime(null);
		setClickStartPosition(null);
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
				"flex",
				"items-center",
				"justify-center",
				positionClass,
				"group/handle",
				"cursor-pointer",
				"z-10",
				getDisabledClass(isConnectable, isAtLimit),
				className
			)}
			onMouseDown={handleMouseDown}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onMouseUp={handleMouseUp}
		>
			<AnimatePresence>
				{isConnectable && (
					<motion.div
						animate={animationVariant}
						className="relative"
						exit="hidden"
						initial="visible"
						variants={handleDecoratorVariants}
					>
						<div
							className={cn(
								sizeClasses.inner,
								shapeClass,
								colors.bg,
								"border",
								colors.border,
								"flex",
								"items-center",
								"justify-center",
								"shadow-md",
								"transition-all",
								"duration-300",
								isHovered && "shadow-lg",
								getValidationRingClass(hasValidation, isValid)
							)}
						>
							<Icon
								className={cn(
									sizeClasses.icon,
									colors.icon,
									"transition-transform",
									"duration-200",
									isHovered && "scale-110"
								)}
								strokeWidth={2.5}
							/>
						</div>

						{shouldShowBadge && (
							<ConnectionBadge count={actualConnectionCount} />
						)}
						{maxConnections !== Number.POSITIVE_INFINITY && (
							<LimitIndicator percentage={percentage} />
						)}
						{shouldPulse && <PulseRing isValid={isValid} />}
						{isDragging && <DragPreview />}
					</motion.div>
				)}
			</AnimatePresence>

			{showTooltip && showTooltipState && isConnectable && (
				<AnimatePresence>
					<HandleTooltip position={position} text={computedTooltipText} />
				</AnimatePresence>
			)}
		</Handle>
	);
};

/**
 * CustomHandle with connection indicator
 */
export const CustomHandleWithIndicator = ({
	isConnected = false,
	...props
}: CustomHandleProps) => (
	<CustomHandle {...props} isConnected={isConnected} showBadge={isConnected} />
);

/**
 * Pulsing Handle - Continuously pulses to draw attention
 */
export const PulsingHandle = (props: CustomHandleProps) => (
	<CustomHandle {...props} showPulse={true} />
);

/**
 * Handle with tooltip
 */
export const CustomHandleWithTooltip = ({
	tooltip = "Click to connect",
	...props
}: CustomHandleProps & { tooltip?: string }) => (
	<CustomHandle {...props} showTooltip={true} tooltipText={tooltip} />
);

export default CustomHandle;
