import type { Edge, Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { pruneByDepth } from "../document-export";

/** Helper to create a minimal Node for testing. */
function node(id: string): Node {
	return { id, type: "goal", position: { x: 0, y: 0 }, data: {} };
}

/** Helper to create a minimal Edge for testing. */
function edge(source: string, target: string): Edge {
	return { id: `${source}->${target}`, source, target };
}

describe("pruneByDepth", () => {
	it("returns empty arrays for empty input", () => {
		const result = pruneByDepth([], [], 3);
		expect(result.nodes).toEqual([]);
		expect(result.edges).toEqual([]);
	});

	it("returns only the root when maxDepth is 0", () => {
		const nodes = [node("G"), node("S"), node("C")];
		const edges = [edge("G", "S"), edge("S", "C")];

		const result = pruneByDepth(nodes, edges, 0);

		expect(result.nodes).toHaveLength(1);
		expect(result.nodes[0]!.id).toBe("G");
		expect(result.edges).toHaveLength(0);
	});

	it("keeps root + 1 level for maxDepth 1 (linear chain)", () => {
		const nodes = [node("G"), node("S"), node("C")];
		const edges = [edge("G", "S"), edge("S", "C")];

		const result = pruneByDepth(nodes, edges, 1);

		expect(result.nodes.map((n) => n.id).sort()).toEqual(["G", "S"]);
		expect(result.edges).toHaveLength(1);
		expect(result.edges[0]!.id).toBe("G->S");
	});

	it("returns all nodes when maxDepth >= tree depth", () => {
		const nodes = [node("G"), node("S"), node("C")];
		const edges = [edge("G", "S"), edge("S", "C")];

		const result = pruneByDepth(nodes, edges, 10);

		expect(result.nodes).toHaveLength(3);
		expect(result.edges).toHaveLength(2);
	});

	it("excludes edges whose target is pruned", () => {
		const nodes = [node("G"), node("S"), node("C")];
		const edges = [edge("G", "S"), edge("S", "C")];

		const result = pruneByDepth(nodes, edges, 1);

		const edgeIds = result.edges.map((e) => e.id);
		expect(edgeIds).toContain("G->S");
		expect(edgeIds).not.toContain("S->C");
	});

	it("prunes a branching tree correctly at depth 1", () => {
		const nodes = [node("G"), node("S1"), node("S2"), node("C1"), node("C2")];
		const edges = [
			edge("G", "S1"),
			edge("G", "S2"),
			edge("S1", "C1"),
			edge("S2", "C2"),
		];

		const result = pruneByDepth(nodes, edges, 1);

		expect(result.nodes.map((n) => n.id).sort()).toEqual(["G", "S1", "S2"]);
		expect(result.edges.map((e) => e.id).sort()).toEqual(["G->S1", "G->S2"]);
	});

	it("handles multiple disconnected roots independently", () => {
		const nodes = [node("R1"), node("A"), node("R2"), node("B")];
		const edges = [edge("R1", "A"), edge("R2", "B")];

		const result = pruneByDepth(nodes, edges, 0);

		// Only the two roots should remain
		expect(result.nodes.map((n) => n.id).sort()).toEqual(["R1", "R2"]);
		expect(result.edges).toHaveLength(0);
	});

	it("includes both roots and their children at depth 1 for disconnected subgraphs", () => {
		const nodes = [node("R1"), node("A"), node("R2"), node("B")];
		const edges = [edge("R1", "A"), edge("R2", "B")];

		const result = pruneByDepth(nodes, edges, 1);

		expect(result.nodes.map((n) => n.id).sort()).toEqual([
			"A",
			"B",
			"R1",
			"R2",
		]);
		expect(result.edges).toHaveLength(2);
	});
});
