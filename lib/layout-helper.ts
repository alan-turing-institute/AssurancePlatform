/**
 * ELK Layout Helper
 *
 * Provides hierarchical layout for React Flow graphs using ELK (Eclipse Layout Kernel).
 * Replaces Dagre for improved edge routing and configurable node placement.
 *
 * @module layout-helper
 */

import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "reactflow";
import { compareIdentifiers } from "@/lib/identifier-utils";

const elk = new ELK();

/**
 * Fixed width for all nodes - only height changes on expand
 */
const NODE_WIDTH = 320;

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
	goal: { width: NODE_WIDTH, height: 120 },
	strategy: { width: NODE_WIDTH, height: 110 },
	property: { width: NODE_WIDTH, height: 100 },
	propertyClaim: { width: NODE_WIDTH, height: 100 },
	evidence: { width: NODE_WIDTH, height: 90 },
	default: { width: NODE_WIDTH, height: 110 },
};

/**
 * Get default dimensions for a node type
 */
function getDefaultDimensions(nodeType: string | undefined): {
	width: number;
	height: number;
} {
	return NODE_DIMENSIONS[nodeType || "default"] || NODE_DIMENSIONS.default;
}

/**
 * Read actual dimensions from DOM element
 */
function getDomDimensions(
	nodeId: string
): { width: number; height: number } | null {
	if (typeof document === "undefined") {
		return null;
	}

	const nodeElement = document.querySelector(
		`[data-id="${nodeId}"]`
	) as HTMLElement | null;

	if (!nodeElement) {
		return null;
	}

	const rect = nodeElement.getBoundingClientRect();
	if (rect.width > 0 && rect.height > 0) {
		return { width: rect.width, height: rect.height };
	}

	return null;
}

/**
 * Get actual dimensions for a node, preferring DOM measurements
 */
function getActualNodeDimensions(
	node: Node & { measured?: { width?: number; height?: number } }
): { width: number; height: number } {
	// Try DOM dimensions first (most accurate for expanded nodes)
	const domDimensions = getDomDimensions(node.id);
	if (domDimensions) {
		return domDimensions;
	}

	// Try React Flow measured dimensions
	if (node.measured?.width && node.measured?.height) {
		return { width: node.measured.width, height: node.measured.height };
	}

	// Fall back to defaults
	return getDefaultDimensions(node.type);
}

/**
 * Direction mapping from React Flow convention to ELK
 */
type LayoutDirection = "TB" | "LR" | "RL" | "BT";
type ElkDirection = "DOWN" | "RIGHT" | "LEFT" | "UP";

const DIRECTION_MAP: Record<LayoutDirection, ElkDirection> = {
	TB: "DOWN",
	LR: "RIGHT",
	RL: "LEFT",
	BT: "UP",
};

type LayoutOptions = {
	direction: LayoutDirection;
};

type LayoutedElements = {
	nodes: Node[];
	edges: Edge[];
};

/**
 * Generates a layout for the given nodes and edges using ELK's layered algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a hierarchical
 * layout with orthogonal edge routing, and returns the nodes with updated positions.
 * Hidden nodes and edges are ignored during layout computation but retained in the output.
 *
 * @param {Node[]} nodes - An array of node objects representing the graph nodes.
 * @param {Edge[]} edges - An array of edge objects representing the graph edges.
 * @param {LayoutOptions} options - Layout options for the graph.
 * @param {string} options.direction - The layout direction: 'TB', 'LR', 'RL', or 'BT'.
 * @returns {Promise<LayoutedElements>} An object containing the nodes with updated positions and the original edges.
 */
export async function getLayoutedElements(
	nodes: Node[],
	edges: Edge[],
	options: LayoutOptions
): Promise<LayoutedElements> {
	const direction = options.direction || "TB";
	const elkDirection = DIRECTION_MAP[direction] || "DOWN";

	// Filter out hidden nodes and edges for the layout computation
	const visibleNodes = nodes.filter(
		(node) => !(node as Node & { hidden?: boolean }).hidden
	);
	const visibleEdges = edges.filter(
		(edge) => !(edge as Edge & { hidden?: boolean }).hidden
	);

	// Filter edges whose source or target is hidden (prevents ELK "Referenced shape does not exist" error)
	const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
	const validEdges = visibleEdges.filter(
		(edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
	);

	// If no visible nodes, return early
	if (visibleNodes.length === 0) {
		return { nodes, edges };
	}

	// Sort visible nodes by identifier to ensure consistent left-to-right ordering
	// (e.g., S1 appears left of S2, P1 appears left of P2)
	const sortedVisibleNodes = [...visibleNodes].sort((a, b) => {
		const aName = (a.data?.name as string) || "";
		const bName = (b.data?.name as string) || "";
		return compareIdentifiers(aName, bName);
	});

	// Build ELK graph children with actual dimensions (using sorted order)
	const elkChildren = sortedVisibleNodes.map((node) => {
		const dimensions = getActualNodeDimensions(
			node as Node & { measured?: { width?: number; height?: number } }
		);
		return {
			id: node.id,
			width: dimensions.width,
			height: dimensions.height,
		};
	});

	// Build ELK graph structure
	const elkGraph = {
		id: "root",
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": elkDirection,
			// Spacing between nodes in the same layer (horizontal for TB direction)
			"elk.spacing.nodeNode": "40",
			// Spacing between layers (vertical for TB direction)
			"elk.layered.spacing.nodeNodeBetweenLayers": "60",
			// Edge routing
			"elk.edgeRouting": "ORTHOGONAL",
			// Node placement strategy
			"elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
			"elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
			"elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
			// Ensure nodes don't overlap by considering their actual sizes
			"elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
			// Force node order to match model order (sorted by identifier)
			"elk.layered.crossingMinimization.forceNodeModelOrder": "true",
		},
		children: elkChildren,
		edges: validEdges.map((edge) => ({
			id: edge.id,
			sources: [edge.source],
			targets: [edge.target],
		})),
	};

	// Compute layout
	const layoutedGraph = await elk.layout(elkGraph);

	// Create a map of new positions
	const positionMap = new Map<string, { x: number; y: number }>();
	for (const child of layoutedGraph.children || []) {
		if (child.x !== undefined && child.y !== undefined) {
			positionMap.set(child.id, { x: child.x, y: child.y });
		}
	}

	// Apply positions to nodes (only visible nodes get new positions)
	const layoutedNodes = nodes.map((node) => {
		const newPosition = positionMap.get(node.id);
		if (newPosition) {
			return {
				...node,
				position: newPosition,
			};
		}
		return node;
	});

	return {
		nodes: layoutedNodes,
		edges,
	};
}
