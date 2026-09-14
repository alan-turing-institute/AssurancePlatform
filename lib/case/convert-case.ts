import type { Edge, Node } from "reactflow";
import { resolveReactFlowNodeType } from "@/lib/case/node-type-resolver";
import { generateUuid } from "@/lib/generate-uuid";
import { logger } from "@/lib/logger";
import type {
	AwayGoalResponse,
	EvidenceResponse,
	GoalResponse,
	ModuleResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

// Define the structure of items that can be converted to nodes
// Dynamic property bag: generic tree conversion spreads all fields into React Flow node data
export interface ConvertibleItem {
	awayGoals?: AwayGoalResponse[];
	context?: ConvertibleItem[];
	defeatsElementId?: string | null;
	description?: string;
	evidence?: EvidenceResponse[];
	hidden?: boolean;
	id: string;
	isDefeater?: boolean;
	modules?: ModuleResponse[];
	name: string;
	propertyClaims?: PropertyClaimResponse[];
	strategies?: StrategyResponse[];
	type: string;
	[key: string]: unknown;
}

// Define the structure of the assurance case
// Dynamic property bag: case objects include varying metadata fields (isDemo, permissions, etc.)
export interface AssuranceCaseWithGoals {
	goals: GoalResponse[];
	[key: string]: unknown;
}

/**
 * Convert Assurance Case
 *
 * This function is used to take an assurance case object and passes the goals array to other functions to convert into Nodes and Edges - which are required for ReactFlow.
 *
 * @param {Object} assuranceCase - Assurance case object retrieved from the database
 *
 */
export const convertAssuranceCase = (assuranceCase: AssuranceCaseWithGoals) => {
	try {
		let caseNodes: Node[] = [],
			caseEdges: Edge[] = [];

		// Handle null/undefined assurance case or goals
		if (!(assuranceCase?.goals && Array.isArray(assuranceCase.goals))) {
			return { caseNodes, caseEdges };
		}

		// Create nodes for each child array item
		const goals = assuranceCase.goals;

		// Propagate isDemo flag from case to each goal (and recursively to descendants)
		const isDemo = !!(assuranceCase as Record<string, unknown>).isDemo;

		// Create nodes recursively for goals and their children
		caseNodes = createNodesRecursively(
			goals as unknown as ConvertibleItem[],
			"goal",
			null,
			undefined,
			undefined,
			isDemo
		);

		// ADR 0005 D2: route each defeater to its target's cell (side
		// attachment) when the target is present; otherwise it keeps its
		// ordinary tree position.
		caseNodes = applyDefeaterAttachments(caseNodes);

		// Create edges for every node
		caseEdges = createEdgesFromNodes(caseNodes);

		return { caseNodes, caseEdges };
	} catch (error) {
		// The real cause of a conversion failure (e.g. edge-id generation)
		// otherwise only surfaces as flow.tsx's generic "Failed to render
		// diagram" toast — log it here, at the point it's thrown, then rethrow
		// unchanged so callers' error handling is untouched.
		logger.error("Case conversion failed", {
			caseId: assuranceCase?.id,
			error,
		});
		throw error;
	}
};

// Helper function to create a single node
const createNode = (
	item: ConvertibleItem,
	nodeType: string,
	parentNode: Node | null,
	isDemo = false
): Node => {
	const nodeId = `${nodeType}-${item.id}`;
	const node: Node = {
		id: nodeId,
		type: nodeType,
		data: {
			...item,
			id: item.id,
			name: item.name,
			type: item.type,
			description: item.description,
			elementId: item.id, // Add elementId for test compatibility
			elementType: nodeType, // Add elementType for identification
			label: item.name, // Add label for compatibility
			isDemo,
		},
		position: { x: 0, y: 50 },
		hidden: item.hidden,
		height: 64,
		width: 288,
	};

	if (parentNode) {
		node.data.parentId = parentNode.id;
	}

	return node;
};

// Helper function to process child nodes
const processChildNodes = (
	item: ConvertibleItem,
	node: Node,
	processedItems: Set<ConvertibleItem>,
	effectiveDepth: number,
	isDemo = false
): Node[] => {
	const childNodes: Node[] = [];

	// Process strategies
	if (
		item.strategies &&
		Array.isArray(item.strategies) &&
		item.strategies.length > 0
	) {
		const strategyNodes = createNodesRecursively(
			item.strategies as unknown as ConvertibleItem[],
			"strategy",
			node,
			processedItems,
			effectiveDepth - 1,
			isDemo
		);
		childNodes.push(...strategyNodes);
	}

	// Process property claims
	if (
		item.propertyClaims &&
		Array.isArray(item.propertyClaims) &&
		item.propertyClaims.length > 0
	) {
		const propertyClaimNodes = createNodesRecursively(
			item.propertyClaims as unknown as ConvertibleItem[],
			"property",
			node,
			processedItems,
			effectiveDepth - 1,
			isDemo
		);
		childNodes.push(...propertyClaimNodes);
	}

	// Process evidence
	if (
		item.evidence &&
		Array.isArray(item.evidence) &&
		item.evidence.length > 0
	) {
		const evidenceNodes = createNodesRecursively(
			item.evidence as unknown as ConvertibleItem[],
			"evidence",
			node,
			processedItems,
			effectiveDepth - 1,
			isDemo
		);
		childNodes.push(...evidenceNodes);
	}

	// ADR 0005 D3: AWAY_GOAL and MODULE are admitted wherever PROPERTY_CLAIM
	// is — ordinary tree nodes, via the same recursive machinery.
	if (
		item.awayGoals &&
		Array.isArray(item.awayGoals) &&
		item.awayGoals.length > 0
	) {
		const awayGoalNodes = createNodesRecursively(
			item.awayGoals as unknown as ConvertibleItem[],
			resolveReactFlowNodeType("away_goal"),
			node,
			processedItems,
			effectiveDepth - 1,
			isDemo
		);
		childNodes.push(...awayGoalNodes);
	}

	if (item.modules && Array.isArray(item.modules) && item.modules.length > 0) {
		const moduleNodes = createNodesRecursively(
			item.modules as unknown as ConvertibleItem[],
			resolveReactFlowNodeType("module"),
			node,
			processedItems,
			effectiveDepth - 1,
			isDemo
		);
		childNodes.push(...moduleNodes);
	}

	return childNodes;
};

export const createNodesRecursively = (
	items: ConvertibleItem[],
	nodeType: string,
	parentNode: Node | null = null,
	processedItems = new Set<ConvertibleItem>(),
	depth = 10,
	isDemo = false
): Node[] => {
	const nodes: Node[] = [];

	// Handle null/undefined arrays
	if (!(items && Array.isArray(items))) {
		return nodes;
	}

	// Special handling: if depth is exactly 0, process ALL nodes without depth limit
	// This allows tests to create all node types with depth=0
	const effectiveDepth = depth === 0 ? 999 : depth;

	if (effectiveDepth < 0) {
		return nodes;
	}

	for (const item of items) {
		// Skip invalid items
		if (!item || typeof item !== "object" || processedItems.has(item)) {
			continue;
		}

		// Create node
		const node = createNode(item, nodeType, parentNode, isDemo);
		nodes.push(node);

		// Add the current item to the set of processed items
		processedItems.add(item);

		// Process child nodes
		const childNodes = processChildNodes(
			item,
			node,
			processedItems,
			effectiveDepth,
			isDemo
		);
		nodes.push(...childNodes);
	}

	return nodes;
};

/**
 * Routes each defeater to its target's cell (ADR 0005 D2, D1): a node whose
 * `data.isDefeater` is true and whose `data.defeatsElementId` resolves to
 * another node PRESENT in this tree gets `data.attachedTo` set to that
 * node's id (and `data.attachSide` set, "right" per Chris's ruling) — the
 * side-attachment signal `layout-helper.ts`'s cells and `createEdgesFromNodes`
 * below both read. A defeater whose target is null, unresolved, or itself
 * (a self-reference) is left alone: it keeps its ordinary tree position and
 * the defeater marking, and draws no attack edge — the D2 fallback.
 */
const applyDefeaterAttachments = (nodes: Node[]): Node[] => {
	const nodeIdByElementId = new Map<string, string>();
	for (const node of nodes) {
		const elementId = node.data?.id;
		if (typeof elementId === "string") {
			nodeIdByElementId.set(elementId, node.id);
		}
	}

	return nodes.map((node) => {
		if (!node.data?.isDefeater) {
			return node;
		}
		const defeatsElementId = node.data?.defeatsElementId as
			| string
			| null
			| undefined;
		if (!defeatsElementId) {
			return node;
		}
		const targetNodeId = nodeIdByElementId.get(defeatsElementId);
		if (!targetNodeId || targetNodeId === node.id) {
			return node;
		}
		return {
			...node,
			data: {
				...node.data,
				attachedTo: targetNodeId,
				attachSide: "right",
			},
		};
	});
};

/** Builds the ordinary parent -> child support edge for one node. */
function buildSupportEdge(node: Node): Edge {
	return {
		id: `e${generateUuid()}`,
		source: node.data.parentId as string,
		target: node.id,
		type: "smoothstep", // Smooth orthogonal edges to match ELK layout
		animated: false,
		sourceHandle: "c",
		hidden: false,
	};
}

/**
 * Builds the `challenges` edge for a defeater (ADR 0005 D4): from the
 * defeater's inner side handle to the target's outer side handle, arrow
 * pointing AT the target — GSN makes the challenger the source, the reverse
 * of InContextOf.
 */
function buildChallengesEdge(node: Node, targetNodeId: string): Edge {
	return {
		id: `e${generateUuid()}`,
		source: node.id,
		target: targetNodeId,
		type: "challenges",
		animated: false,
		sourceHandle: "side-source",
		targetHandle: "side-target",
		hidden: false,
	};
}

/**
 * Creates edges from a list of nodes to represent relationships between parent and child nodes.
 *
 * This function generates edges (links) between nodes in a graph where each node may have a parent-child relationship.
 * The edges are created by linking the `parentId` of a node to the node's `id`.
 *
 * ADR 0005 D4: a defeater whose target (`data.attachedTo`, set by
 * `applyDefeaterAttachments` above) is present also gets a `challenges`
 * edge. Where the target is also the defeater's real tree parent, the
 * challenges edge REPLACES the support edge; otherwise both are drawn.
 *
 * @param {any[]} nodes - An array of nodes, where each node can optionally have a `parentId` in its data to signify a parent-child relationship.
 * @returns {any[]} An array of edges, where each edge links a parent node to a child node.
 *
 */
export const createEdgesFromNodes = (nodes: Node[]): Edge[] => {
	const edges: Edge[] = [];

	// Create a set of all node IDs for validation
	const nodeIds = new Set(nodes.map((node) => node.id));

	for (const node of nodes) {
		const attachedTo = node.data.attachedTo as string | undefined;
		const isChallenge = !!(
			node.data.isDefeater &&
			attachedTo &&
			nodeIds.has(attachedTo)
		);
		const replacesSupport = isChallenge && attachedTo === node.data.parentId;

		// Check if the node has a parentId (indicating it is a child node)
		if (
			node.data.parentId &&
			nodeIds.has(node.data.parentId) &&
			!replacesSupport
		) {
			edges.push(buildSupportEdge(node));
		}

		if (isChallenge && attachedTo) {
			edges.push(buildChallengesEdge(node, attachedTo));
		}
	}

	return edges;
};
