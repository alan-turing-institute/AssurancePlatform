/**
 * Case Data Transformer
 *
 * Transforms CaseExportNested (v1.0) format to React Flow nodes and edges.
 * This is the only supported format for curriculum case viewers.
 *
 * @module case-data-transformer
 */

import { type Edge, MarkerType, type Node } from "reactflow";
import type {
	CaseExportNested,
	ReactFlowNodeData,
	TreeNode,
} from "@/types/curriculum";

/**
 * Map ElementType (uppercase) to React Flow node type (lowercase)
 */
const ELEMENT_TYPE_TO_NODE_TYPE: Record<string, string> = {
	GOAL: "goal",
	STRATEGY: "strategy",
	PROPERTY_CLAIM: "propertyClaim",
	EVIDENCE: "evidence",
};

/**
 * Type guard to check if data is CaseExportNested (v1.0) format
 */
export function isCaseExportNested(data: unknown): data is CaseExportNested {
	return (
		typeof data === "object" &&
		data !== null &&
		"version" in data &&
		(data as CaseExportNested).version === "1.0" &&
		"tree" in data
	);
}

/**
 * Build a single React Flow node from a TreeNode
 */
function buildNode(
	node: TreeNode,
	position: { x: number; y: number }
): Node<ReactFlowNodeData> {
	const nodeType = ELEMENT_TYPE_TO_NODE_TYPE[node.type] || "goal";

	return {
		id: node.id,
		type: nodeType,
		position,
		data: {
			id: node.id,
			name: node.name || "",
			title: node.title || undefined,
			description: node.description,
			url: node.url || undefined,
			context: node.context || [],
			assumption: node.assumption || undefined,
			justification: node.justification || undefined,
		},
	};
}

/**
 * Build a React Flow edge between parent and child
 */
function buildEdge(
	parentId: string,
	childId: string,
	edgeType: string,
	animated: boolean
): Edge {
	return {
		id: `${parentId}-${childId}`,
		source: parentId,
		target: childId,
		sourceHandle: `${parentId}-source`,
		targetHandle: `${childId}-target`,
		type: edgeType,
		animated,
		markerEnd: {
			type: MarkerType.ArrowClosed,
		},
		// Force orthogonal (right-angle) edges instead of auto-detecting
		data: {
			pathType: "smoothstep",
		},
	};
}

type TransformOptions = {
	/** IDs of nodes to animate edges to */
	guidedPath?: string[];
	/** Edge type to use (default: "smart") */
	edgeType?: string;
	/** Horizontal spacing between sibling nodes */
	xSpacing?: number;
	/** Vertical spacing between parent and children */
	ySpacing?: number;
};

type TransformResult = {
	nodes: Node<ReactFlowNodeData>[];
	edges: Edge[];
};

/**
 * Transform CaseExportNested to React Flow nodes and edges.
 *
 * Recursively processes the tree structure, positioning children
 * horizontally centered under their parent.
 */
/**
 * Create a single React Flow node for interactive creation.
 * Used when users create new nodes via the UI.
 */
export function createReactFlowNode(
	id: string,
	nodeType: string,
	position: { x: number; y: number },
	data: { name: string; description: string }
): Node<ReactFlowNodeData> {
	return {
		id,
		type: nodeType,
		position,
		data: {
			id,
			name: data.name || "Unnamed Node",
			description: data.description || "",
		},
	};
}

export function transformCaseToReactFlow(
	caseData: CaseExportNested,
	options: TransformOptions = {}
): TransformResult {
	const {
		guidedPath = [],
		edgeType = "smart",
		xSpacing = 300,
		ySpacing = 180,
	} = options;

	const nodes: Node<ReactFlowNodeData>[] = [];
	const edges: Edge[] = [];

	function processNode(
		treeNode: TreeNode,
		parentId: string | null,
		x: number,
		y: number
	): void {
		// Add this node
		nodes.push(buildNode(treeNode, { x, y }));

		// Add edge from parent if exists
		if (parentId) {
			const animated = guidedPath.includes(treeNode.id);
			edges.push(buildEdge(parentId, treeNode.id, edgeType, animated));
		}

		// Process children, centered horizontally under this node
		const childCount = treeNode.children.length;
		if (childCount > 0) {
			const totalWidth = (childCount - 1) * xSpacing;
			const startX = x - totalWidth / 2;

			for (const [index, child] of treeNode.children.entries()) {
				const childX = startX + index * xSpacing;
				processNode(child, treeNode.id, childX, y + ySpacing);
			}
		}
	}

	// Start processing from root
	processNode(caseData.tree, null, 400, 0);

	return { nodes, edges };
}
