import type { Edge, Node } from "reactflow";
import { describe, expect, it } from "vitest";
import {
	CASE_EDGE_HIGHLIGHT_CLASS,
	getHighlightedEdges,
} from "../edge-highlight";

function node(id: string, selected = false): Node {
	return { id, position: { x: 0, y: 0 }, data: {}, selected };
}

function edge(id: string, source: string, target: string): Edge {
	return { id, source, target, type: "support" };
}

describe("getHighlightedEdges", () => {
	it("returns the same array reference when no node is selected", () => {
		const nodes = [node("g1"), node("s1")];
		const edges = [edge("e1", "g1", "s1")];

		expect(getHighlightedEdges(edges, nodes)).toBe(edges);
	});

	it("highlights only edges whose source or target is the selected node", () => {
		const nodes = [node("cp1", true), node("g1"), node("e4"), node("s1")];
		const edges = [
			edge("challenges", "cp1", "g1"),
			edge("support-e4", "cp1", "e4"),
			edge("support-s1", "g1", "s1"),
		];

		const result = getHighlightedEdges(edges, nodes);

		const bySource = (id: string) => result.find((e) => e.id === id);

		expect(bySource("challenges")?.data?.highlighted).toBe(true);
		expect(bySource("challenges")?.className).toContain(
			CASE_EDGE_HIGHLIGHT_CLASS
		);
		expect(bySource("support-e4")?.data?.highlighted).toBe(true);
		expect(bySource("support-e4")?.className).toContain(
			CASE_EDGE_HIGHLIGHT_CLASS
		);

		// G1 is not selected, so its own edge to S1 is untouched — same
		// object reference as the input, not just visually unchanged.
		expect(bySource("support-s1")).toBe(edges[2]);
	});

	it("raises the highlighted edge's zIndex so it draws above the shared rail", () => {
		const nodes = [node("cp1", true), node("e4")];
		const edges = [edge("support-e4", "cp1", "e4")];

		const result = getHighlightedEdges(edges, nodes).at(0);

		expect(result?.zIndex).toBeGreaterThan(0);
	});

	it("preserves existing edge data (e.g. layout-helper's centerY bend) alongside the highlight flag", () => {
		const nodes = [node("cp1", true), node("e4")];
		const edges = [
			{ ...edge("support-e4", "cp1", "e4"), data: { centerY: 120 } },
		];

		const result = getHighlightedEdges(edges, nodes).at(0);

		expect(result?.data).toEqual({ centerY: 120, highlighted: true });
	});

	it("highlights edges of every selected node in a multi-select", () => {
		const nodes = [node("g1", true), node("cp1", true), node("s1"), node("e4")];
		const edges = [edge("g1-s1", "g1", "s1"), edge("cp1-e4", "cp1", "e4")];

		const result = getHighlightedEdges(edges, nodes);

		expect(result.every((e) => e.data?.highlighted)).toBe(true);
	});

	it("clears the highlight once no node is selected (deselect)", () => {
		const selectedNodes = [node("cp1", true), node("e4")];
		const edges = [edge("support-e4", "cp1", "e4")];

		const highlighted = getHighlightedEdges(edges, selectedNodes);
		expect(highlighted.at(0)?.data?.highlighted).toBe(true);

		const deselectedNodes = [node("cp1", false), node("e4", false)];
		const cleared = getHighlightedEdges(edges, deselectedNodes);
		expect(cleared).toBe(edges);
		expect(cleared.at(0)?.data?.highlighted).toBeUndefined();
	});
});
