/**
 * Selected-node edge highlight.
 *
 * Since PR #963, every `support` edge leaving a cell (a node plus its
 * side-attached defeaters, ADR 0005) bends on one shared horizontal rail
 * below the cell, so several edges overlap and a reader can't tell which
 * defeater a downstream edge actually hangs from (found in the 2026-09-15
 * staging walkthrough). Chris ruled against staggering the rails ("would
 * make the case look messy again") — instead, when a node is selected, its
 * connected edges get a distinct highlighted style so the path can be
 * traced.
 *
 * `getHighlightedEdges` is the pure derivation `components/cases/flow.tsx`
 * memoises over `[edges, nodes]` and feeds to `<ReactFlow edges={...}>` —
 * the store's own `edges` state is never mutated, so deselecting (which
 * drops every node's `selected` flag) naturally reverts to the untouched
 * array with no highlight props at all.
 */

import type { Edge, Node } from "reactflow";
import { cn } from "@/lib/utils";

/** Landed on the edge's wrapping `<g class="react-flow__edge …">` by React
 * Flow itself (`edge.className`) — the stable hook e2e/unit assertions use
 * to prove an edge is (or isn't) highlighted. */
export const CASE_EDGE_HIGHLIGHT_CLASS = "case-edge--highlighted";

/** Draws a highlighted edge above the shared rail (ADR 0005 D8's bend) —
 * every ordinary edge is level 0, so any positive `zIndex` puts this edge's
 * `<svg>` layer on top, regardless of draw order. */
const HIGHLIGHTED_EDGE_Z_INDEX = 1000;

/**
 * Marks every edge whose `source` or `target` is a currently selected node.
 * Support and challenges edges (`components/cases/support-edge.tsx`,
 * `challenges-edge.tsx`) read `data.highlighted` to style their own path;
 * `CASE_EDGE_HIGHLIGHT_CLASS` is set here so the wrapping element is
 * queryable without needing a highlighted node's edge component internals.
 *
 * No selection: returns `edges` unchanged (same array reference) so the
 * unselected canvas renders pixel-for-pixel as before. Multi-select: every
 * edge touching ANY selected node is highlighted — cheap, since this is one
 * pass over `edges` regardless of how many nodes are selected.
 */
export function getHighlightedEdges(edges: Edge[], nodes: Node[]): Edge[] {
	const selectedNodeIds = new Set(
		nodes.filter((node) => node.selected).map((node) => node.id)
	);

	if (selectedNodeIds.size === 0) {
		return edges;
	}

	return edges.map((edge) => {
		const isHighlighted =
			selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);

		if (!isHighlighted) {
			return edge;
		}

		return {
			...edge,
			className: cn(edge.className, CASE_EDGE_HIGHLIGHT_CLASS),
			zIndex: HIGHLIGHTED_EDGE_Z_INDEX,
			data: { ...edge.data, highlighted: true },
		};
	});
}
