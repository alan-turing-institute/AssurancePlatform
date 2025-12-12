import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "reactflow";

type LayoutDirection = "LR" | "TB" | "RL" | "BT";

type LayoutOptions = {
	direction?: LayoutDirection;
};

type LayoutedElements<N extends Node = Node, E extends Edge = Edge> = {
	nodes: N[];
	edges: E[];
};

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

/**
 * Node dimension configurations based on node type
 */
const getNodeDimensions = (
	nodeType: string | undefined
): { width: number; height: number } => {
	switch (nodeType) {
		case "goal":
			return { width: 260, height: 110 };
		case "strategy":
			return { width: 250, height: 90 };
		case "propertyClaimNode":
			return { width: 240, height: 80 };
		case "evidence":
			return { width: 220, height: 70 };
		case "context":
			return { width: 200, height: 60 };
		default:
			return { width: 250, height: 100 };
	}
};

/**
 * Generates a layout for the given nodes and edges using Dagre's graph layout algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a directed layout
 * (e.g., top-down, left-right), and returns the nodes with updated positions based on the layout.
 * Hidden nodes and edges are ignored during the layout computation but retained in the final output.
 */
export const getLayoutedElements = <N extends Node, E extends Edge>(
	nodes: N[],
	edges: E[],
	options: LayoutOptions
): LayoutedElements<N, E> => {
	// Clear the graph before processing
	for (const n of g.nodes()) {
		g.removeNode(n);
	}

	// Set the graph layout direction and spacing
	g.setGraph({
		rankdir: options.direction || "TB",
		ranksep: 120,
		nodesep: 80,
		marginx: 40,
		marginy: 40,
	});

	// Filter out hidden nodes and edges for the layout computation
	const visibleNodes = nodes.filter(
		(node) => !(node as Node & { hidden?: boolean }).hidden
	);
	const visibleEdges = edges.filter(
		(edge) => !(edge as Edge & { hidden?: boolean }).hidden
	);

	// Add nodes to the graph based on visible nodes
	for (const node of visibleNodes) {
		const dimensions = getNodeDimensions(node.type);

		g.setNode(node.id, {
			width: (node as Node & { width?: number }).width || dimensions.width,
			height: (node as Node & { height?: number }).height || dimensions.height,
		});
	}

	// Add edges to the graph based on visible edges
	for (const edge of visibleEdges) {
		g.setEdge(edge.source, edge.target);
	}

	// Compute the layout using Dagre's layout algorithm
	Dagre.layout(g);

	// Return the nodes with updated positions (only for visible nodes) and the original edges
	return {
		nodes: nodes.map((node) => {
			// Only update the position for visible nodes
			if (!(node as Node & { hidden?: boolean }).hidden) {
				const nodeWithPosition = g.node(node.id);
				if (nodeWithPosition) {
					const { x, y } = nodeWithPosition;
					// Center the node position (dagre returns top-left corner)
					return {
						...node,
						position: {
							x: x - nodeWithPosition.width / 2,
							y: y - nodeWithPosition.height / 2,
						},
					};
				}
			}
			return node;
		}),
		edges,
	};
};

/**
 * Helper function to apply layout and animate the transition
 */
export const applyLayoutWithAnimation = <N extends Node, E extends Edge>(
	nodes: N[],
	edges: E[],
	direction: LayoutDirection = "TB"
): LayoutedElements<N, E> => {
	const layouted = getLayoutedElements(nodes, edges, { direction });

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
};
