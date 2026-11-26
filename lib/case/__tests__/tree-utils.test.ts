import { describe, expect, it } from "vitest";
import type {
	AssuranceCaseResponse,
	GoalResponse,
} from "@/lib/services/case-response-types";
import {
	addHiddenProp,
	findParentNode,
	findSiblingHiddenState,
	toggleHiddenForChildren,
	toggleHiddenForParent,
} from "../tree-utils";
import type { ReactFlowNode } from "../types";

const NAMED_ENTRY = { id: "k3f9x2m7qa", name: "window", text: "the interval" };

function buildCase(): AssuranceCaseResponse {
	const goal = {
		id: "goal-1",
		type: "goal",
		name: "G1",
		description: "Goal",
		assuranceCaseId: "case-1",
		keywords: "",
		context: ["plain", { ...NAMED_ENTRY }],
		strategies: [],
		propertyClaims: [
			{
				id: "claim-1",
				type: "property_claim",
				name: "P1",
				description: "Claim",
				context: [{ ...NAMED_ENTRY, id: "p4n8c2d6xz" }],
				propertyClaims: [],
				strategies: [],
				evidence: [],
			},
		],
	} as unknown as GoalResponse;
	return {
		id: "case-1",
		type: "AssuranceCase",
		name: "Case",
		goals: [goal],
	} as unknown as AssuranceCaseResponse;
}

function contextOf(assuranceCase: AssuranceCaseResponse, claim = false) {
	const goal = assuranceCase.goals?.[0];
	return claim ? goal?.propertyClaims[0]?.context : goal?.context;
}

describe("tree utilities and context entries", () => {
	it("addHiddenProp flags the elements but never a named context entry", () => {
		const result = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		expect(result.goals?.[0]?.hidden).toBe(false);
		expect(result.goals?.[0]?.propertyClaims[0]?.hidden).toBe(false);
		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(contextOf(result, true)).toEqual([
			{ ...NAMED_ENTRY, id: "p4n8c2d6xz" },
		]);
	});

	it("toggleHiddenForChildren hides the children but leaves named entries alone", () => {
		const flagged = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		const result = toggleHiddenForChildren(flagged, "goal-1");

		expect(result.goals?.[0]?.propertyClaims[0]?.hidden).toBe(true);
		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(contextOf(result, true)).toEqual([
			{ ...NAMED_ENTRY, id: "p4n8c2d6xz" },
		]);
	});

	it("toggleHiddenForParent does not treat a goal's context as child elements", () => {
		const flagged = addHiddenProp(buildCase()) as AssuranceCaseResponse;
		const node = {
			data: { id: "claim-1", type: "property_claim" },
		} as unknown as ReactFlowNode;

		const result = toggleHiddenForParent(node, flagged);

		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(result.goals?.[0]?.hidden).toBe(false);
	});
});

type Loose = Record<string, unknown>;

const asCase = (value: unknown) => value as AssuranceCaseResponse;
const flowNode = (data: Loose, type?: string) =>
	({ type, data }) as unknown as ReactFlowNode;

function isRecordWithId(value: unknown): value is Loose & { id: string } {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as Loose).id === "string"
	);
}

/** Maps the id of every element in a tree to its `hidden` flag. */
function hiddenById(tree: unknown): Record<string, unknown> {
	const flags: Record<string, unknown> = {};
	JSON.stringify(tree, (_key, value: unknown) => {
		if (isRecordWithId(value)) {
			flags[value.id] = value.hidden;
		}
		return value;
	});
	return flags;
}

/** Finds an element anywhere in a tree by id. */
function elementById(tree: unknown, id: string): Loose {
	let found: Loose | undefined;
	JSON.stringify(tree, (_key, value: unknown) => {
		if (isRecordWithId(value) && value.id === id) {
			found = value;
		}
		return value;
	});
	return found as Loose;
}

const OWNER_CHILD_LISTS: [string, string][] = [
	["AssuranceCase", "goals"],
	["goal", "propertyClaims"],
	["goal", "strategies"],
	["goal", "goals"],
	["strategy", "propertyClaims"],
	["strategy", "goals"],
	["property_claim", "strategies"],
	["property_claim", "propertyClaims"],
	["property_claim", "evidence"],
	["property_claim", "goals"],
	["evidence", "goals"],
	["away_goal", "goals"],
	["module", "goals"],
];

function ownerWithChild(type: string, key: string) {
	const target = { id: "target", type: "goal", hidden: true };
	const owner = { id: "owner", type, hidden: true, [key]: [target] };
	if (type === "AssuranceCase") {
		return owner;
	}
	return { id: "root", type: "AssuranceCase", hidden: true, goals: [owner] };
}

describe("toggleHiddenForParent reaches a node through every kind of owner", () => {
	it.each(
		OWNER_CHILD_LISTS
	)("a node under the %s's %s list is found and shown with its owner", (type, key) => {
		const tree = ownerWithChild(type, key);

		const result = toggleHiddenForParent(
			flowNode({ id: "target" }),
			asCase(tree)
		);

		expect(hiddenById(result)).toMatchObject({ target: false, owner: false });
	});

	it("shows nothing when the node is not in the case", () => {
		const tree = ownerWithChild("module", "goals");

		const result = toggleHiddenForParent(
			flowNode({ id: "absent" }),
			asCase(tree)
		);

		expect(hiddenById(result)).toStrictEqual({
			root: true,
			owner: true,
			target: true,
		});
	});
});

describe("addHiddenProp on its edges", () => {
	it.each([
		["null", null],
		["text", "text"],
		["a number", 5],
	])("returns %s unchanged", (_label, value) => {
		expect(addHiddenProp(value as never)).toBe(value);
	});

	it("flags elements but not the lists that hold them", () => {
		const result = addHiddenProp(
			asCase({ id: "c", goals: [{ id: "g", propertyClaims: [{ id: "p" }] }] })
		) as AssuranceCaseResponse;

		expect("hidden" in (result.goals as object)).toBe(false);
		expect(hiddenById(result)).toStrictEqual({ c: false, g: false, p: false });
	});

	it("returns a bare list of elements without a flag on the list", () => {
		const list = [{ id: "a" }, { id: "b" }];

		const result = addHiddenProp(list as never);

		expect(result).toBe(list);
		expect("hidden" in list).toBe(false);
		expect(hiddenById(list)).toStrictEqual({ a: false, b: false });
	});

	it("flags an element held under a plain property as well", () => {
		const result = addHiddenProp(
			asCase({ id: "c", detail: { id: "d" } })
		) as unknown as { detail: Loose };

		expect(result.detail.hidden).toBe(false);
	});
});

function collapseTree() {
	return asCase({
		id: "root",
		hidden: true,
		childrenHidden: true,
		goals: [
			{ id: "sib", hidden: true, childrenHidden: true, propertyClaims: [] },
			{
				id: "par",
				hidden: false,
				propertyClaims: [
					{
						id: "kid",
						hidden: false,
						childrenHidden: true,
						propertyClaims: [
							{ id: "grand", hidden: false, childrenHidden: true },
						],
					},
				],
			},
		],
	});
}

describe("toggleHiddenForChildren touches only the parent's branch", () => {
	it("hides the descendants, records the state, and resets their own collapsed flags", () => {
		const result = toggleHiddenForChildren(collapseTree(), "par");

		expect(elementById(result, "par").childrenHidden).toBe(true);
		expect(elementById(result, "kid")).toMatchObject({
			hidden: true,
			originalHidden: false,
			childrenHidden: false,
		});
		expect(elementById(result, "grand")).toMatchObject({
			hidden: true,
			childrenHidden: false,
		});
	});

	it("leaves ancestors and siblings exactly as they were", () => {
		const input = collapseTree();

		const result = toggleHiddenForChildren(input, "par");

		expect(elementById(result, "root")).toMatchObject({
			hidden: true,
			childrenHidden: true,
		});
		expect(elementById(result, "sib")).toStrictEqual(elementById(input, "sib"));
	});

	it("does not flag the lists that hold the descendants", () => {
		const result = toggleHiddenForChildren(collapseTree(), "par");
		const par = elementById(result, "par") as { propertyClaims: object };

		expect("hidden" in par.propertyClaims).toBe(false);
		expect("originalHidden" in par.propertyClaims).toBe(false);
	});

	it("changes nothing when the parent is not in the case", () => {
		const input = collapseTree();

		const result = toggleHiddenForChildren(input, "absent");

		expect(result).toStrictEqual(input);
		expect(result).not.toBe(input);
	});

	it("shows a descendant that has no recorded original state when the parent expands", () => {
		const tree = asCase({
			id: "par",
			childrenHidden: true,
			propertyClaims: [{ id: "kid", hidden: true }],
		});

		const result = toggleHiddenForChildren(tree, "par");

		expect(elementById(result, "kid").hidden).toBe(false);
		expect(elementById(result, "par").childrenHidden).toBe(false);
	});

	it("keeps an original state that was already recorded when the parent collapses", () => {
		const tree = asCase({
			id: "par",
			propertyClaims: [{ id: "kid", hidden: false, originalHidden: true }],
		});

		const collapsed = toggleHiddenForChildren(tree, "par");
		const expanded = toggleHiddenForChildren(collapsed, "par");

		expect(elementById(collapsed, "kid")).toMatchObject({
			hidden: true,
			originalHidden: true,
		});
		expect(elementById(expanded, "kid").hidden).toBe(true);
	});

	it("passes over empty values in the tree", () => {
		const tree = asCase({
			id: "par",
			note: null,
			propertyClaims: [{ id: "kid", hidden: false, note: null }, null],
		});

		const result = toggleHiddenForChildren(tree, "par");

		expect(elementById(result, "kid").hidden).toBe(true);
	});
});

describe("findSiblingHiddenState", () => {
	it.each([
		"goals",
		"propertyClaims",
		"strategies",
		"evidence",
		"comments",
	])("reports the state of a child held in the %s list", (key) => {
		const tree = asCase({
			id: "root",
			hidden: false,
			[key]: [{ id: "c", hidden: true }],
		});

		expect(findSiblingHiddenState(tree, "root")).toBe(true);
	});

	it.each([
		"goals",
		"propertyClaims",
		"strategies",
	])("looks below a child in the %s list when the child carries no flag", (key) => {
		const tree = asCase({
			id: "root",
			hidden: false,
			[key]: [{ id: "c", evidence: [{ id: "e", hidden: true }] }],
		});

		expect(findSiblingHiddenState(tree, "root")).toBe(true);
	});

	it("falls back to the element's own flag when its children carry none", () => {
		const tree = asCase({ id: "root", hidden: true, evidence: [{ id: "e" }] });

		expect(findSiblingHiddenState(tree, "root")).toBe(true);
	});

	it("reads a child's flag even when it is unset", () => {
		const tree = asCase({
			id: "root",
			hidden: true,
			evidence: [{ id: "e", hidden: undefined }],
		});

		expect(findSiblingHiddenState(tree, "root")).toBe(false);
	});

	it("skips children that are not elements", () => {
		const tree = asCase({
			id: "root",
			hidden: true,
			evidence: [null, "text", { id: "e", hidden: false }],
		});

		expect(findSiblingHiddenState(tree, "root")).toBe(false);
	});

	it("is not confused by empty or plain entries while looking for an element", () => {
		const tree = asCase({
			id: "root",
			goals: [null, "text", { id: "g", hidden: true }],
		});

		expect(findSiblingHiddenState(tree, "g")).toBe(true);
	});

	it("does not look inside entries that have no id", () => {
		const tree = asCase({
			id: "root",
			goals: [{ propertyClaims: [{ id: "deep", hidden: true }] }],
		});

		expect(findSiblingHiddenState(tree, "deep")).toBeUndefined();
	});

	it("finds an element listed after others that do not match", () => {
		const tree = asCase({
			id: "root",
			goals: [
				{ id: "a", hidden: false },
				{ id: "b", hidden: true },
			],
		});

		expect(findSiblingHiddenState(tree, "b")).toBe(true);
	});

	it("finds a comment by id", () => {
		const tree = asCase({
			id: "root",
			hidden: false,
			comments: [{ id: "c1", hidden: true }],
		});

		expect(findSiblingHiddenState(tree, "c1")).toBe(true);
	});

	it("reports an element with no children and no flag as visible", () => {
		expect(findSiblingHiddenState(asCase({ id: "root" }), "root")).toBe(false);
	});

	it("reports nothing for an id that is not in the case", () => {
		const tree = asCase({ id: "root", hidden: false });

		expect(findSiblingHiddenState(tree, "absent")).toBeUndefined();
	});
});

describe("findParentNode", () => {
	const nodes = [
		{ id: "n-goal", type: "goal", data: { id: "g1" } },
		{ id: "n-claim", type: "property_claim", data: { id: "p1" } },
		{ id: "n-strategy", type: "strategy", data: { id: "s1" } },
	] as unknown as ReactFlowNode[];

	it.each([
		["goal", { goalId: "g1" }, "n-goal", undefined],
		["property claim", { propertyClaimId: "p1" }, "n-claim", "property_claim"],
		["strategy", { strategyId: "s1" }, "n-strategy", "strategy"],
		[
			"evidence's first claim",
			{ propertyClaimId: ["p1", "x"] },
			"n-claim",
			"evidence",
		],
	])("finds the %s a node hangs from", (_label, data, expectedId, type) => {
		const parent = findParentNode(nodes, flowNode(data, type));

		expect(parent?.id).toBe(expectedId);
	});

	it("prefers the goal, then the claim, then the strategy", () => {
		const all = { goalId: "g1", propertyClaimId: "p1", strategyId: "s1" };

		expect(findParentNode(nodes, flowNode(all))?.id).toBe("n-goal");
		expect(
			findParentNode(
				nodes,
				flowNode({ propertyClaimId: "p1", strategyId: "s1" })
			)?.id
		).toBe("n-claim");
	});

	it.each([
		["no link", {}, undefined],
		["a goal that is not on the canvas", { goalId: "zz" }, undefined],
		[
			"a claim that is not on the canvas",
			{ propertyClaimId: "zz" },
			"property_claim",
		],
		[
			"evidence whose claim is not on the canvas",
			{ propertyClaimId: ["zz"] },
			"evidence",
		],
		["a strategy that is not on the canvas", { strategyId: "zz" }, undefined],
	])("returns null for %s", (_label, data, type) => {
		expect(findParentNode(nodes, flowNode(data, type))).toBeNull();
	});

	it("reads a claim link as a plain id unless the node is evidence", () => {
		const node = flowNode({ propertyClaimId: "p1" }, "property_claim");

		expect(findParentNode(nodes, node)?.id).toBe("n-claim");
	});
});
