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
 * g1, b, s, a, c, which is not the order the ids sort in.
 */
function outOfOrderTree(): PlainTreeNode {
	const a = exportNode({ id: "a", type: "EVIDENCE", comments: [comment] });
	const b = exportNode({ id: "b", type: "EVIDENCE", comments: [comment] });
	const c = exportNode({ id: "c", type: "EVIDENCE", comments: [] });
	const s = exportNode({ id: "s", type: "STRATEGY", children: [a] });
	return exportNode({
		id: "g1",
		type: "GOAL",
		comments: [comment],
		children: [b, s, c],
	});
}

function ids(blocks: ReturnType<typeof renderHierarchicalTree>) {
	return blocks.map((block) =>
		block.type === "element" ? [block.node.id, block.depth] : block.type
	);
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
		["a listed type", goal, 0, { includeTypes: ["GOAL"] }, true],
		["an unlisted type", goal, 0, { includeTypes: ["EVIDENCE"] }, false],
		["an excluded type", goal, 0, { excludeTypes: ["GOAL"] }, false],
		["a type not excluded", goal, 0, { excludeTypes: ["EVIDENCE"] }, true],
	] satisfies Row[])("%s", (_name, node, depth, options, expected) => {
		expect(shouldIncludeElement(node, depth, options)).toBe(expected);
	});
});

describe("collectElementsByType", () => {
	it("returns matching elements in tree order with their depths", () => {
		const found = collectElementsByType(outOfOrderTree(), "EVIDENCE");
		expect(found.map((item) => [item.node.id, item?.depth])).toStrictEqual([
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

	it("keeps elements at the depth limit and drops those below it", () => {
		const found = collectElementsByType(outOfOrderTree(), "EVIDENCE", 0, {
			maxDepth: 1,
		});
		expect(found.map((item) => item.node.id)).toStrictEqual(["b", "c"]);
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

	it("gives each element a heading with its type label and name", () => {
		const node = exportNode({ id: "p", type: "PROPERTY_CLAIM", name: "Fair" });
		const [item] = collectElementsByType(node, "PROPERTY_CLAIM");
		expect(item?.blocks).toStrictEqual([
			{ type: "heading", level: 2, text: "Property Claim: Fair" },
		]);
	});

	it("uses only the type label as heading text when the element has no name", () => {
		const [item] = collectElementsByType(
			exportNode({ id: "g", type: "AWAY_GOAL" }),
			"AWAY_GOAL"
		);
		expect(item?.blocks[0]).toStrictEqual({
			type: "heading",
			level: 2,
			text: "Away Goal",
		});
	});

	it.each([
		[0, 2],
		[3, 5],
		[4, 6],
		[5, 6],
	])("sets the heading level for depth %i to %i", (depth, level) => {
		const [item] = collectElementsByType(
			exportNode({ id: "g", type: "GOAL", name: "G" }),
			"GOAL",
			depth
		);
		expect(item?.depth).toBe(depth);
		expect(item?.blocks[0]).toMatchObject({ type: "heading", level });
	});

	it("adds the description, then each field it has, in a fixed order", () => {
		const node = exportNode({
			id: "g",
			type: "GOAL",
			name: "G",
			description: "Why",
			assumption: "Assume",
			justification: "Because",
			context: ["one", "two"],
			url: "https://example.org/e",
		});
		const [item] = collectElementsByType(node, "GOAL");
		expect(item?.blocks.slice(1)).toStrictEqual([
			{ type: "paragraph", text: "Why" },
			{ type: "metadata", key: "Assumption", value: "Assume" },
			{ type: "metadata", key: "Justification", value: "Because" },
			{ type: "metadata", key: "Context", value: "one, two" },
			{ type: "metadata", key: "URL", value: "https://example.org/e" },
		]);
	});

	it("adds only the heading when the element has no optional fields", () => {
		const node = exportNode({ id: "g", type: "GOAL", name: "G", context: [] });
		const [item] = collectElementsByType(node, "GOAL");
		expect(item?.blocks).toHaveLength(1);
	});

	it("shows the module reference and, only then, its summary", () => {
		const withRef = exportNode({
			id: "m",
			type: "MODULE",
			moduleReferenceId: "mod-1",
			modulePublicSummary: "Public text",
		});
		const withoutRef = exportNode({
			id: "n",
			type: "MODULE",
			modulePublicSummary: "Hidden",
		});
		expect(
			collectElementsByType(withRef, "MODULE")[0]?.blocks.slice(1)
		).toStrictEqual([
			{ type: "metadata", key: "Module Reference", value: "mod-1" },
			{ type: "metadata", key: "Module Summary", value: "Public text" },
		]);
		expect(collectElementsByType(withoutRef, "MODULE")[0]?.blocks).toHaveLength(
			1
		);
	});

	it("omits the module summary when the module has none", () => {
		const node = exportNode({
			id: "m",
			type: "MODULE",
			moduleReferenceId: "mod-1",
		});
		expect(
			collectElementsByType(node, "MODULE")[0]?.blocks.slice(1)
		).toStrictEqual([
			{ type: "metadata", key: "Module Reference", value: "mod-1" },
		]);
	});

	it.each([
		["names the element it defeats", "g-2", "Defeats: g-2"],
		["says Yes when it defeats no element", undefined, "Yes"],
	])("marks a defeater and %s", (_name, defeatsElementId, value) => {
		const node = exportNode({
			id: "d",
			type: "GOAL",
			isDefeater: true,
			defeatsElementId,
		});
		expect(
			collectElementsByType(node, "GOAL")[0]?.blocks.slice(1)
		).toStrictEqual([{ type: "metadata", key: "Defeater", value }]);
	});

	it("does not mark a node that is not a defeater", () => {
		const node = exportNode({ id: "d", type: "GOAL", isDefeater: false });
		expect(collectElementsByType(node, "GOAL")[0]?.blocks).toHaveLength(1);
	});
});

describe("collectAllComments", () => {
	it("lists commented elements in tree order with their details", () => {
		const found = collectAllComments(outOfOrderTree());
		expect(found).toStrictEqual([
			{
				elementId: "g1",
				elementName: null,
				elementType: "GOAL",
				comments: [comment],
			},
			{
				elementId: "b",
				elementName: null,
				elementType: "EVIDENCE",
				comments: [comment],
			},
			{
				elementId: "a",
				elementName: null,
				elementType: "EVIDENCE",
				comments: [comment],
			},
		]);
	});

	it("skips elements whose comment list is empty", () => {
		const found = collectAllComments(outOfOrderTree());
		expect(found.map((item) => item.elementId)).not.toContain("c");
	});

	it("returns nothing for a tree without comments", () => {
		const tree = exportNode({ id: "g", type: "GOAL", comments: undefined });
		expect(collectAllComments(tree)).toStrictEqual([]);
	});

	it("keeps comments at the depth limit and drops those below it", () => {
		const found = collectAllComments(outOfOrderTree(), 0, { maxDepth: 1 });
		expect(found.map((item) => item.elementId)).toStrictEqual(["g1", "b"]);
	});

	it("still reaches commented children of an element that is filtered out", () => {
		const found = collectAllComments(outOfOrderTree(), 0, {
			excludeTypes: ["STRATEGY", "GOAL"],
		});
		expect(found.map((item) => item.elementId)).toStrictEqual(["b", "a"]);
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

	it("still renders the children of a filtered-out node, at their own depth", () => {
		const blocks = renderHierarchicalTree(outOfOrderTree(), 0, {
			excludeTypes: ["STRATEGY"],
		});
		expect(ids(blocks)).toStrictEqual([
			["g1", 0],
			["b", 1],
			["a", 2],
			["c", 1],
		]);
	});

	it("renders the children of a filtered-out root", () => {
		const blocks = renderHierarchicalTree(outOfOrderTree(), 0, {
			excludeTypes: ["GOAL"],
		});
		expect(ids(blocks)[0]).toStrictEqual(["b", 1]);
	});
});
