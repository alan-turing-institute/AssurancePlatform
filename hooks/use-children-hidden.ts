"use client";

import type { Node } from "reactflow";
import { useNodeId } from "reactflow";
import useStore from "@/store/store";

/**
 * Whether the node has children and every one of them is hidden. Collapsing a
 * node writes `hidden` on each of its descendants (`toggleHiddenForChildren`),
 * so this reads the nodes the canvas holds rather than the state of the
 * collapse button, which does not follow a node whose children are only
 * evidence.
 */
function childrenAreHidden(nodes: Node[], nodeId: string): boolean {
	let hasChild = false;
	for (const node of nodes) {
		if (node.data?.parentId !== nodeId) {
			continue;
		}
		if (!node.hidden) {
			return false;
		}
		hasChild = true;
	}
	return hasChild;
}

/** Whether the canvas node being rendered is collapsed, so none of its children is drawn. */
export function useChildrenHidden(): boolean {
	const nodeId = useNodeId();
	return useStore((state) =>
		nodeId === null ? false : childrenAreHidden(state.nodes, nodeId)
	);
}
