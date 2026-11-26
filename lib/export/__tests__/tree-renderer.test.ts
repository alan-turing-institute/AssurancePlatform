import { describe, expect, it } from "vitest";
import type { PlainTreeNode } from "@/lib/case/defined-terms";
import { exportNode } from "@/src/__tests__/utils/export-case-kit";
import {
	collectAllComments,
	collectElementsByType,
	countElementsByType,
	renderHierarchicalTree,
	shouldIncludeElement,
} from "../templates/renderers/tree-renderer";

const comment = {
	author: "ada",
	content: "Looks fine",
	createdAt: "2024-01-01",
};

/**
 * g1 (depth 0) has children [b, s, c] and s has child a. Pre-order is
 * g1, b, s, a, c, which is not the order the ids sort in. Each element is
 * named after its id. The strategy takes the given fields, so a test can put
 * it in the sandbox.
 */
function outOfOrderTree(
	strategyFields: Partial<PlainTreeNode> = {}
): PlainTreeNode {
	const a = exportNode({
		id: "a",
		name: "a",
		type: "EVIDENCE",
		comments: [comment],
	});
	const b = exportNode({
		id: "b",
		name: "b",
		type: "EVIDENCE",
		comments: [comment],
	});
	const c = exportNode({ id: "c", name: "c", type: "EVIDENCE", comments: [] });
	const s = exportNode({
		id: "s",
		name: "s",
		type: "STRATEGY",
		children: [a],
		...strategyFields,
	});
	return exportNode({
		id: "g1",
		name: "g1",
		type: "GOAL",
		comments: [comment],
		children: [b, s, c],
	});
}

/** A goal in the sandbox with one evidence element outside it. */
function sandboxRootTree(): PlainTreeNode {
	return exportNode({
		id: "g",
		name: "g",
		type: "GOAL",
		inSandbox: true,
		comments: [comment],
		children: [
			exportNode({
				id: "e",
				name: "e",
				type: "EVIDENCE",
				comments: [comment],
			}),
		],
	});
}

function ids(blocks: ReturnType<typeof renderHierarchicalTree>) {
	return blocks.map((block) =>
		block.type === "element" ? [block.node.id, block.depth] : block.type
	);
}

function idsAndDepths(found: ReturnType<typeof collectElementsByType>) {
	return found.map((item) => [item.node.id, item.depth]);
}

type Row = [
	string,
	PlainTreeNode,
	number,
	Parameters<typeof shouldIncludeElement>[2],
	boolean,
];

describe("shouldIncludeElement", () => {
	const goal = exportNode({ id: "g", type: "GOAL" });
	const sandboxed = exportNode({ id: "x", type: "GOAL", inSandbox: true });

	it.each([
		["a plain node with no options", goal, 0, {}, true],
		["a sandbox node by default", sandboxed, 0, {}, false],
		[
			"a sandbox node when sandbox is included",
			sandboxed,
			0,
			{ includeSandbox: true },
			true,
		],
		["a node at the depth limit", goal, 2, { maxDepth: 2 }, true],
		["a node one below the depth limit", goal, 3, { maxDepth: 2 }, false],
		["depth zero with a limit of zero", goal, 0, { maxDepth: 0 }, true],
	] satisfies Row[])("%s", (_name, node, depth, options, expected) => {
		expect(shouldIncludeElement(node, depth, options)).toBe(expected);
	});
});

describe("collectElementsByType", () => {
	it("returns matching elements in tree order with their depths", () => {
		const found = collectElementsByType(outOfOrderTree(), "EVIDENCE");

		expect(idsAndDepths(found)).toStrictEqual([
			["b", 1],
			["a", 2],
			["c", 1],
		]);
	});

	it("returns nothing when no element has the type", () => {
		expect(collectElementsByType(outOfOrderTree(), "CONTEXT")).toStrictEqual(
			[]
		);
	});

	it("counts depths from the depth it is given", () => {
		const found = collectElementsByType(outOfOrderTree(), "EVIDENCE", 3);

		expect(idsAndDepths(found)).toStrictEqual([
			["b", 4],
			["a", 5],
			["c", 4],
		]);
	});

	it("keeps elements at the depth limit and drops those below it", () => {
		const found = collectElementsByType(outOfOrderTree(), "EVIDENCE", 0, {
			maxDepth: 1,
		});

		expect(idsAndDepths(found)).toStrictEqual([
			["b", 1],
			["c", 1],
		]);
	});

	it("leaves out sandbox elements unless asked to include them", () => {
		const tree = exportNode({
			id: "g",
			type: "GOAL",
			children: [exportNode({ id: "e", type: "EVIDENCE", inSandbox: true })],
		});

		expect(collectElementsByType(tree, "EVIDENCE")).toStrictEqual([]);
		expect(
			collectElementsByType(tree, "EVIDENCE", 0, { includeSandbox: true })
		).toHaveLength(1);
	});

	it("still finds the elements below one that is left out, at their own depth", () => {
		const found = collectElementsByType(sandboxRootTree(), "EVIDENCE");

		expect(idsAndDepths(found)).toStrictEqual([["e", 1]]);
	});

	it("leaves out an element of the type that is in the sandbox", () => {
		expect(collectElementsByType(sandboxRootTree(), "GOAL")).toStrictEqual([]);
	});
});

describe("collectAllComments", () => {
	it("lists commented elements in tree order with their details", () => {
		const found = collectAllComments(outOfOrderTree());

		expect(found).toMatchObject([
			{ elementName: "g1", elementType: "GOAL", comments: [comment] },
			{ elementName: "b", elementType: "EVIDENCE", comments: [comment] },
			{ elementName: "a", elementType: "EVIDENCE", comments: [comment] },
		]);
	});

	it("gives a null name for an element with no name", () => {
		const tree = exportNode({ id: "g", type: "GOAL", comments: [comment] });

		expect(collectAllComments(tree)).toMatchObject([
			{ elementName: null, elementType: "GOAL", comments: [comment] },
		]);
	});

	it("skips elements whose comment list is empty", () => {
		const found = collectAllComments(outOfOrderTree());

		expect(found.map((item) => item.elementName)).not.toContain("c");
	});

	it("returns nothing for a tree without comments", () => {
		const tree = exportNode({ id: "g", type: "GOAL", comments: undefined });

		expect(collectAllComments(tree)).toStrictEqual([]);
	});

	it("keeps comments at the depth limit and drops those below it", () => {
		const found = collectAllComments(outOfOrderTree(), 0, { maxDepth: 1 });

		expect(found.map((item) => item.elementName)).toStrictEqual(["g1", "b"]);
	});

	it("still reaches commented children of an element that is left out", () => {
		const found = collectAllComments(sandboxRootTree());

		expect(found.map((item) => item.elementName)).toStrictEqual(["e"]);
	});
});

describe("countElementsByType", () => {
	it("counts every type, with zero for types the tree lacks", () => {
		expect(countElementsByType(outOfOrderTree())).toStrictEqual({
			GOAL: 1,
			CONTEXT: 0,
			STRATEGY: 1,
			PROPERTY_CLAIM: 0,
			EVIDENCE: 3,
			JUSTIFICATION: 0,
			ASSUMPTION: 0,
			MODULE: 0,
			AWAY_GOAL: 0,
			CONTRACT: 0,
		});
	});

	it("counts elements at the depth limit and not below it", () => {
		const counts = countElementsByType(outOfOrderTree(), { maxDepth: 1 });

		expect(counts.EVIDENCE).toBe(2);
		expect(counts.STRATEGY).toBe(1);
	});

	it("does not count sandbox elements unless asked to", () => {
		const tree = exportNode({
			id: "g",
			type: "GOAL",
			children: [exportNode({ id: "e", type: "EVIDENCE", inSandbox: true })],
		});

		expect(countElementsByType(tree).EVIDENCE).toBe(0);
		expect(countElementsByType(tree, { includeSandbox: true }).EVIDENCE).toBe(
			1
		);
	});
});

describe("renderHierarchicalTree", () => {
	it("emits one element block per node in tree order, with its depth", () => {
		expect(ids(renderHierarchicalTree(outOfOrderTree()))).toStrictEqual([
			["g1", 0],
			["b", 1],
			["s", 1],
			["a", 2],
			["c", 1],
		]);
	});

	it("hands over the node itself", () => {
		const tree = outOfOrderTree();

		expect(renderHierarchicalTree(tree)[0]).toStrictEqual({
			type: "element",
			node: tree,
			depth: 0,
		});
	});

	it("keeps nodes at the depth limit and drops those below it", () => {
		const blocks = renderHierarchicalTree(outOfOrderTree(), 0, { maxDepth: 1 });

		expect(ids(blocks)).toStrictEqual([
			["g1", 0],
			["b", 1],
			["s", 1],
			["c", 1],
		]);
	});

	it("still renders the children of a node that is left out, at their own depth", () => {
		const blocks = renderHierarchicalTree(outOfOrderTree({ inSandbox: true }));

		expect(ids(blocks)).toStrictEqual([
			["g1", 0],
			["b", 1],
			["a", 2],
			["c", 1],
		]);
	});

	it("renders the children of a root that is left out", () => {
		expect(ids(renderHierarchicalTree(sandboxRootTree()))).toStrictEqual([
			["e", 1],
		]);
	});
});
