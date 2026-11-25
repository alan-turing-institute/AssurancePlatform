import type { Edge, Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import { layerGap, sideGap } from "@/src/__tests__/utils/export-canvas-kit";
import {
	layoutForExport,
	pruneByDepth,
	waitForRender,
} from "../document-export";

// The shared test setup replaces the whole canvas package; the bounds helpers are plain functions, so the real ones run here.
vi.mock("reactflow", async () => await vi.importActual("reactflow"));

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

	it("treats a node whose only parent is outside the given nodes as a root", () => {
		const nodes = [node("A"), node("B")];
		const edges = [edge("MISSING", "B")];

		const result = pruneByDepth(nodes, edges, 0);

		expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
		expect(result.edges).toHaveLength(0);
	});

	it("keeps a node reached by two routes at its shallowest depth", () => {
		const nodes = [node("G"), node("A"), node("B")];
		const edges = [edge("G", "A"), edge("G", "B"), edge("A", "B")];

		const result = pruneByDepth(nodes, edges, 1);

		expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "G"]);
		expect(result.edges.map((e) => e.id).sort()).toEqual([
			"A->B",
			"G->A",
			"G->B",
		]);
	});

	it("keeps the input order of nodes and edges", () => {
		const nodes = [node("C"), node("G"), node("S")];
		const edges = [edge("S", "C"), edge("G", "S")];

		const result = pruneByDepth(nodes, edges, 5);

		expect(result.nodes.map((n) => n.id)).toEqual(["C", "G", "S"]);
		expect(result.edges.map((e) => e.id)).toEqual(["S->C", "G->S"]);
	});
});

describe("waitForRender", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	/** An edge path that answers only for its shape, as a real one answers only for its own attributes. */
	function pathAttribute(d: string | null) {
		return (name: string) => (name === "d" ? d : null);
	}

	/** Make each read of the page's edge paths return the next list of path shapes. */
	function readPaths(reads: Array<Array<string | null>>) {
		let call = 0;
		vi.spyOn(document, "querySelectorAll").mockImplementation((() => {
			const paths = reads[Math.min(call, reads.length - 1)] ?? [];
			call++;
			return paths.map((d) => ({ getAttribute: pathAttribute(d) }));
		}) as unknown as typeof document.querySelectorAll);
	}

	/** Start a wait on fake timers and report whether it has finished after each stated time. */
	async function finishedAfter(...elapsedMs: number[]): Promise<boolean[]> {
		let done = false;
		waitForRender().then(() => {
			done = true;
		});
		const states: boolean[] = [];
		let previous = 0;
		for (const elapsed of elapsedMs) {
			await vi.advanceTimersByTimeAsync(elapsed - previous);
			previous = elapsed;
			states.push(done);
		}
		return states;
	}

	function fakeTimers() {
		vi.useFakeTimers({ toFake: ["setTimeout", "requestAnimationFrame"] });
	}

	it("waits one polling interval after the frames when the edge paths do not change", async () => {
		fakeTimers();
		readPaths([["M0"]]);

		expect(await finishedAfter(100, 140)).toEqual([false, true]);
	});

	it("keeps waiting while the edge paths change between polls", async () => {
		fakeTimers();
		readPaths([["M0"], ["M1"], ["M1"]]);

		expect(await finishedAfter(200, 260)).toEqual([false, true]);
	});

	it("tells apart edge paths that join to the same text", async () => {
		fakeTimers();
		readPaths([
			["a", "bc"],
			["ab", "c"],
			["ab", "c"],
		]);

		expect(await finishedAfter(200, 260)).toEqual([false, true]);
	});

	it("treats a path that gains a shape as a change", async () => {
		fakeTimers();
		readPaths([[null], ["M5"], ["M5"]]);

		expect(await finishedAfter(200, 260)).toEqual([false, true]);
	});

	it("gives up after twenty polls when the edge paths never settle", async () => {
		fakeTimers();
		let call = 0;
		vi.spyOn(document, "querySelectorAll").mockImplementation((() => [
			{ getAttribute: pathAttribute(String(call++)) },
		]) as unknown as typeof document.querySelectorAll);

		expect(await finishedAfter(1900, 2100)).toEqual([false, true]);
	});
});

describe("layoutForExport", () => {
	/** A sized node, so the aspect ratio of the diagram is known. */
	function sized(id: string, x: number, width: number, height: number): Node {
		return {
			id,
			type: "property",
			position: { x, y: 0 },
			width,
			height,
			data: { name: id },
		};
	}

	/** A root with three children, all stacked on one point so the diagram is square. */
	function family() {
		const nodes = ["R", "A", "B", "C"].map((id) => sized(id, 0, 100, 100));
		const edges = ["A", "B", "C"].map((id) => edge("R", id));
		return { nodes, edges };
	}

	function positionOf(nodes: Node[], id: string) {
		return nodes.find((n) => n.id === id)!.position;
	}

	it("returns the current direction for an empty diagram", async () => {
		const result = await layoutForExport([], [], "BT");

		expect(result.direction).toBe("BT");
		expect(result.nodes).toEqual([]);
		expect(result.edges).toEqual([]);
	});

	it("keeps the current direction for a diagram that is not wide", async () => {
		const { nodes, edges } = family();

		const result = await layoutForExport(nodes, edges, "RL");

		expect(result.direction).toBe("RL");
	});

	it("switches to left-to-right for a diagram wider than a landscape page", async () => {
		const nodes = [sized("R", 0, 100, 100), sized("A", 160, 100, 100)];

		const result = await layoutForExport(nodes, [edge("R", "A")], "TB");

		expect(result.direction).toBe("LR");
		expect(positionOf(result.nodes, "A").x).toBeGreaterThan(
			positionOf(result.nodes, "R").x
		);
	});

	it("keeps the direction for a diagram just under the landscape ratio", async () => {
		const nodes = [sized("R", 0, 100, 100), sized("A", 40, 100, 100)];

		const result = await layoutForExport(nodes, [edge("R", "A")], "TB");

		expect(result.direction).toBe("TB");
	});

	it("keeps the direction for a diagram exactly at the landscape ratio", async () => {
		const nodes = [sized("R", 0, 1024 * Math.SQRT2, 1024)];

		const result = await layoutForExport(nodes, [], "TB");

		expect(result.direction).toBe("TB");
	});

	it("switches direction for a diagram just over the landscape ratio", async () => {
		const nodes = [sized("R", 0, 1024 * Math.SQRT2 + 1, 1024)];

		const result = await layoutForExport(nodes, [], "TB");

		expect(result.direction).toBe("LR");
	});

	it("judges the ratio against a height of at least one", async () => {
		const nodes = [sized("R", 0, 1.2, 0.5)];

		const result = await layoutForExport(nodes, [], "TB");

		expect(result.direction).toBe("TB");
	});

	it("lays children below their parent in a top-to-bottom diagram", async () => {
		const { nodes, edges } = family();

		const result = await layoutForExport(nodes, edges, "TB");

		const parent = positionOf(result.nodes, "R");
		for (const id of ["A", "B", "C"]) {
			expect(positionOf(result.nodes, id).y).toBeGreaterThan(parent.y);
		}
		expect(result.edges.map((e) => e.id)).toEqual(edges.map((e) => e.id));
	});

	it("spaces siblings and layers more closely by default than the standalone layout", async () => {
		const { nodes, edges } = family();

		const compact = await layoutForExport(nodes, edges, "TB");
		const roomy = await layoutForExport(nodes, edges, "TB", {
			nodeSpacing: 40,
			layerSpacing: 60,
		});

		expect(sideGap(roomy.nodes, "A", "B")).toBeGreaterThan(
			sideGap(compact.nodes, "A", "B")
		);
		expect(layerGap(roomy.nodes, "R", "A")).toBeGreaterThan(
			layerGap(compact.nodes, "R", "A")
		);
	});

	it("uses a given node spacing and keeps the default layer spacing", async () => {
		const { nodes, edges } = family();

		const standard = await layoutForExport(nodes, edges, "TB");
		const wide = await layoutForExport(nodes, edges, "TB", {
			nodeSpacing: 200,
		});

		expect(sideGap(wide.nodes, "A", "B")).toBeGreaterThan(
			sideGap(standard.nodes, "A", "B")
		);
		expect(layerGap(wide.nodes, "R", "A")).toBe(
			layerGap(standard.nodes, "R", "A")
		);
	});

	it("uses a given layer spacing and keeps the default node spacing", async () => {
		const { nodes, edges } = family();

		const standard = await layoutForExport(nodes, edges, "TB");
		const tall = await layoutForExport(nodes, edges, "TB", {
			layerSpacing: 300,
		});

		expect(layerGap(tall.nodes, "R", "A")).toBeGreaterThan(
			layerGap(standard.nodes, "R", "A")
		);
		expect(sideGap(tall.nodes, "A", "B")).toBe(
			sideGap(standard.nodes, "A", "B")
		);
	});
});
