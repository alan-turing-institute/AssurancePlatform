/**
 * ELK Layout Helper
 *
 * Provides hierarchical layout for React Flow graphs using ELK (Eclipse Layout Kernel).
 * Replaces Dagre for improved edge routing and configurable node placement.
 *
 * @module layout-helper
 */

import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api";
import type { Edge, Node } from "reactflow";
import { compareIdentifiers } from "@/lib/case/identifier-utils";

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
	// Side-attached node kinds (ADR 0005 D3)
	awayGoal: { width: NODE_WIDTH, height: 100 },
	module: { width: NODE_WIDTH, height: 90 },
	default: { width: NODE_WIDTH, height: 110 },
};

/**
 * Get default dimensions for a node type
 */
function getDefaultDimensions(nodeType: string | undefined): {
	width: number;
	height: number;
} {
	return (
		NODE_DIMENSIONS[nodeType || "default"] ?? { width: NODE_WIDTH, height: 110 }
	);
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

	// Use offsetWidth/offsetHeight instead of getBoundingClientRect() because
	// React Flow applies a CSS scale() transform to the viewport. getBoundingClientRect()
	// returns the scaled dimensions, causing ELK to think nodes are smaller than they are.
	const width = nodeElement.offsetWidth;
	const height = nodeElement.offsetHeight;
	if (width > 0 && height > 0) {
		return { width, height };
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
export type LayoutDirection = "TB" | "LR" | "RL" | "BT";
type ElkDirection = "DOWN" | "RIGHT" | "LEFT" | "UP";

const DIRECTION_MAP: Record<LayoutDirection, ElkDirection> = {
	TB: "DOWN",
	LR: "RIGHT",
	RL: "LEFT",
	BT: "UP",
};

/**
 * Cell direction (ADR 0005 D1): a cell (a node plus its side attachments) is
 * laid out perpendicular to the tree direction — horizontal (RIGHT, since
 * side attachments sit to the right, Chris's ruling) for a vertical tree
 * (DOWN/UP), vertical (DOWN) for a horizontal tree (RIGHT/LEFT).
 */
const CELL_DIRECTION_MAP: Record<ElkDirection, ElkDirection> = {
	DOWN: "RIGHT",
	UP: "RIGHT",
	RIGHT: "DOWN",
	LEFT: "DOWN",
};

export interface LayoutOptions {
	direction: LayoutDirection;
	/** Spacing between layers (default: 60) */
	layerSpacing?: number;
	/** Spacing between nodes in the same layer (default: 40) */
	nodeSpacing?: number;
}

interface LayoutedElements {
	edges: Edge[];
	nodes: Node[];
}

/**
 * A cell (ADR 0005 D1): a target node plus everything side-attached to it.
 * `members[0]` is always the target; the rest are its side attachments,
 * sorted by identifier.
 */
interface Cell {
	id: string;
	members: Node[];
}

/**
 * Reads the ELK node id a node is side-attached to, from `data.attachedTo`
 * (ADR 0005 D2). Node data is a dynamic property bag elsewhere in this
 * module's callers, so this is read defensively rather than typed.
 */
function getAttachedToId(node: Node): string | undefined {
	const value = (node.data as Record<string, unknown> | undefined)?.attachedTo;
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Groups side-attached nodes under their target into cells (ADR 0005 D1).
 * A node with `data.attachedTo` pointing at another VISIBLE node becomes a
 * member of that node's cell; an `attachedTo` that doesn't resolve (target
 * hidden or absent) is ignored here — the node is laid out as an ordinary
 * tree node, matching D2's "falls back to its tree position" rule (enforced
 * upstream, at conversion time, by clearing the field in that case).
 *
 * Returns both the cells keyed by target id, and a lookup from every member
 * node id (target or attachment) to its cell id — used to re-point tree
 * edges at the cell for ELK's purposes.
 */
function buildCells(sortedVisibleNodes: Node[]): {
	cellsByTargetId: Map<string, Cell>;
	cellIdByNodeId: Map<string, string>;
} {
	const visibleIds = new Set(sortedVisibleNodes.map((n) => n.id));
	const attachmentsByTargetId = new Map<string, Node[]>();

	for (const node of sortedVisibleNodes) {
		const targetId = getAttachedToId(node);
		if (!targetId || targetId === node.id || !visibleIds.has(targetId)) {
			continue;
		}
		const attachments = attachmentsByTargetId.get(targetId) ?? [];
		attachments.push(node);
		attachmentsByTargetId.set(targetId, attachments);
	}

	const cellsByTargetId = new Map<string, Cell>();
	const cellIdByNodeId = new Map<string, string>();

	for (const node of sortedVisibleNodes) {
		const attachments = attachmentsByTargetId.get(node.id);
		if (!attachments || attachments.length === 0) {
			continue;
		}
		const sortedAttachments = [...attachments].sort((a, b) =>
			compareIdentifiers(
				(a.data?.name as string) || "",
				(b.data?.name as string) || ""
			)
		);
		const cell: Cell = {
			id: `cell-${node.id}`,
			members: [node, ...sortedAttachments],
		};
		cellsByTargetId.set(node.id, cell);
		for (const member of cell.members) {
			cellIdByNodeId.set(member.id, cell.id);
		}
	}

	return { cellsByTargetId, cellIdByNodeId };
}

/**
 * Builds the ELK compound (group) node for one cell: members laid out in a
 * row perpendicular to the tree direction, zero padding, with the target as
 * `layoutOptions.elk.direction`'s first member and each attachment linked to
 * it by an internal star edge (ADR 0005 D1 — the verified passing variant).
 */
function buildCellElkNode(
	cell: Cell,
	cellDirection: ElkDirection,
	nodeSpacing: string
): ElkNode {
	const [target, ...attachments] = cell.members;
	return {
		id: cell.id,
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": cellDirection,
			"elk.padding": "[top=0,left=0,bottom=0,right=0]",
			"elk.spacing.nodeNode": nodeSpacing,
		},
		children: cell.members.map((member) => {
			const dimensions = getActualNodeDimensions(
				member as Node & { measured?: { width?: number; height?: number } }
			);
			return {
				id: member.id,
				width: dimensions.width,
				height: dimensions.height,
			};
		}),
		edges: attachments.map((member) => ({
			id: `${target?.id}-${member.id}`,
			sources: [target?.id ?? ""],
			targets: [member.id],
		})),
	};
}

/**
 * Builds the ELK `children` array: a compound node per cell (target + its
 * side attachments), plain nodes for everything else. A node that is itself
 * a side attachment is skipped — it's nested inside its cell instead.
 */
function buildElkChildren(
	sortedVisibleNodes: Node[],
	cellsByTargetId: Map<string, Cell>,
	cellIdByNodeId: Map<string, string>,
	cellDirection: ElkDirection,
	nodeSpacing: string
): ElkNode[] {
	const emittedCellIds = new Set<string>();
	const elkChildren: ElkNode[] = [];
	for (const node of sortedVisibleNodes) {
		const cell = cellsByTargetId.get(node.id);
		if (cell) {
			if (emittedCellIds.has(cell.id)) {
				continue;
			}
			emittedCellIds.add(cell.id);
			elkChildren.push(buildCellElkNode(cell, cellDirection, nodeSpacing));
			continue;
		}
		if (cellIdByNodeId.has(node.id)) {
			// A side attachment — already nested inside its target's cell.
			continue;
		}
		const dimensions = getActualNodeDimensions(
			node as Node & { measured?: { width?: number; height?: number } }
		);
		elkChildren.push({
			id: node.id,
			width: dimensions.width,
			height: dimensions.height,
		});
	}
	return elkChildren;
}

/**
 * Re-points every tree edge whose endpoint sits inside a cell at the cell,
 * for ELK's purposes (ADR 0005 D1). An edge that resolves to the same cell
 * at both ends (e.g. a `challenges` edge, whose source and target are always
 * members of the same cell by construction) carries no extra layout
 * information — cell membership already places it — so it's dropped rather
 * than sent to ELK as a self-loop.
 */
function buildElkEdges(
	validEdges: Edge[],
	cellIdByNodeId: Map<string, string>
): ElkExtendedEdge[] {
	const elkEdges: ElkExtendedEdge[] = [];
	for (const edge of validEdges) {
		const source = cellIdByNodeId.get(edge.source) ?? edge.source;
		const target = cellIdByNodeId.get(edge.target) ?? edge.target;
		if (source === target) {
			continue;
		}
		elkEdges.push({ id: edge.id, sources: [source], targets: [target] });
	}
	return elkEdges;
}

/**
 * Flattens one cell's (compound ELK node's) members from positions relative
 * to the cell's own origin to absolute coordinates, writing each into
 * `positionMap` (ADR 0005 D1).
 */
function flattenCellMembers(
	cell: ElkNode,
	positionMap: Map<string, { x: number; y: number }>
): void {
	const baseX = cell.x ?? 0;
	const baseY = cell.y ?? 0;
	for (const member of cell.children ?? []) {
		if (member.x !== undefined && member.y !== undefined) {
			positionMap.set(member.id, { x: baseX + member.x, y: baseY + member.y });
		}
	}
}

/**
 * Flattens ELK's output into a single id -> absolute position map. A cell is
 * a compound ELK node: its own x/y is the cell's origin, and its members'
 * positions are relative to it — flattened to absolute coordinates by
 * `flattenCellMembers` above — before a plain node's x/y, already absolute,
 * is applied unchanged.
 */
function flattenPositions(
	elkChildren: ElkNode[]
): Map<string, { x: number; y: number }> {
	const positionMap = new Map<string, { x: number; y: number }>();
	for (const child of elkChildren) {
		if (child.children && child.children.length > 0) {
			flattenCellMembers(child, positionMap);
			continue;
		}
		if (child.x !== undefined && child.y !== undefined) {
			positionMap.set(child.id, { x: child.x, y: child.y });
		}
	}
	return positionMap;
}

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
	const nodeSpacing = String(options.nodeSpacing ?? 40);
	const layerSpacing = String(options.layerSpacing ?? 60);

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

	// ADR 0005 D1: group side-attached nodes under their target into cells.
	const { cellsByTargetId, cellIdByNodeId } = buildCells(sortedVisibleNodes);
	const cellDirection = CELL_DIRECTION_MAP[elkDirection] || "RIGHT";

	const elkChildren = buildElkChildren(
		sortedVisibleNodes,
		cellsByTargetId,
		cellIdByNodeId,
		cellDirection,
		nodeSpacing
	);
	const elkEdges = buildElkEdges(validEdges, cellIdByNodeId);

	// Build ELK graph structure
	const elkGraph = {
		id: "root",
		layoutOptions: {
			"elk.algorithm": "layered",
			"elk.direction": elkDirection,
			// Spacing between nodes in the same layer (horizontal for TB direction)
			"elk.spacing.nodeNode": nodeSpacing,
			// Spacing between layers (vertical for TB direction)
			"elk.layered.spacing.nodeNodeBetweenLayers": layerSpacing,
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
			// ADR 0005 D1: lay the tree out over cells, each cell laid out
			// independently (perpendicular direction, own padding/spacing).
			"elk.hierarchyHandling": "SEPARATE_CHILDREN",
		},
		children: elkChildren,
		edges: elkEdges,
	};

	// Compute layout
	const layoutedGraph = await elk.layout(elkGraph);

	// Flatten ELK's output (cells are compound nodes with member-relative
	// positions) into a single absolute id -> position map (ADR 0005 D1).
	const positionMap = flattenPositions(layoutedGraph.children || []);

	// Apply positions to nodes (only visible nodes get new positions).
	// positionAbsolute must be set alongside position because getNodesBounds
	// prefers positionAbsolute — stale values from a prior layout would cause
	// incorrect bounds during export capture.
	const layoutedNodes = nodes.map((node) => {
		const newPosition = positionMap.get(node.id);
		if (newPosition) {
			return {
				...node,
				position: newPosition,
				positionAbsolute: newPosition,
			};
		}
		return node;
	});

	return {
		nodes: layoutedNodes,
		edges,
	};
}
