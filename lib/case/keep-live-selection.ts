import type { Node } from "reactflow";

/**
 * Returns `nextNodes` with each node's `selected` flag taken from the live
 * node that has the same id, and `false` when no live node matches.
 *
 * A layout pass is asynchronous: by the time it finishes, the user may have
 * selected or deselected cards, so the selection it started with is stale.
 */
export const keepLiveSelection = (
	nextNodes: Node[],
	liveNodes: Node[]
): Node[] => {
	const liveSelection = new Map(
		liveNodes.map((node) => [node.id, node.selected === true])
	);
	return nextNodes.map((node) => ({
		...node,
		selected: liveSelection.get(node.id) ?? false,
	}));
};
