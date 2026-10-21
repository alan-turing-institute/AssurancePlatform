/**
 * Walking the nested case the canvas keeps in the store.
 */

/**
 * A node of the nested case, seen only as far as walking it needs: its id and
 * the lists that can hold further nodes.
 */
export interface CaseTreeNode {
	evidence?: CaseTreeNode[];
	goals?: CaseTreeNode[];
	id: string;
	propertyClaims?: CaseTreeNode[];
	strategies?: CaseTreeNode[];
}

/**
 * The lists of a node that hold further nodes. A counter-goal hangs from the
 * node it challenges, so `goals` sits beside the ordinary children and a
 * counter-goal can be met beneath any goal, strategy, claim or piece of
 * evidence.
 */
const CHILD_LISTS = [
	"propertyClaims",
	"strategies",
	"evidence",
	"goals",
] as const;

/**
 * Finds the node with the given id among the given nodes or anywhere beneath
 * them, counter-goals and what supports them included.
 */
export function findCaseNode(
	nodes: readonly CaseTreeNode[],
	id: string
): CaseTreeNode | null {
	for (const node of nodes) {
		const found = node.id === id ? node : findBeneath(node, id);
		if (found) {
			return found;
		}
	}
	return null;
}

function findBeneath(node: CaseTreeNode, id: string): CaseTreeNode | null {
	for (const key of CHILD_LISTS) {
		const found = findCaseNode(node[key] ?? [], id);
		if (found) {
			return found;
		}
	}
	return null;
}
