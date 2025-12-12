/**
 * Edge Utilities
 *
 * Comprehensive utility functions for React Flow custom edges including
 * path calculation, gradient generation, animation helpers, label positioning,
 * and colour interpolation.
 *
 * @module edgeUtils
 */

// Regex patterns at module top level
const HEX_COLOR_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/**
 * Path Calculation Helpers
 */

type Position = {
	x: number;
	y: number;
};

/**
 * Calculate bezier curve path for smooth connections
 */
export function calculateBezierPath(
	source: Position,
	target: Position,
	curvature = 0.5
): string {
	const dx = target.x - source.x;
	const dy = target.y - source.y;

	// Control point offset based on distance and curvature
	const controlOffset = Math.max(Math.abs(dx), Math.abs(dy)) * curvature;

	return `M ${source.x},${source.y} C ${source.x + controlOffset},${source.y} ${target.x - controlOffset},${target.y} ${target.x},${target.y}`;
}

/**
 * Calculate smooth step path with rounded corners
 */
export function calculateSmoothStepPath(
	source: Position,
	target: Position,
	cornerRadius = 10
): string {
	const midX = (source.x + target.x) / 2;

	return `M ${source.x},${source.y} L ${midX - cornerRadius},${source.y} Q ${midX},${source.y} ${midX},${source.y + cornerRadius} L ${midX},${target.y - cornerRadius} Q ${midX},${target.y} ${midX + cornerRadius},${target.y} L ${target.x},${target.y}`;
}

/**
 * Calculate straight path with optional offset
 */
export function calculateStraightPath(
	source: Position,
	target: Position,
	offset = 0
): string {
	if (offset === 0) {
		return `M ${source.x},${source.y} L ${target.x},${target.y}`;
	}

	// Calculate perpendicular offset
	const angle = Math.atan2(target.y - source.y, target.x - source.x);
	const perpAngle = angle + Math.PI / 2;

	const offsetX = Math.cos(perpAngle) * offset;
	const offsetY = Math.sin(perpAngle) * offset;

	return `M ${source.x + offsetX},${source.y + offsetY} L ${target.x + offsetX},${target.y + offsetY}`;
}

/**
 * Get path length for animations
 */
export function getPathLength(pathString: string): number {
	if (typeof document === "undefined") {
		return 0;
	}

	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", pathString);
	svg.appendChild(path);

	return path.getTotalLength();
}

/**
 * Gradient Generation Functions
 */

/**
 * Generate gradient ID for edge
 */
export function generateGradientId(edgeId: string): string {
	return `edge-gradient-${edgeId}`;
}

type GradientStop = {
	offset: string;
	stopColor: string;
	stopOpacity: number;
};

/**
 * Create gradient stops from colours
 */
export function createGradientStops(
	colors: string[],
	positions: number[] | null = null
): GradientStop[] {
	const finalPositions =
		positions ?? colors.map((_, i) => i / (colors.length - 1));

	return colors.map((color, i) => ({
		offset: `${finalPositions[i] * 100}%`,
		stopColor: color,
		stopOpacity: 1,
	}));
}

type RgbColor = {
	r: number;
	g: number;
	b: number;
};

/**
 * Generate gradient based on node colours
 */
export function interpolateGradient(
	sourceColor: string,
	targetColor: string,
	steps = 3
): string[] {
	const source = hexToRgb(sourceColor);
	const target = hexToRgb(targetColor);

	if (!(source && target)) {
		return [sourceColor, targetColor];
	}

	const colors: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const ratio = i / steps;
		const r = Math.round(source.r + (target.r - source.r) * ratio);
		const g = Math.round(source.g + (target.g - source.g) * ratio);
		const b = Math.round(source.b + (target.b - source.b) * ratio);
		colors.push(rgbToHex(r, g, b));
	}

	return colors;
}

/**
 * Animation Timing Utilities
 */

type AnimationPreset = {
	duration: number;
	ease?: string | number[];
	type?: string;
	stiffness?: number;
	damping?: number;
};

/**
 * Animation presets for different edge behaviours
 */
export const animationPresets: Record<string, AnimationPreset> = {
	fast: {
		duration: 0.3,
		ease: "easeInOut",
	},
	normal: {
		duration: 0.6,
		ease: "easeInOut",
	},
	slow: {
		duration: 1.2,
		ease: "easeInOut",
	},
	bounce: {
		duration: 0.8,
		ease: [0.68, -0.55, 0.265, 1.55],
	},
	spring: {
		type: "spring",
		duration: 0.8,
		stiffness: 300,
		damping: 20,
	},
};

/**
 * Create dash array for animated edges
 */
export function createDashArray(pathLength: number, dashCount = 10): string {
	const dashLength = pathLength / dashCount / 2;
	return `${dashLength} ${dashLength}`;
}

type FlowAnimation = {
	strokeDashoffset: number[];
	transition: {
		duration: number;
		repeat: number;
		ease: string;
	};
};

/**
 * Get animation keyframes for flowing effect
 */
export function getFlowAnimation(speed = 1): FlowAnimation {
	return {
		strokeDashoffset: [0, -20],
		transition: {
			duration: 1 / speed,
			repeat: Number.POSITIVE_INFINITY,
			ease: "linear",
		},
	};
}

/**
 * Label Positioning Algorithms
 */

type LabelPosition = {
	x: number;
	y: number;
	angle: number;
};

/**
 * Calculate label position on edge
 */
export function calculateLabelPosition(
	source: Position,
	target: Position,
	position = 0.5
): LabelPosition {
	const x = source.x + (target.x - source.x) * position;
	const y = source.y + (target.y - source.y) * position;
	const angle =
		Math.atan2(target.y - source.y, target.x - source.x) * (180 / Math.PI);

	return { x, y, angle };
}

/**
 * Calculate label position on bezier curve
 */
export function calculateBezierLabelPosition(
	source: Position,
	target: Position,
	curvature = 0.5,
	t = 0.5
): Position {
	const dx = target.x - source.x;
	const dy = target.y - source.y;
	const controlOffset = Math.max(Math.abs(dx), Math.abs(dy)) * curvature;

	const p0 = source;
	const p1 = { x: source.x + controlOffset, y: source.y };
	const p2 = { x: target.x - controlOffset, y: target.y };
	const p3 = target;

	// Cubic bezier formula
	const x =
		(1 - t) ** 3 * p0.x +
		3 * (1 - t) ** 2 * t * p1.x +
		3 * (1 - t) * t ** 2 * p2.x +
		t ** 3 * p3.x;

	const y =
		(1 - t) ** 3 * p0.y +
		3 * (1 - t) ** 2 * t * p1.y +
		3 * (1 - t) * t ** 2 * p2.y +
		t ** 3 * p3.y;

	return { x, y };
}

/**
 * Edge Validation Functions
 */

type Node = {
	id: string;
	[key: string]: unknown;
};

type Edge = {
	source: string;
	target: string;
	[key: string]: unknown;
};

/**
 * Check if edge connection is valid
 */
export function validateEdge(edge: Edge, nodes: Node[]): boolean {
	if (!(edge.source && edge.target)) {
		return false;
	}

	const sourceNode = nodes.find((n) => n.id === edge.source);
	const targetNode = nodes.find((n) => n.id === edge.target);

	return !!(sourceNode && targetNode);
}

type ExcludeNodes = {
	source?: string;
	target?: string;
};

/**
 * Check for edge overlap with nodes
 */
export function checkPathOverlap(
	_pathString: string,
	_nodes: Node[],
	_exclude: ExcludeNodes = {}
): boolean {
	// Simplified overlap detection
	// In production, would use more sophisticated geometry checks
	return false; // Placeholder
}

/**
 * Colour Interpolation
 */

/**
 * Convert hex colour to RGB
 */
export function hexToRgb(hex: string): RgbColor | null {
	const result = HEX_COLOR_REGEX.exec(hex);
	return result
		? {
				r: Number.parseInt(result[1], 16),
				g: Number.parseInt(result[2], 16),
				b: Number.parseInt(result[3], 16),
			}
		: null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (value: number): string => {
		const hex = value.toString(16);
		return hex.length === 1 ? `0${hex}` : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpolate between two colours
 */
export function interpolateColor(
	color1: string,
	color2: string,
	ratio: number
): string {
	const c1 = hexToRgb(color1);
	const c2 = hexToRgb(color2);

	if (!(c1 && c2)) {
		return color1;
	}

	const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
	const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
	const b = Math.round(c1.b + (c2.b - c1.b) * ratio);

	return rgbToHex(r, g, b);
}

type EdgeState =
	| "active"
	| "inactive"
	| "error"
	| "success"
	| "warning"
	| "default";

/**
 * Get colour based on edge state
 */
export function getStateColor(state: EdgeState | string): string {
	const stateColors: Record<string, string> = {
		active: "#3b82f6", // blue-500
		inactive: "#6b7280", // gray-500
		error: "#ef4444", // red-500
		success: "#10b981", // green-500
		warning: "#f59e0b", // amber-500
		default: "#8b5cf6", // purple-500
	};

	return stateColors[state] ?? stateColors.default;
}

/**
 * Edge Styling Helpers
 */

/**
 * Get stroke width based on state
 */
export function getStrokeWidth(
	isHovered: boolean,
	isSelected: boolean,
	baseWidth = 2
): number {
	if (isSelected) {
		return baseWidth * 2;
	}
	if (isHovered) {
		return baseWidth * 1.5;
	}
	return baseWidth;
}

/**
 * Get marker end configuration
 */
export function getMarkerEnd(markerId: string, _color: string): string {
	return `url(#${markerId})`;
}

type MarkerConfig = {
	id: string;
	viewBox: string;
	refX: number;
	refY: number;
	markerWidth: number;
	markerHeight: number;
	orient: string;
	path: string;
	fill: string;
};

/**
 * Create arrow marker element
 */
export function createArrowMarker(id: string, color = "#999"): MarkerConfig {
	return {
		id,
		viewBox: "0 0 10 10",
		refX: 9,
		refY: 5,
		markerWidth: 6,
		markerHeight: 6,
		orient: "auto-start-reverse",
		path: "M 0 0 L 10 5 L 0 10 z",
		fill: color,
	};
}

/**
 * Performance Utilities
 */

type DebouncedFunction<T extends unknown[]> = (...args: T) => void;

/**
 * Debounce function for edge updates
 */
export function debounce<T extends unknown[]>(
	func: (...args: T) => void,
	wait: number
): DebouncedFunction<T> {
	let timeout: NodeJS.Timeout;
	return function executedFunction(...args: T) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function for animations
 */
export function throttle<T extends unknown[]>(
	func: (...args: T) => void,
	limit: number
): DebouncedFunction<T> {
	let inThrottle: boolean;
	return function executedFunction(...args: T) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

/**
 * Default export with all utilities
 */
export default {
	// Path calculations
	calculateBezierPath,
	calculateSmoothStepPath,
	calculateStraightPath,
	getPathLength,

	// Gradients
	generateGradientId,
	createGradientStops,
	interpolateGradient,

	// Animations
	animationPresets,
	createDashArray,
	getFlowAnimation,

	// Labels
	calculateLabelPosition,
	calculateBezierLabelPosition,

	// Validation
	validateEdge,
	checkPathOverlap,

	// Colours
	hexToRgb,
	rgbToHex,
	interpolateColor,
	getStateColor,

	// Styling
	getStrokeWidth,
	getMarkerEnd,
	createArrowMarker,

	// Performance
	debounce,
	throttle,
};
