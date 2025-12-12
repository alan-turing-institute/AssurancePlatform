/**
 * Node Creation Utilities
 *
 * Utility functions for node creation workflow including ID generation,
 * position calculation, validation, and smart positioning algorithms.
 *
 * @module creationUtils
 */

import type { Node, ReactFlowInstance } from "reactflow";
import { createNodeData, nodeTypeMetadata } from "../nodes/node-types";

type Position = {
	x: number;
	y: number;
};

type NodeSize = {
	width: number;
	height: number;
};

type ValidationResult = {
	valid: boolean;
	error: string | null;
};

type ConnectionHint = {
	nodeId: string;
	nodeName: string;
	direction: string;
	distance: number;
};

type NodeTemplate = {
	id: string;
	name: string;
	description: string;
	nodes: Array<{
		type: string;
		name: string;
		offsetX?: number;
		offsetY?: number;
	}>;
};

type CreationPreferences = {
	gridSnap: boolean;
	autoConnect: boolean;
	quickCreateEnabled: boolean;
	defaultNodeType: string;
};

/**
 * Generate a unique node ID
 */
export const generateNodeId = (nodeType: string): string => {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 7);
	return `${nodeType}-${timestamp}-${random}`;
};

/**
 * Convert screen coordinates to React Flow coordinates
 */
export const screenToFlowPosition = (
	screenPosition: Position,
	reactFlowInstance: ReactFlowInstance
): Position => {
	if (!reactFlowInstance) {
		return screenPosition;
	}

	const flowPosition = reactFlowInstance.screenToFlowPosition({
		x: screenPosition.x,
		y: screenPosition.y,
	});

	return flowPosition;
};

/**
 * Snap position to grid
 */
export const snapToGrid = (position: Position, gridSize = 20): Position => ({
	x: Math.round(position.x / gridSize) * gridSize,
	y: Math.round(position.y / gridSize) * gridSize,
});

/**
 * Calculate distance between two points
 */
export const calculateDistance = (
	point1: Position,
	point2: Position
): number => {
	const dx = point2.x - point1.x;
	const dy = point2.y - point1.y;
	return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if position overlaps with existing nodes
 */
export const checkPositionOverlap = (
	position: Position,
	nodes: Node[],
	nodeSize: NodeSize = { width: 300, height: 150 },
	padding = 20
): boolean =>
	nodes.some((node) => {
		const nodeWidth = node.width || nodeSize.width;
		const nodeHeight = node.height || nodeSize.height;

		const overlapX =
			position.x < node.position.x + nodeWidth + padding &&
			position.x + nodeSize.width + padding > node.position.x;

		const overlapY =
			position.y < node.position.y + nodeHeight + padding &&
			position.y + nodeSize.height + padding > node.position.y;

		return overlapX && overlapY;
	});

/**
 * Find nearest non-overlapping position
 */
export const findNonOverlappingPosition = (
	desiredPosition: Position,
	nodes: Node[],
	nodeSize: NodeSize = { width: 300, height: 150 },
	maxAttempts = 20
): Position => {
	let position = { ...desiredPosition };

	// If no overlap at desired position, use it
	if (!checkPositionOverlap(position, nodes, nodeSize)) {
		return position;
	}

	// Try positions in a spiral pattern
	const step = 50;
	let attempt = 0;
	let radius = step;
	let angle = 0;

	while (attempt < maxAttempts) {
		// Calculate position on spiral
		position = {
			x: desiredPosition.x + radius * Math.cos(angle),
			y: desiredPosition.y + radius * Math.sin(angle),
		};

		if (!checkPositionOverlap(position, nodes, nodeSize)) {
			return position;
		}

		// Move to next position on spiral
		angle += Math.PI / 4; // 45 degrees
		if (angle >= 2 * Math.PI) {
			angle = 0;
			radius += step;
		}

		attempt++;
	}

	// If all attempts failed, return position far from existing nodes
	return {
		x: desiredPosition.x + radius + step,
		y: desiredPosition.y,
	};
};

/**
 * Calculate smart position based on connected nodes
 */
export const calculateSmartPosition = (
	sourceNodes: Node[],
	allNodes: Node[],
	direction: "bottom" | "right" | "auto" = "auto"
): Position => {
	if (!sourceNodes || sourceNodes.length === 0) {
		// No source nodes, return center position
		return { x: 100, y: 100 };
	}

	// Calculate average position of source nodes
	const avgPosition = sourceNodes.reduce(
		(acc, node) => ({
			x: acc.x + node.position.x / sourceNodes.length,
			y: acc.y + node.position.y / sourceNodes.length,
		}),
		{ x: 0, y: 0 }
	);

	const nodeSize = { width: 300, height: 150 };
	const spacing = 200;

	let calculatedPosition: Position;

	if (direction === "bottom") {
		calculatedPosition = {
			x: avgPosition.x,
			y: avgPosition.y + spacing,
		};
	} else if (direction === "right") {
		calculatedPosition = {
			x: avgPosition.x + spacing,
			y: avgPosition.y,
		};
	} else {
		// Determine best direction based on available space
		const bottomPosition = {
			x: avgPosition.x,
			y: avgPosition.y + spacing,
		};
		const rightPosition = {
			x: avgPosition.x + spacing,
			y: avgPosition.y,
		};

		const bottomOverlap = checkPositionOverlap(
			bottomPosition,
			allNodes,
			nodeSize
		);
		const rightOverlap = checkPositionOverlap(
			rightPosition,
			allNodes,
			nodeSize
		);

		if (!bottomOverlap) {
			calculatedPosition = bottomPosition;
		} else if (rightOverlap) {
			calculatedPosition = bottomPosition;
		} else {
			calculatedPosition = rightPosition;
		}
	}

	// Ensure final position doesn't overlap
	return findNonOverlappingPosition(calculatedPosition, allNodes, nodeSize);
};

/**
 * Get default node data for a type
 */
export const getDefaultNodeData = (
	nodeType: string,
	customData: Record<string, unknown> = {}
) =>
	createNodeData(nodeType, {
		...customData,
		createdAt: new Date().toISOString(),
	});

/**
 * Create a complete node object
 */
export const createNodeObject = (
	nodeType: string,
	position: Position,
	customData: Record<string, unknown> = {}
): Node => {
	const id = generateNodeId(nodeType);
	const data = getDefaultNodeData(nodeType, { id, ...customData });

	return {
		id,
		type: nodeType,
		position,
		data,
	};
};

/**
 * Get recently used node types from history
 */
export const getRecentNodeTypes = (
	creationHistory: string[] = [],
	maxRecent = 3
): string[] => {
	const uniqueTypes = [...new Set(creationHistory)];
	return uniqueTypes.slice(-maxRecent).reverse();
};

/**
 * Validate node creation
 */
export const validateNodeCreation = (
	nodeType: string,
	position: Position,
	_existingNodes: Node[]
): ValidationResult => {
	// Check if node type is valid
	const validTypes = Object.keys(nodeTypeMetadata);
	if (!validTypes.includes(nodeType)) {
		return {
			valid: false,
			error: `Invalid node type: ${nodeType}`,
		};
	}

	// Check if position is valid
	if (
		!position ||
		typeof position.x !== "number" ||
		typeof position.y !== "number"
	) {
		return {
			valid: false,
			error: "Invalid position: must have numeric x and y coordinates",
		};
	}

	// Check for extreme positions
	if (
		position.x < -10_000 ||
		position.x > 10_000 ||
		position.y < -10_000 ||
		position.y > 10_000
	) {
		return {
			valid: false,
			error: "Position out of bounds",
		};
	}

	return {
		valid: true,
		error: null,
	};
};

/**
 * Calculate connection hints for new node
 */
export const calculateConnectionHints = (
	newNodePosition: Position,
	existingNodes: Node[],
	maxDistance = 300
): ConnectionHint[] => {
	return existingNodes
		.map((node) => {
			const distance = calculateDistance(newNodePosition, node.position);
			const dx = newNodePosition.x - node.position.x;
			const dy = newNodePosition.y - node.position.y;

			let direction = "none";
			if (Math.abs(dx) > Math.abs(dy)) {
				direction = dx > 0 ? "right" : "left";
			} else {
				direction = dy > 0 ? "bottom" : "top";
			}

			return {
				nodeId: node.id,
				nodeName: (node.data?.name as string) || "Unnamed",
				direction,
				distance,
			};
		})
		.filter((hint) => hint.distance <= maxDistance)
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 5); // Top 5 closest nodes
};

/**
 * Get node creation templates
 */
export const getNodeTemplates = (): NodeTemplate[] => [
	{
		id: "simple-goal",
		name: "Simple Goal",
		description: "Single goal with strategy",
		nodes: [
			{ type: "goal", name: "Main Goal" },
			{ type: "strategy", name: "Decomposition Strategy", offsetY: 150 },
		],
	},
	{
		id: "evidence-chain",
		name: "Evidence Chain",
		description: "Claim with supporting evidence",
		nodes: [
			{ type: "propertyClaim", name: "Property Claim" },
			{ type: "evidence", name: "Supporting Evidence", offsetY: 150 },
		],
	},
	{
		id: "context-pattern",
		name: "Context Pattern",
		description: "Goal with context",
		nodes: [
			{ type: "goal", name: "Goal" },
			{ type: "context", name: "Context/Assumption", offsetX: 200 },
		],
	},
];

/**
 * Storage keys for persistence
 */
export const STORAGE_KEYS = {
	RECENT_TYPES: "tea_node_creation_recent_types",
	PREFERENCES: "tea_node_creation_preferences",
};

/**
 * Save recent node types to local storage
 */
export const saveRecentTypes = (recentTypes: string[]): void => {
	try {
		localStorage.setItem(
			STORAGE_KEYS.RECENT_TYPES,
			JSON.stringify(recentTypes)
		);
	} catch (error) {
		console.warn("Failed to save recent node types:", error);
	}
};

/**
 * Load recent node types from local storage
 */
export const loadRecentTypes = (): string[] => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TYPES);
		return stored ? JSON.parse(stored) : [];
	} catch (error) {
		console.warn("Failed to load recent node types:", error);
		return [];
	}
};

/**
 * Save creation preferences
 */
export const saveCreationPreferences = (
	preferences: CreationPreferences
): void => {
	try {
		localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
	} catch (error) {
		console.warn("Failed to save creation preferences:", error);
	}
};

/**
 * Load creation preferences
 */
export const loadCreationPreferences = (): CreationPreferences => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
		return stored
			? JSON.parse(stored)
			: {
					gridSnap: true,
					autoConnect: false,
					quickCreateEnabled: true,
					defaultNodeType: "goal",
				};
	} catch (error) {
		console.warn("Failed to load creation preferences:", error);
		return {
			gridSnap: true,
			autoConnect: false,
			quickCreateEnabled: true,
			defaultNodeType: "goal",
		};
	}
};

/**
 * Debounce function for double-click detection
 */
export const debounce = <T extends (...args: unknown[]) => void>(
	func: T,
	wait: number
): ((...args: Parameters<T>) => void) => {
	let timeout: NodeJS.Timeout | undefined;
	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

export default {
	generateNodeId,
	screenToFlowPosition,
	snapToGrid,
	calculateDistance,
	checkPositionOverlap,
	findNonOverlappingPosition,
	calculateSmartPosition,
	getDefaultNodeData,
	createNodeObject,
	getRecentNodeTypes,
	validateNodeCreation,
	calculateConnectionHints,
	getNodeTemplates,
	saveRecentTypes,
	loadRecentTypes,
	saveCreationPreferences,
	loadCreationPreferences,
	debounce,
};
