/**
 * Handle Utilities
 *
 * Helper functions for React Flow handle components including position calculation,
 * connection validation, animation timing, state management, and style generation.
 *
 * @module handleUtils
 */

import type { Edge } from "reactflow";
import { Position } from "reactflow";

// ========================================================================
// Types
// ========================================================================

type NodeBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type HandlePosition = {
	x: number;
	y: number;
};

type ValidationResult = {
	valid: boolean;
	reason: string;
};

type ValidationRules = {
	checkDuplicates?: boolean;
	maxConnections?: number;
	allowedConnections?: Record<string, string[]>;
};

type NodeWithEdges = {
	id: string;
	type?: string;
	data?: {
		name?: string;
		type?: string;
	};
	edges?: Edge[];
	connectionCount?: number;
};

type HandleColors = {
	bg: string;
	border: string;
	icon: string;
	ring: string;
};

type HandleSizeClasses = {
	outer: string;
	inner: string;
	icon: string;
	offset: string;
};

type DebounceFunction = (...args: unknown[]) => void;

type ThrottleFunction = (...args: unknown[]) => void;

// ========================================================================
// Position Calculation Helpers
// ========================================================================

/**
 * Get CSS positioning classes based on handle position
 * @param position - React Flow position (Position.Top, Position.Bottom, etc.)
 * @returns CSS classes for positioning
 */
export const getPositionClasses = (position: Position): string => {
	const positionMap: Record<Position, string> = {
		[Position.Top]: "-top-6 left-1/2 -translate-x-1/2",
		[Position.Bottom]: "-bottom-6 left-1/2 -translate-x-1/2",
		[Position.Left]: "left-0 -translate-x-1/2 top-1/2 -translate-y-1/2",
		[Position.Right]: "right-0 translate-x-1/2 top-1/2 -translate-y-1/2",
	};

	return positionMap[position] || positionMap[Position.Bottom];
};

/**
 * Calculate absolute position coordinates for a handle
 * @param position - React Flow position
 * @param nodeBounds - Node bounding box {x, y, width, height}
 * @param offset - Offset distance from node edge
 * @returns Absolute coordinates {x, y}
 */
export const calculateHandlePosition = (
	position: Position,
	nodeBounds: NodeBounds,
	offset = 24
): HandlePosition => {
	const { x, y, width, height } = nodeBounds;

	switch (position) {
		case Position.Top:
			return { x: x + width / 2, y: y - offset };
		case Position.Bottom:
			return { x: x + width / 2, y: y + height + offset };
		case Position.Left:
			return { x: x - offset, y: y + height / 2 };
		case Position.Right:
			return { x: x + width + offset, y: y + height / 2 };
		default:
			return { x: x + width / 2, y: y + height + offset };
	}
};

/**
 * Check if two handles are overlapping
 * @param pos1 - First handle position {x, y}
 * @param pos2 - Second handle position {x, y}
 * @param threshold - Distance threshold for overlap detection
 * @returns True if overlapping
 */
export const areHandlesOverlapping = (
	pos1: HandlePosition,
	pos2: HandlePosition,
	threshold = 30
): boolean => {
	const dx = pos1.x - pos2.x;
	const dy = pos1.y - pos2.y;
	const distance = Math.sqrt(dx * dx + dy * dy);
	return distance < threshold;
};

/**
 * Adjust handle position to avoid overlaps
 * @param handlePos - Current handle position {x, y}
 * @param existingHandles - Array of existing handle positions
 * @param minDistance - Minimum distance between handles
 * @returns Adjusted position {x, y}
 */
export const adjustHandlePosition = (
	handlePos: HandlePosition,
	existingHandles: HandlePosition[],
	minDistance = 40
): HandlePosition => {
	const adjusted = { ...handlePos };
	let hasOverlap = true;
	let attempts = 0;
	const maxAttempts = 10;

	while (hasOverlap && attempts < maxAttempts) {
		hasOverlap = false;

		for (const existing of existingHandles) {
			if (areHandlesOverlapping(adjusted, existing, minDistance)) {
				hasOverlap = true;
				// Shift position slightly
				adjusted.y += 15;
				break;
			}
		}

		attempts++;
	}

	return adjusted;
};

// ========================================================================
// Connection Validation Functions
// ========================================================================

/**
 * Validate if a connection is allowed between two nodes
 * @param source - Source node data
 * @param target - Target node data
 * @param rules - Validation rules
 * @returns Validation result {valid: boolean, reason: string}
 */
export const validateConnection = (
	source: NodeWithEdges,
	target: NodeWithEdges,
	rules: ValidationRules = {}
): ValidationResult => {
	// Prevent self-connection
	if (source.id === target.id) {
		return { valid: false, reason: "Cannot connect node to itself" };
	}

	// Prevent duplicate connections
	if (rules.checkDuplicates && source.edges) {
		const isDuplicate = source.edges.some((edge) => edge.target === target.id);
		if (isDuplicate) {
			return { valid: false, reason: "Connection already exists" };
		}
	}

	// Check connection limit
	if (
		rules.maxConnections &&
		source.connectionCount &&
		source.connectionCount >= rules.maxConnections
	) {
		return {
			valid: false,
			reason: `Maximum ${rules.maxConnections} connections reached`,
		};
	}

	// Check node type compatibility
	if (rules.allowedConnections) {
		const sourceType = source.type || "default";
		const targetType = target.type || "default";
		const allowed = rules.allowedConnections[sourceType];

		if (allowed && !allowed.includes(targetType)) {
			return {
				valid: false,
				reason: `${sourceType} cannot connect to ${targetType}`,
			};
		}
	}

	return { valid: true, reason: "" };
};

/**
 * Check if node types are compatible for connection
 * @param sourceType - Source node type
 * @param targetType - Target node type
 * @returns True if compatible
 */
export const areNodeTypesCompatible = (
	sourceType: string,
	targetType: string
): boolean => {
	// Assurance case node type compatibility rules
	const compatibilityRules: Record<string, string[]> = {
		goal: ["strategy", "context"],
		strategy: ["goal", "propertyClaim", "evidence"],
		propertyClaim: ["evidence", "strategy"],
		evidence: [], // Evidence nodes are typically leaf nodes
		context: [], // Context nodes don't have outgoing connections
	};

	const normalizedSource = sourceType?.toLowerCase().replace(/[-_\s]/g, "");
	const normalizedTarget = targetType?.toLowerCase().replace(/[-_\s]/g, "");

	const allowed = compatibilityRules[normalizedSource] || [];
	return allowed.includes(normalizedTarget);
};

/**
 * Get connection validation message
 * @param source - Source node
 * @param target - Target node
 * @returns Validation message
 */
export const getConnectionHint = (
	source: NodeWithEdges,
	target: NodeWithEdges
): string => {
	const validation = validateConnection(source, target);

	if (validation.valid) {
		return `Connect ${source.data?.name || "node"} to ${target.data?.name || "node"}`;
	}

	return validation.reason;
};

// ========================================================================
// Animation Timing Utilities
// ========================================================================

/**
 * Debounce function for rapid state changes
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = (
	func: DebounceFunction,
	wait = 100
): DebounceFunction => {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	return function executedFunction(...args: unknown[]) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

/**
 * Throttle function for animation frame optimization
 * @param func - Function to throttle
 * @param limit - Minimum time between calls
 * @returns Throttled function
 */
export const throttle = (
	func: ThrottleFunction,
	limit = 16
): ThrottleFunction => {
	let inThrottle: boolean;
	return function executedFunction(...args: unknown[]) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
};

/**
 * Request animation frame with fallback
 * @param callback - Animation callback
 * @returns Animation frame ID
 */
export const requestAnimFrame = (callback: FrameRequestCallback): number =>
	(
		window.requestAnimationFrame ||
		(
			window as typeof window & {
				webkitRequestAnimationFrame?: typeof requestAnimationFrame;
			}
		).webkitRequestAnimationFrame ||
		(
			window as typeof window & {
				mozRequestAnimationFrame?: typeof requestAnimationFrame;
			}
		).mozRequestAnimationFrame ||
		((cb: FrameRequestCallback) =>
			window.setTimeout(() => cb(Date.now()), 1000 / 60))
	)(callback);

/**
 * Get optimal animation duration based on distance
 * @param distance - Distance to travel
 * @param baseSpeed - Base speed in pixels per millisecond
 * @returns Animation duration in milliseconds
 */
export const calculateAnimationDuration = (
	distance: number,
	baseSpeed = 0.5
): number => {
	const minDuration = 200;
	const maxDuration = 800;
	const duration = distance / baseSpeed;
	return Math.max(minDuration, Math.min(maxDuration, duration));
};

// ========================================================================
// State Management Helpers
// ========================================================================

/**
 * Get connection count for a node
 * @param nodeId - Node identifier
 * @param edges - Array of edges
 * @param handleType - 'source' or 'target'
 * @returns Connection count
 */
export const getConnectionCount = (
	nodeId: string,
	edges: Edge[],
	handleType: "source" | "target" = "source"
): number => {
	if (!(edges && nodeId)) {
		return 0;
	}

	return edges.filter((edge) => {
		if (handleType === "source") {
			return edge.source === nodeId;
		}
		return edge.target === nodeId;
	}).length;
};

/**
 * Check if handle is connected
 * @param nodeId - Node identifier
 * @param handleId - Handle identifier
 * @param edges - Array of edges
 * @param handleType - 'source' or 'target'
 * @returns True if connected
 */
export const isHandleConnected = (
	nodeId: string,
	handleId: string | undefined,
	edges: Edge[],
	handleType: "source" | "target" = "source"
): boolean => {
	if (!(edges && nodeId)) {
		return false;
	}

	return edges.some((edge) => {
		if (handleType === "source") {
			return (
				edge.source === nodeId && (!handleId || edge.sourceHandle === handleId)
			);
		}
		return (
			edge.target === nodeId && (!handleId || edge.targetHandle === handleId)
		);
	});
};

/**
 * Get all edges connected to a handle
 * @param nodeId - Node identifier
 * @param handleId - Handle identifier (optional)
 * @param edges - Array of edges
 * @param handleType - 'source' or 'target'
 * @returns Connected edges
 */
export const getConnectedEdges = (
	nodeId: string,
	handleId: string | undefined,
	edges: Edge[],
	handleType: "source" | "target" = "source"
): Edge[] => {
	if (!(edges && nodeId)) {
		return [];
	}

	return edges.filter((edge) => {
		if (handleType === "source") {
			return (
				edge.source === nodeId && (!handleId || edge.sourceHandle === handleId)
			);
		}
		return (
			edge.target === nodeId && (!handleId || edge.targetHandle === handleId)
		);
	});
};

/**
 * Calculate connection limit percentage
 * @param currentCount - Current connection count
 * @param maxCount - Maximum allowed connections
 * @returns Percentage (0-100)
 */
export const getConnectionPercentage = (
	currentCount: number,
	maxCount: number
): number => {
	if (maxCount === 0 || maxCount === Number.POSITIVE_INFINITY) {
		return 0;
	}
	return Math.min(100, (currentCount / maxCount) * 100);
};

// ========================================================================
// Style Generation Functions
// ========================================================================

/**
 * Generate handle color based on connection state
 * @param isConnected - Whether handle is connected
 * @param isValid - Whether pending connection is valid
 * @param isHovered - Whether handle is hovered
 * @returns Color configuration
 */
export const getHandleColors = (
	isConnected: boolean,
	isValid: boolean | null,
	isHovered: boolean
): HandleColors => {
	if (isConnected) {
		return {
			bg: "bg-blue-500",
			border: "border-blue-400",
			icon: "text-white",
			ring: "ring-blue-500/50",
		};
	}

	if (isValid === false) {
		return {
			bg: "bg-red-500",
			border: "border-red-400",
			icon: "text-white",
			ring: "ring-red-500/50",
		};
	}

	if (isValid === true) {
		return {
			bg: "bg-green-500",
			border: "border-green-400",
			icon: "text-white",
			ring: "ring-green-500/50",
		};
	}

	// Default state
	return {
		bg: isHovered ? "bg-white" : "bg-white",
		border: isHovered ? "border-gray-400" : "border-gray-300",
		icon: "text-gray-700",
		ring: "ring-gray-500/50",
	};
};

/**
 * Generate handle size classes based on variant
 * @param size - Size variant ('small', 'medium', 'large')
 * @returns Size classes
 */
export const getHandleSizeClasses = (
	size: "small" | "medium" | "large" = "medium"
): HandleSizeClasses => {
	const sizeMap: Record<string, HandleSizeClasses> = {
		small: {
			outer: "w-8 h-8",
			inner: "w-6 h-6",
			icon: "w-3 h-3",
			offset: "top-4",
		},
		medium: {
			outer: "w-12 h-12",
			inner: "w-8 h-8",
			icon: "w-4 h-4",
			offset: "top-6",
		},
		large: {
			outer: "w-16 h-16",
			inner: "w-12 h-12",
			icon: "w-6 h-6",
			offset: "top-8",
		},
	};

	return sizeMap[size] || sizeMap.medium;
};

/**
 * Generate handle shape classes
 * @param shape - Shape variant ('circle', 'square', 'diamond')
 * @returns Shape classes
 */
export const getHandleShapeClasses = (
	shape: "circle" | "square" | "diamond" = "circle"
): string => {
	const shapeMap: Record<string, string> = {
		circle: "rounded-full",
		square: "rounded-md",
		diamond: "rounded-sm rotate-45",
	};

	return shapeMap[shape] || shapeMap.circle;
};

/**
 * Generate gradient background classes
 * @param type - Gradient type ('blue', 'green', 'purple', etc.)
 * @returns Gradient classes
 */
export const getGradientClasses = (type = "default"): string => {
	const gradientMap: Record<string, string> = {
		default: "bg-gradient-to-br from-gray-200 to-gray-300",
		blue: "bg-gradient-to-br from-blue-400 to-blue-600",
		green: "bg-gradient-to-br from-green-400 to-green-600",
		purple: "bg-gradient-to-br from-purple-400 to-purple-600",
		orange: "bg-gradient-to-br from-orange-400 to-orange-600",
		cyan: "bg-gradient-to-br from-cyan-400 to-cyan-600",
	};

	return gradientMap[type] || gradientMap.default;
};

/**
 * Generate shadow classes based on intensity
 * @param intensity - Shadow intensity ('subtle', 'medium', 'strong')
 * @returns Shadow classes
 */
export const getShadowClasses = (
	intensity: "subtle" | "medium" | "strong" = "medium"
): string => {
	const shadowMap: Record<string, string> = {
		subtle: "shadow-sm",
		medium: "shadow-md",
		strong: "shadow-lg",
	};

	return shadowMap[intensity] || shadowMap.medium;
};

// ========================================================================
// Export All Utilities
// ========================================================================

export default {
	// Position helpers
	getPositionClasses,
	calculateHandlePosition,
	areHandlesOverlapping,
	adjustHandlePosition,

	// Connection validation
	validateConnection,
	areNodeTypesCompatible,
	getConnectionHint,

	// Animation timing
	debounce,
	throttle,
	requestAnimFrame,
	calculateAnimationDuration,

	// State management
	getConnectionCount,
	isHandleConnected,
	getConnectedEdges,
	getConnectionPercentage,

	// Style generation
	getHandleColors,
	getHandleSizeClasses,
	getHandleShapeClasses,
	getGradientClasses,
	getShadowClasses,
};
