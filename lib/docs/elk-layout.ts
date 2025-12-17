/**
 * ELK Layout Module
 *
 * Provides hierarchical layout for React Flow graphs using ELK (Eclipse Layout Kernel).
 * Replaces Dagre for curriculum case viewers.
 *
 * @module elk-layout
 */

import ELK from "elkjs/lib/elk.bundled.js";
import type { Edge, Node } from "reactflow";

const elk = new ELK();

/**
 * Node dimension configurations based on node type.
 * Matches the previous Dagre configuration for consistency.
 */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
	goal: { width: 260, height: 110 },
	strategy: { width: 250, height: 90 },
	propertyClaim: { width: 240, height: 80 },
	evidence: { width: 220, height: 70 },
	default: { width: 250, height: 100 },
};

/**
 * Get dimensions for a node type
 */
function getNodeDimensions(nodeType: string | undefined): {
	width: number;
	height: number;
} {
	return NODE_DIMENSIONS[nodeType || "default"] || NODE_DIMENSIONS.default;
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
	direction?: LayoutDirection;
};

type LayoutedElements<N extends Node = Node, E extends Edge = Edge> = {
	nodes: N[];
	edges: E[];
};

/**
 * Generates a layout for the given nodes and edges using ELK's layered algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a hierarchical
 * layout with orthogonal edge routing, and returns the nodes with updated positions.
 * Hidden nodes and edges are ignored during layout computation but retained in the output.
 */
export async function getLayoutedElements<N extends Node, E extends Edge>(
	nodes: N[],
	edges: E[],
	options: LayoutOptions = {}
): Promise<LayoutedElements<N, E>> {
	const direction = options.direction || "TB";
	const elkDirection = DIRECTION_MAP[direction];

	// Filter out hidden nodes and edges for the layout computation
	const visibleNodes = nodes.filter(
		(node) => !(node as Node & { hidden?: boolean }).hidden
	);
	const visibleEdges = edges.filter(
		(edge) => !(edge as Edge & { hidden?: boolean }).hidden
	);

	// If no visible nodes, return early
	if (visibleNodes.length === 0) {
		return { nodes, edges };
	}

	// Build ELK graph structure
	const elkGraph = {
		id: "root",
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": elkDirection,
			"elk.spacing.nodeNode": "80",
			"elk.layered.spacing.nodeNodeBetweenLayers": "120",
			"elk.edgeRouting": "ORTHOGONAL",
			"elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
			"elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
		},
		children: visibleNodes.map((node) => {
			const dimensions = getNodeDimensions(node.type);
			return {
				id: node.id,
				width: (node as Node & { width?: number }).width || dimensions.width,
				height:
					(node as Node & { height?: number }).height || dimensions.height,
			};
		}),
		edges: visibleEdges.map((edge) => ({
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

	// Apply positions to nodes
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
		nodes: layoutedNodes as N[],
		edges,
	};
}

/**
 * Helper function to apply layout and animate the transition.
 * Adds CSS transition properties for smooth position changes.
 */
export async function applyLayoutWithAnimation<N extends Node, E extends Edge>(
	nodes: N[],
	edges: E[],
	direction: LayoutDirection = "TB"
): Promise<LayoutedElements<N, E>> {
	const layouted = await getLayoutedElements(nodes, edges, { direction });

	// Add animation properties to nodes for smooth transition
	const animatedNodes = layouted.nodes.map((node) => ({
		...node,
		style: {
			...(node.style || {}),
			transition: "all 0.5s ease-in-out",
		},
	}));

	return {
		nodes: animatedNodes as N[],
		edges: layouted.edges,
	};
}
