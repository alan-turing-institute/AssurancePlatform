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
import { logger } from "@/lib/logger";

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
 * A cell (ADR 0005 D1, D8): a root target node plus everything side-
 * attached to it, flattened across any nesting depth — a defeater
 * attacking another defeater joins its ultimate target's cell rather than
 * forming a second, orphaned one. `members[0]` is always the root target;
 * the rest are its attachments (direct or nested), breadth-first by depth
 * from the root, identifier-sorted among siblings at the same depth.
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
 * A node -> its own immediate `attachedTo` id, for every visible node whose
 * `attachedTo` resolves to another VISIBLE node (not itself) — the same
 * validity check D2's fallback relies on: an `attachedTo` that doesn't
 * resolve (target hidden or absent) is dropped here, so that node is laid
 * out as an ordinary tree node.
 */
function buildImmediateAttachments(
	sortedVisibleNodes: Node[],
	visibleIds: Set<string>
): Map<string, string> {
	const immediateAttachedTo = new Map<string, string>();
	for (const node of sortedVisibleNodes) {
		const targetId = getAttachedToId(node);
		if (targetId && targetId !== node.id && visibleIds.has(targetId)) {
			immediateAttachedTo.set(node.id, targetId);
		}
	}
	return immediateAttachedTo;
}

/**
 * Resolves the ROOT a (possibly nested) attachment chain ultimately
 * belongs to (ADR 0005 D8 — "nested defeaters", GSN §1:6's counter-counter-
 * argument): CSn1 attached to CG1 attached to G2 all resolve to G2, so the
 * whole chain lays out as one cell instead of leaving the inner link
 * referencing a cell that's never emitted (the ELK "Referenced shape does
 * not exist" crash this replaces). Returns `undefined` for a node that
 * isn't attached to anything, and for a node whose chain loops back on
 * itself (a cycle) — both fall back to being laid out as an ordinary tree
 * node, matching D2's existing fallback.
 */
function resolveAttachmentRootId(
	nodeId: string,
	immediateAttachedTo: Map<string, string>
): string | undefined {
	if (!immediateAttachedTo.has(nodeId)) {
		return undefined;
	}
	const seen = new Set<string>([nodeId]);
	let current = nodeId;
	while (immediateAttachedTo.has(current)) {
		const next = immediateAttachedTo.get(current);
		if (!next || seen.has(next)) {
			return undefined;
		}
		seen.add(next);
		current = next;
	}
	return current;
}

/**
 * Orders a cell's non-root members breadth-first by depth from the root,
 * using each member's own immediate attachment parent — which may be the
 * root itself, or another member further down the chain — rather than
 * always the root. A nested attachment (CSn1 on CG1 on G2) therefore sits
 * one column further along the row than its own parent CG1, not stacked
 * beside it. Siblings (same immediate parent) are identifier-sorted.
 */
function orderAttachmentMembers(
	rootId: string,
	memberNodes: Node[],
	immediateAttachedTo: Map<string, string>
): Node[] {
	const byParentId = new Map<string, Node[]>();
	for (const node of memberNodes) {
		const parentId = immediateAttachedTo.get(node.id) ?? rootId;
		const siblings = byParentId.get(parentId) ?? [];
		siblings.push(node);
		byParentId.set(parentId, siblings);
	}
	for (const siblings of byParentId.values()) {
		siblings.sort((a, b) =>
			compareIdentifiers(
				(a.data?.name as string) || "",
				(b.data?.name as string) || ""
			)
		);
	}

	const ordered: Node[] = [];
	const visited = new Set<string>([rootId]);
	let frontier = [rootId];
	while (frontier.length > 0) {
		const next: string[] = [];
		for (const parentId of frontier) {
			for (const child of byParentId.get(parentId) ?? []) {
				if (visited.has(child.id)) {
					continue;
				}
				visited.add(child.id);
				ordered.push(child);
				next.push(child.id);
			}
		}
		frontier = next;
	}
	return ordered;
}

/**
 * Groups side-attached nodes under their ROOT target into cells (ADR 0005
 * D1, D8) — flattening any nesting depth (see `resolveAttachmentRootId`).
 * An `attachedTo` that doesn't resolve, or that loops back on itself, is
 * ignored here — the node is laid out as an ordinary tree node, matching
 * D2's "falls back to its tree position" rule.
 *
 * Returns both the cells keyed by root id, and a lookup from every member
 * node id (root or attachment, at any depth) to its cell id — used to
 * re-point tree edges at the cell for ELK's purposes.
 */
function buildCells(sortedVisibleNodes: Node[]): {
	cellsByTargetId: Map<string, Cell>;
	cellIdByNodeId: Map<string, string>;
} {
	const visibleIds = new Set(sortedVisibleNodes.map((n) => n.id));
	const immediateAttachedTo = buildImmediateAttachments(
		sortedVisibleNodes,
		visibleIds
	);
	const nodeById = new Map(sortedVisibleNodes.map((n) => [n.id, n]));

	const memberNodesByRootId = new Map<string, Node[]>();
	for (const node of sortedVisibleNodes) {
		const rootId = resolveAttachmentRootId(node.id, immediateAttachedTo);
		if (!rootId || rootId === node.id) {
			continue;
		}
		const members = memberNodesByRootId.get(rootId) ?? [];
		members.push(node);
		memberNodesByRootId.set(rootId, members);
	}

	const cellsByTargetId = new Map<string, Cell>();
	const cellIdByNodeId = new Map<string, string>();

	for (const [rootId, memberNodes] of memberNodesByRootId) {
		const root = nodeById.get(rootId);
		if (!root) {
			continue;
		}
		const orderedMembers = orderAttachmentMembers(
			rootId,
			memberNodes,
			immediateAttachedTo
		);
		const cell: Cell = {
			id: `cell-${rootId}`,
			members: [root, ...orderedMembers],
		};
		cellsByTargetId.set(rootId, cell);
		for (const member of cell.members) {
			cellIdByNodeId.set(member.id, cell.id);
		}
	}

	return { cellsByTargetId, cellIdByNodeId };
}

/**
 * Kind-ordering rank for a cell's (or any parent's) children, before
 * identifier (ADR 0005 D1's "cross-kind order", D8): strategies and
 * property claims first, then evidence, then away goals and modules. An
 * unranked type (goal — always a root here — or a future node kind) ties
 * at rank 0 rather than breaking the sort.
 */
const KIND_RANK: Record<string, number> = {
	strategy: 0,
	property: 0,
	evidence: 1,
	awayGoal: 2,
	module: 2,
};

function kindRank(node: Node): number {
	return KIND_RANK[node.type ?? ""] ?? 0;
}

/**
 * The index of `nodeId` within its own cell's `members` array (target = 0,
 * then attachments in identifier order) — 0 for a node that isn't a cell
 * member at all, so ordinary siblings compare as if all equally "first".
 * Keeps a cell's own children (index 0) ahead of each side element's
 * children (index 1, 2, …), in cell order — ADR 0005 D1's ordering rule.
 */
function cellMemberIndexOf(
	nodeId: string,
	cellIdByNodeId: Map<string, string>,
	cellById: Map<string, Cell>
): number {
	const cellId = cellIdByNodeId.get(nodeId);
	if (!cellId) {
		return 0;
	}
	const cell = cellById.get(cellId);
	if (!cell) {
		return 0;
	}
	const index = cell.members.findIndex((member) => member.id === nodeId);
	return index === -1 ? 0 : index;
}

/**
 * Builds a node -> immediate-parent-id map from the graph's own edges,
 * skipping any edge whose endpoints resolve to the SAME cell (e.g. the
 * `challenges` edge, or the probe fixtures' equivalent) — that edge carries
 * no tree information, since cell membership already places both ends.
 * Matches `buildElkEdges`'s identical same-cell rule below.
 */
function buildParentIdByNodeId(
	edges: Edge[],
	cellIdByNodeId: Map<string, string>
): Map<string, string> {
	const parentIdByNodeId = new Map<string, string>();
	for (const edge of edges) {
		const sourceCellId = cellIdByNodeId.get(edge.source);
		if (sourceCellId && sourceCellId === cellIdByNodeId.get(edge.target)) {
			continue;
		}
		parentIdByNodeId.set(edge.target, edge.source);
	}
	return parentIdByNodeId;
}

/**
 * Orders visible nodes so ELK's `forceNodeModelOrder` produces the row
 * order ADR 0005 D1/D8 require: a cell's own children first (kind before
 * identifier — strategies/property claims, then evidence, then away
 * goals/modules), then each side element's children in cell order, each
 * group kind-then-identifier sorted the same way. Plain (non-cell) siblings
 * get the same kind-before-identifier treatment, which is what stops
 * "AG1" < "E4" < "S1" string comparison from scattering an ordinary row.
 *
 * Implemented as a root-to-leaf path comparison, built from the graph's own
 * edges (`buildParentIdByNodeId`) rather than a flat sort key or
 * `data.parentId`: the "cell order, then kind, then identifier" rule only
 * makes sense between actual siblings, found by walking both nodes' paths
 * to the ancestor where they diverge — and the probe fixtures below (like
 * production data with a defeater whose support edge is replaced by its
 * `challenges` edge) express the tree purely through edges.
 */
function sortNodesForLayout(
	visibleNodes: Node[],
	validEdges: Edge[],
	cellIdByNodeId: Map<string, string>,
	cellById: Map<string, Cell>
): Node[] {
	const nodeById = new Map(visibleNodes.map((node) => [node.id, node]));
	const parentIdByNodeId = buildParentIdByNodeId(validEdges, cellIdByNodeId);
	const pathCache = new Map<string, Node[]>();

	function getPath(nodeId: string): Node[] {
		const cached = pathCache.get(nodeId);
		if (cached) {
			return cached;
		}
		const node = nodeById.get(nodeId);
		if (!node) {
			return [];
		}
		const parentId = parentIdByNodeId.get(nodeId);
		const parentPath =
			parentId && nodeById.has(parentId) ? getPath(parentId) : [];
		const path = [...parentPath, node];
		pathCache.set(nodeId, path);
		return path;
	}

	function compareSiblings(a: Node, b: Node): number {
		const memberDiff =
			cellMemberIndexOf(a.id, cellIdByNodeId, cellById) -
			cellMemberIndexOf(b.id, cellIdByNodeId, cellById);
		if (memberDiff !== 0) {
			return memberDiff;
		}
		const kindDiff = kindRank(a) - kindRank(b);
		if (kindDiff !== 0) {
			return kindDiff;
		}
		return compareIdentifiers(
			(a.data?.name as string) || "",
			(b.data?.name as string) || ""
		);
	}

	function compareTreeOrder(a: Node, b: Node): number {
		if (a.id === b.id) {
			return 0;
		}
		const pathA = getPath(a.id);
		const pathB = getPath(b.id);
		const length = Math.min(pathA.length, pathB.length);
		for (let i = 0; i < length; i++) {
			const nodeA = pathA[i];
			const nodeB = pathB[i];
			if (nodeA && nodeB && nodeA.id !== nodeB.id) {
				return compareSiblings(nodeA, nodeB);
			}
		}
		// One path is a prefix of the other (an ancestor/descendant pair,
		// which shouldn't occur among nodes ELK places in the same layer) —
		// order the shorter (ancestor) first, for a well-defined total order.
		return pathA.length - pathB.length;
	}

	return [...visibleNodes].sort(compareTreeOrder);
}

/**
 * Builds the ELK compound (group) node for one cell: members laid out in a
 * row perpendicular to the tree direction, zero padding (ADR 0005 D1 — the
 * verified passing variant). Internal edges mirror each non-root member's
 * REAL immediate attachment (`data.attachedTo`) rather than a flat star
 * from the root (ADR 0005 D8): for a nested chain — a defeater attacking
 * another defeater — this places the inner link one column further along
 * than its own parent, instead of stacked beside it.
 */
function buildCellElkNode(
	cell: Cell,
	cellDirection: ElkDirection,
	nodeSpacing: string
): ElkNode {
	const [root] = cell.members;
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
		edges: cell.members
			.filter((member) => member.id !== root?.id)
			.map((member) => {
				const parentId = getAttachedToId(member) ?? root?.id ?? "";
				return {
					id: `${parentId}-${member.id}`,
					sources: [parentId],
					targets: [member.id],
				};
			}),
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
		// A node can be both a cell's target AND another cell's attachment
		// (e.g. a defeater with its own further attachment) — `cellIdByNodeId`
		// is the resolved truth for which cell it actually belongs to, so it
		// must agree with `cell.id` before this node is treated as the
		// emission point for `cell`; otherwise it's just a member of whatever
		// cell `cellIdByNodeId` says, handled by the branch below.
		if (cell && cellIdByNodeId.get(node.id) === cell.id) {
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

interface CellBounds {
	height: number;
	width: number;
	x: number;
	y: number;
}

/**
 * Absolute bounding box of every cell in the laid-out graph, keyed by cell
 * id — used to bend a cell's outgoing support edges below (or, in a
 * left-right tree, beside) the WHOLE cell rather than at the target's own
 * midpoint (ADR 0005 D8): with two stacked defeaters, the old midpoint
 * bend passed through the second card. Only compound (cell) ELK nodes have
 * `.children`; plain nodes are skipped.
 */
function computeCellBounds(elkChildren: ElkNode[]): Map<string, CellBounds> {
	const boundsByCellId = new Map<string, CellBounds>();
	for (const child of elkChildren) {
		if (child.children && child.children.length > 0) {
			boundsByCellId.set(child.id, {
				x: child.x ?? 0,
				y: child.y ?? 0,
				width: child.width ?? 0,
				height: child.height ?? 0,
			});
		}
	}
	return boundsByCellId;
}

/**
 * The bend coordinate for a cell's outgoing children edges, in whichever
 * axis the OUTER tree actually progresses along (ADR 0005 D8): `centerY`
 * for a top-down/bottom-up tree (DOWN/UP — children sit below), `centerX`
 * for a left-right tree (RIGHT/LEFT — a live per-case toggle,
 * `case-settings-popover.tsx`; children sit beside the cell). Always the
 * cell's FAR edge in the direction children lie, plus half the layer gap —
 * never the near edge, which would bend back into the cell itself.
 */
function cellBendCoordinate(
	bounds: CellBounds,
	elkDirection: ElkDirection,
	gap: number
): { centerX?: number; centerY?: number } {
	switch (elkDirection) {
		case "DOWN":
			return { centerY: bounds.y + bounds.height + gap / 2 };
		case "UP":
			return { centerY: bounds.y - gap / 2 };
		case "RIGHT":
			return { centerX: bounds.x + bounds.width + gap / 2 };
		case "LEFT":
			return { centerX: bounds.x - gap / 2 };
		default:
			return {};
	}
}

/**
 * Sets `data.centerX`/`data.centerY` (ADR 0005 D8) on every edge whose
 * source is a cell member and whose target sits OUTSIDE that same cell — a
 * real "children of the cell" edge, not an in-cell edge like `challenges`
 * (whose source and target both resolve to the same cell and carry no
 * useful bend of their own). The `support` edge type
 * (`components/cases/support-edge.tsx`) reads whichever is set to bend its
 * run below/beside the whole cell instead of the default midpoint between
 * source and target. Edges left untouched here (both stay undefined) fall
 * back to `getSmoothStepPath`'s own default — the same bend `smoothstep`
 * always used — so this is additive, not a behaviour change for ordinary
 * edges outside a cell.
 */
function applyCellBend(
	edges: Edge[],
	cellIdByNodeId: Map<string, string>,
	cellBoundsByCellId: Map<string, CellBounds>,
	elkDirection: ElkDirection,
	gap: number
): Edge[] {
	return edges.map((edge) => {
		const sourceCellId = cellIdByNodeId.get(edge.source);
		if (!sourceCellId) {
			return edge;
		}
		if (cellIdByNodeId.get(edge.target) === sourceCellId) {
			return edge;
		}
		const bounds = cellBoundsByCellId.get(sourceCellId);
		if (!bounds) {
			return edge;
		}
		return {
			...edge,
			data: {
				...edge.data,
				...cellBendCoordinate(bounds, elkDirection, gap),
			},
		};
	});
}

/**
 * Runs the actual ELK layout for a non-empty, already-filtered graph — the
 * part of `getLayoutedElements` that can throw (ELK rejects on a malformed
 * graph, e.g. an edge referencing a shape that was never emitted). Split
 * out so `getLayoutedElements` can wrap exactly this in a try/catch.
 */
async function layoutVisibleGraph(
	nodes: Node[],
	edges: Edge[],
	visibleNodes: Node[],
	validEdges: Edge[],
	elkDirection: ElkDirection,
	nodeSpacing: string,
	layerSpacing: string
): Promise<LayoutedElements> {
	// ADR 0005 D1: group side-attached nodes under their target into cells.
	// buildCells still takes an identifier-sorted list, not raw
	// `visibleNodes`: when a node is simultaneously a cell target AND
	// another cell's attachment (the probe's CG1, itself the target of
	// CSn1's attachment while also attached to G2), the LAST target
	// processed wins that node's cell membership in `cellIdByNodeId` — this
	// input order is what decides it, so it must stay identifier order
	// (matching the pre-existing, tested behaviour) rather than the
	// kind/cell-aware order computed below, which depends on this
	// function's own output and would make the tie-break circular.
	const identifierSortedNodes = [...visibleNodes].sort((a, b) =>
		compareIdentifiers(
			(a.data?.name as string) || "",
			(b.data?.name as string) || ""
		)
	);
	const { cellsByTargetId, cellIdByNodeId } = buildCells(identifierSortedNodes);
	const cellById = new Map(
		[...cellsByTargetId.values()].map((cell) => [cell.id, cell])
	);

	// ADR 0005 D1/D8: a cell's own children first, then each side element's
	// children in cell order, kind before identifier throughout — see
	// sortNodesForLayout's own comment for why this isn't a flat sort key.
	const sortedVisibleNodes = sortNodesForLayout(
		visibleNodes,
		validEdges,
		cellIdByNodeId,
		cellById
	);
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

	// ADR 0005 D8: bend a cell's outgoing children edges below (DOWN/UP) or
	// beside (RIGHT/LEFT) the whole cell, not the target's own midpoint.
	const cellBoundsByCellId = computeCellBounds(layoutedGraph.children || []);
	const layoutedEdges = applyCellBend(
		edges,
		cellIdByNodeId,
		cellBoundsByCellId,
		elkDirection,
		Number(layerSpacing)
	);

	return {
		nodes: layoutedNodes,
		edges: layoutedEdges,
	};
}

/**
 * Generates a layout for the given nodes and edges using ELK's layered algorithm.
 *
 * This function processes the visible nodes and edges in a graph, applies a hierarchical
 * layout with orthogonal edge routing, and returns the nodes with updated positions.
 * Hidden nodes and edges are ignored during layout computation but retained in the output.
 *
 * Never rejects: a layout failure (ELK throwing on a malformed graph) is
 * logged and falls back to the pre-layout positions — see
 * `layoutVisibleGraph` — rather than leaving a caller's promise unresolved
 * and the canvas stuck (vincent, round 2).
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

	try {
		return await layoutVisibleGraph(
			nodes,
			edges,
			visibleNodes,
			validEdges,
			elkDirection,
			nodeSpacing,
			layerSpacing
		);
	} catch (error) {
		// Falling back to the pre-layout positions keeps the canvas usable
		// instead of freezing on whatever was mid-render when the promise
		// rejected. A nested-defeater chain used to crash ELK here before
		// the cell-flattening fix above; kept as a safety net for any other
		// malformed input, not just that one case.
		logger.error("Case layout failed; falling back to pre-layout positions", {
			error,
			direction,
			nodeCount: nodes.length,
			edgeCount: edges.length,
		});
		return { nodes, edges };
	}
}
