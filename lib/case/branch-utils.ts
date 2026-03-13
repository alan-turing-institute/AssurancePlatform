import type { Edge, Node } from "reactflow";

export interface Branch {
	label: string;
	nodeIds: Set<string>;
	rootNodeId: string;
}

/**
 * Find the root node of a graph (no incoming edges, or first goal-type node).
 */
function findRoot(nodes: Node[], edges: Edge[]): Node | undefined {
	const targets = new Set(edges.map((e) => e.target));
	const root = nodes.find((n) => !targets.has(n.id));
	if (root) {
		return root;
	}
	// Fallback: first goal-type node
	return nodes.find((n) => n.type === "goal");
}

/**
 * Collect all descendants of a node via DFS.
 */
function collectSubtree(
	startId: string,
	parentToChildren: Map<string, string[]>
): Set<string> {
	const visited = new Set<string>();
	const stack = [startId];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || visited.has(current)) {
			continue;
		}
		visited.add(current);
		const children = parentToChildren.get(current) ?? [];
		for (const child of children) {
			stack.push(child);
		}
	}

	return visited;
}

/**
 * Extract branches from a graph. Each direct child of the root node
 * (whether a strategy or property claim) defines a branch containing
 * itself and all its descendants.
 */
export function extractBranches(nodes: Node[], edges: Edge[]): Branch[] {
	if (nodes.length === 0) {
		return [];
	}

	const root = findRoot(nodes, edges);
	if (!root) {
		return [];
	}

	// Build parent → children map
	const parentToChildren = new Map<string, string[]>();
	for (const edge of edges) {
		const children = parentToChildren.get(edge.source) ?? [];
		children.push(edge.target);
		parentToChildren.set(edge.source, children);
	}

	// Get direct children of root
	const directChildren = parentToChildren.get(root.id) ?? [];
	if (directChildren.length === 0) {
		return [];
	}

	// Build a lookup for node labels
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	const branches: Branch[] = [];
	for (const childId of directChildren) {
		const subtreeIds = collectSubtree(childId, parentToChildren);
		// Include root in every branch for context
		subtreeIds.add(root.id);

		const childNode = nodeMap.get(childId);
		const label =
			(childNode?.data?.name as string) ||
			(childNode?.data?.label as string) ||
			`Branch ${branches.length + 1}`;

		branches.push({
			rootNodeId: childId,
			label,
			nodeIds: subtreeIds,
		});
	}

	return branches;
}
