import type { Edge, Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { extractBranches } from "../branch-utils";

function node(id: string, type = "property", data: object = {}): Node {
	return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, target: string): Edge {
	return { id: `${source}-${target}`, source, target };
}

/** The result in a plain shape: label, branch root and the ids it holds. */
function summarise(nodes: Node[], edges: Edge[]) {
	return extractBranches(nodes, edges).map((branch) => ({
		label: branch.label,
		rootNodeId: branch.rootNodeId,
		nodeIds: [...branch.nodeIds].sort(),
	}));
}

describe("extractBranches", () => {
	it("makes one branch per child of the root, holding that child, everything below it and the root", () => {
		// The root is listed last and is not a goal: it is found as the one
		// node that nothing points to.
		const nodes = [
			node("S", "strategy", { name: "Strategy" }),
			node("P", "property", { label: "Claim" }),
			node("P2"),
			node("E", "evidence"),
			node("R", "strategy"),
		];
		const edges = [
			edge("R", "S"),
			edge("R", "P"),
			edge("S", "P2"),
			edge("P2", "E"),
		];

		expect(summarise(nodes, edges)).toStrictEqual([
			{ label: "Strategy", rootNodeId: "S", nodeIds: ["E", "P2", "R", "S"] },
			{ label: "Claim", rootNodeId: "P", nodeIds: ["P", "R"] },
		]);
	});

	it("keeps the branches in the order the root's edges are given", () => {
		const nodes = [node("R"), node("A"), node("B"), node("C")];
		const edges = [edge("R", "C"), edge("R", "A"), edge("R", "B")];

		expect(
			extractBranches(nodes, edges).map((b) => b.rootNodeId)
		).toStrictEqual(["C", "A", "B"]);
	});

	it("includes a node reached by two routes once", () => {
		const nodes = [node("R"), node("A"), node("B"), node("D")];
		const edges = [
			edge("R", "A"),
			edge("A", "B"),
			edge("A", "D"),
			edge("B", "D"),
		];

		expect(summarise(nodes, edges)).toStrictEqual([
			{ label: "Branch 1", rootNodeId: "A", nodeIds: ["A", "B", "D", "R"] },
		]);
	});

	it.each([
		["its name over its label", { name: "N", label: "L" }, "N"],
		["its label when it has no name", { label: "L" }, "L"],
		["its label when its name is empty", { name: "", label: "L" }, "L"],
		["its name when it has no label", { name: "N" }, "N"],
	])("labels a branch with %s", (_case, data, expected) => {
		const result = extractBranches(
			[node("R"), node("A", "property", data)],
			[edge("R", "A")]
		);

		expect(result[0]?.label).toBe(expected);
	});

	it("numbers a branch with no name or label by its position among the branches", () => {
		const nodes = [
			node("R"),
			node("A", "property", { name: "Named" }),
			node("B"),
			node("C"),
		];
		const edges = [edge("R", "A"), edge("R", "B"), edge("R", "C")];

		expect(extractBranches(nodes, edges).map((b) => b.label)).toStrictEqual([
			"Named",
			"Branch 2",
			"Branch 3",
		]);
	});

	it("labels a branch whose child is not among the nodes by its position", () => {
		const result = extractBranches([node("R")], [edge("R", "ghost")]);

		expect(summarise([node("R")], [edge("R", "ghost")])).toStrictEqual([
			{ label: "Branch 1", rootNodeId: "ghost", nodeIds: ["R", "ghost"] },
		]);
		expect(result).toHaveLength(1);
	});

	it("returns nothing for no nodes, even when edges are given", () => {
		expect(extractBranches([], [])).toStrictEqual([]);
		expect(extractBranches([], [edge("A", "B")])).toStrictEqual([]);
	});

	it("returns nothing when the root has no children", () => {
		expect(extractBranches([node("R")], [])).toStrictEqual([]);
	});

	it("takes the first goal as the root when every node has an edge pointing to it", () => {
		// X points to itself, so nothing is free of incoming edges. G is the
		// first goal, so it is the root; X is not below it.
		const nodes = [
			node("X", "strategy"),
			node("G", "goal"),
			node("H", "evidence"),
		];
		const edges = [edge("X", "X"), edge("X", "G"), edge("G", "H")];

		expect(summarise(nodes, edges)).toStrictEqual([
			{ label: "Branch 1", rootNodeId: "H", nodeIds: ["G", "H"] },
		]);
	});

	it("returns nothing when every node has an edge pointing to it and none is a goal", () => {
		const nodes = [node("A", "strategy"), node("B", "property")];
		const edges = [edge("A", "B"), edge("B", "A")];

		expect(extractBranches(nodes, edges)).toStrictEqual([]);
	});

	it("leaves an empty id out of the branch it hangs from", () => {
		const nodes = [node("R"), node(""), node("X")];
		const edges = [edge("R", ""), edge("", "X")];

		expect(summarise(nodes, edges)).toStrictEqual([
			{ label: "Branch 1", rootNodeId: "", nodeIds: ["R"] },
		]);
	});
});
