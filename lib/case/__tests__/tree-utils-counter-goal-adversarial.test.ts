import { describe, expect, it } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { convertAssuranceCase } from "../convert-case";
import {
	addHiddenProp,
	findSiblingHiddenState,
	toggleHiddenForChildren,
	toggleHiddenForParent,
} from "../tree-utils";
import type { ReactFlowNode } from "../types";

/**
 * Searching, collapsing and expanding the nested case reach counter-goals: a
 * counter-goal hangs from the element it challenges (goal, strategy, claim,
 * evidence or another counter-goal) in that element's `goals` list.
 */

interface Item {
	id: string;
	type: string;
	[key: string]: unknown;
}

function item(
	id: string,
	type: string,
	children: Record<string, Item[]> = {}
): Item {
	return { id, type, name: id, hidden: false, ...children };
}

/** G1 with a counter-goal against each kind of element, and a deep branch under one. */
function buildCase(rootType = "AssuranceCase"): AssuranceCaseResponse {
	const supportForEvidenceCounter = item("P3", "property_claim", {
		propertyClaims: [],
		strategies: [],
		evidence: [],
	});
	const counterOnEvidence = item("CG-e", "goal", {
		goals: [item("CG-nested", "goal")],
		propertyClaims: [supportForEvidenceCounter],
		strategies: [],
	});
	const evidence = item("E1", "evidence", { goals: [counterOnEvidence] });
	const counterOnClaim = item("CG-p", "goal", {
		propertyClaims: [],
		strategies: [],
	});
	const claim = item("P1", "property_claim", {
		propertyClaims: [],
		strategies: [],
		evidence: [evidence],
		goals: [counterOnClaim],
	});
	const counterOnStrategy = item("CG-s", "goal", {
		propertyClaims: [],
		strategies: [],
	});
	const strategy = item("S1", "strategy", {
		propertyClaims: [
			item("P2", "property_claim", {
				propertyClaims: [],
				strategies: [],
				evidence: [],
			}),
		],
		goals: [counterOnStrategy],
	});
	const counterOnGoal = item("CG-g", "goal", {
		propertyClaims: [],
		strategies: [],
	});
	const goal = item("G1", "goal", {
		propertyClaims: [claim],
		strategies: [strategy],
		goals: [counterOnGoal],
	});
	return {
		id: "case-1",
		type: rootType,
		name: "Case",
		goals: [goal],
	} as unknown as AssuranceCaseResponse;
}

function find(root: unknown, id: string): Record<string, unknown> | undefined {
	if (Array.isArray(root)) {
		for (const entry of root) {
			const found = find(entry, id);
			if (found) {
				return found;
			}
		}
		return;
	}
	if (typeof root !== "object" || root === null) {
		return;
	}
	const record = root as Record<string, unknown>;
	if (record.id === id) {
		return record;
	}
	for (const [key, value] of Object.entries(record)) {
		if (key === "context" || key === "comments") {
			continue;
		}
		const found = find(value, id);
		if (found) {
			return found;
		}
	}
	return;
}

function ids(root: unknown): string[] {
	const found: string[] = [];
	const visit = (value: unknown) => {
		if (Array.isArray(value)) {
			for (const entry of value) {
				visit(entry);
			}
		} else if (typeof value === "object" && value !== null) {
			const record = value as Record<string, unknown>;
			if (typeof record.id === "string") {
				found.push(record.id);
			}
			for (const [key, child] of Object.entries(record)) {
				if (key !== "context" && key !== "comments") {
					visit(child);
				}
			}
		}
	};
	visit(root);
	return found;
}

function shownIds(root: unknown, out: string[] = []): string[] {
	if (Array.isArray(root)) {
		for (const entry of root) {
			shownIds(entry, out);
		}
	} else if (typeof root === "object" && root !== null) {
		const record = root as Record<string, unknown>;
		if (typeof record.id === "string" && record.hidden === false) {
			out.push(record.id);
		}
		for (const [key, child] of Object.entries(record)) {
			if (key !== "context" && key !== "comments") {
				shownIds(child, out);
			}
		}
	}
	return out;
}

function hiddenEverywhere(
	assuranceCase: AssuranceCaseResponse
): AssuranceCaseResponse {
	const copy = JSON.parse(JSON.stringify(assuranceCase));
	const mark = (value: unknown) => {
		if (Array.isArray(value)) {
			for (const entry of value) {
				mark(entry);
			}
		} else if (typeof value === "object" && value !== null) {
			const record = value as Record<string, unknown>;
			if ("hidden" in record) {
				record.hidden = true;
			}
			for (const child of Object.values(record)) {
				mark(child);
			}
		}
	};
	mark(copy.goals);
	return copy;
}

function nodeFor(id: string, type: string): ReactFlowNode {
	return { data: { id, type } } as unknown as ReactFlowNode;
}

const ANCESTRY: [string, string, string[]][] = [
	["a counter-goal against the top goal", "CG-g", ["CG-g", "G1"]],
	["a counter-goal against a strategy", "CG-s", ["CG-s", "S1", "G1"]],
	["a counter-goal against a claim", "CG-p", ["CG-p", "P1", "G1"]],
	["a counter-goal against evidence", "CG-e", ["CG-e", "E1", "P1", "G1"]],
	[
		"a claim supporting a counter-goal against evidence",
		"P3",
		["P3", "CG-e", "E1", "P1", "G1"],
	],
	[
		"a counter-goal against a counter-goal",
		"CG-nested",
		["CG-nested", "CG-e", "E1", "P1", "G1"],
	],
];

describe("toggleHiddenForParent reaches counter-goals", () => {
	it.each(
		ANCESTRY
	)("shows %s and everything above it", (_label, target, chain) => {
		const hidden = hiddenEverywhere(buildCase());

		const result = toggleHiddenForParent(nodeFor(target, "goal"), hidden);

		for (const id of chain) {
			expect(find(result.goals, id)?.hidden, id).toBe(false);
		}
		// Elements off that path stay hidden.
		const offPath = ids(result.goals).filter((id) => !chain.includes(id));
		expect(offPath.length).toBeGreaterThan(0);
		for (const id of offPath) {
			expect(find(result.goals, id)?.hidden, id).toBe(true);
		}
	});

	it("leaves the case it was given untouched", () => {
		const hidden = hiddenEverywhere(buildCase());
		const before = JSON.stringify(hidden);

		toggleHiddenForParent(nodeFor("CG-e", "goal"), hidden);

		expect(JSON.stringify(hidden)).toBe(before);
	});
});

describe("search order for a case without counter-goals", () => {
	function plainCase(rootType: string): AssuranceCaseResponse {
		return {
			id: "case-1",
			type: rootType,
			name: "Case",
			goals: [
				item("G1", "goal", {
					strategies: [
						item("S1", "strategy", {
							propertyClaims: [
								item("P2", "property_claim", {
									propertyClaims: [],
									strategies: [],
									evidence: [item("E2", "evidence")],
								}),
							],
						}),
					],
					propertyClaims: [
						item("P1", "property_claim", {
							propertyClaims: [],
							strategies: [],
							evidence: [item("E1", "evidence")],
						}),
					],
				}),
			],
		} as unknown as AssuranceCaseResponse;
	}

	it("shows a claim under a strategy and its ancestors", () => {
		const hidden = hiddenEverywhere(plainCase("AssuranceCase"));

		const result = toggleHiddenForParent(
			nodeFor("P2", "property_claim"),
			hidden
		);

		for (const id of ["P2", "S1", "G1"]) {
			expect(find(result.goals, id)?.hidden, id).toBe(false);
		}
		for (const id of ["P1", "E1", "E2"]) {
			expect(find(result.goals, id)?.hidden, id).toBe(true);
		}
	});

	it("shows evidence's claim chain no further than before: evidence itself is not searched", () => {
		const hidden = hiddenEverywhere(plainCase("AssuranceCase"));

		const result = toggleHiddenForParent(nodeFor("E1", "evidence"), hidden);

		// Evidence hangs from its claim, which the search reaches; the claim and
		// the goal above are shown with it.
		for (const id of ["E1", "P1", "G1"]) {
			expect(find(result.goals, id)?.hidden, id).toBe(false);
		}
		expect(find(result.goals, "S1")?.hidden).toBe(true);
	});

	it.each([
		["E", ["G1", "X", "E"]],
		["V", ["G1", "X", "V"]],
		["U", ["G1", "X", "T", "U"]],
		["Pb", ["G1", "Sb", "Pb"]],
		["Pa", ["G1", "Pa"]],
	])("reveals the same chain as before for evidence that appears in several places (target %s)", (target, chain) => {
		const claimWith = (id: string, children: Record<string, Item[]> = {}) =>
			item(id, "property_claim", {
				propertyClaims: [],
				strategies: [],
				evidence: [],
				...children,
			});
		const copy = () => item("E", "evidence");
		const tree = {
			id: "case-1",
			type: "AssuranceCase",
			name: "Case",
			goals: [
				item("G1", "goal", {
					propertyClaims: [
						claimWith("Pa", { evidence: [copy()] }),
						claimWith("X", {
							evidence: [copy()],
							propertyClaims: [claimWith("V", { evidence: [copy()] })],
							strategies: [
								item("T", "strategy", {
									propertyClaims: [claimWith("U", { evidence: [copy()] })],
								}),
							],
						}),
					],
					strategies: [
						item("Sb", "strategy", {
							propertyClaims: [claimWith("Pb", { evidence: [copy()] })],
						}),
					],
				}),
			],
		} as unknown as AssuranceCaseResponse;
		const hidden = hiddenEverywhere(tree);

		const result = toggleHiddenForParent(nodeFor(target, "x"), hidden);

		expect(shownIds(result.goals).sort()).toEqual([...chain].sort());
	});

	function claimOf(id: string, children: Record<string, Item[]> = {}) {
		return item(id, "property_claim", {
			propertyClaims: [],
			strategies: [],
			evidence: [],
			...children,
		});
	}

	function caseOf(claimX: Item) {
		return {
			id: "case-1",
			type: "AssuranceCase",
			name: "Case",
			goals: [
				item("G1", "goal", {
					propertyClaims: [claimX],
					strategies: [],
				}),
			],
		} as unknown as AssuranceCaseResponse;
	}

	it("keeps looking at a claim's nested claims before its own evidence", () => {
		const tree = caseOf(
			claimOf("X", {
				propertyClaims: [claimOf("V", { evidence: [item("E", "evidence")] })],
				evidence: [item("E", "evidence")],
			})
		);

		const result = toggleHiddenForParent(
			nodeFor("E", "x"),
			hiddenEverywhere(tree)
		);

		expect(shownIds(result.goals).sort()).toEqual(["E", "G1", "V", "X"]);
	});

	it("keeps looking at a claim's strategies before its nested claims", () => {
		const tree = caseOf(
			claimOf("X", {
				strategies: [
					item("T", "strategy", {
						propertyClaims: [
							claimOf("U", { evidence: [item("E", "evidence")] }),
						],
					}),
				],
				propertyClaims: [claimOf("V", { evidence: [item("E", "evidence")] })],
			})
		);

		const result = toggleHiddenForParent(
			nodeFor("E", "x"),
			hiddenEverywhere(tree)
		);

		expect(shownIds(result.goals).sort()).toEqual(["E", "G1", "T", "U", "X"]);
	});

	it("finds nothing below the real 'assurance_case' root, counter-goals included", () => {
		const hidden = hiddenEverywhere(buildCase("assurance_case"));
		const before = JSON.stringify(hidden);

		const result = toggleHiddenForParent(nodeFor("CG-p", "goal"), hidden);

		expect(JSON.stringify(result)).toBe(before);
	});
});

describe("collapse and expand with counter-goals", () => {
	const PARENTS: [string, string, string[]][] = [
		[
			"the top goal",
			"G1",
			[
				"CG-g",
				"P1",
				"S1",
				"CG-s",
				"CG-p",
				"E1",
				"CG-e",
				"P3",
				"CG-nested",
				"P2",
			],
		],
		["a strategy", "S1", ["CG-s", "P2"]],
		["a claim", "P1", ["CG-p", "E1", "CG-e", "P3", "CG-nested"]],
		["evidence", "E1", ["CG-e", "P3", "CG-nested"]],
		["a counter-goal", "CG-e", ["P3", "CG-nested"]],
	];

	it.each(
		PARENTS
	)("collapsing %s hides its counter-goals and what hangs from them, and expanding shows them again", (_label, parentId, hiddenDescendants) => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		const collapsed = toggleHiddenForChildren(start, parentId);

		for (const id of hiddenDescendants) {
			expect(find(collapsed.goals, id)?.hidden, `collapsed ${id}`).toBe(true);
		}
		expect(find(collapsed.goals, parentId)?.hidden).toBe(false);
		expect(find(collapsed.goals, "G1")?.hidden).toBe(false);

		const expanded = toggleHiddenForChildren(collapsed, parentId);

		for (const id of hiddenDescendants) {
			expect(find(expanded.goals, id)?.hidden, `expanded ${id}`).toBe(false);
		}
		// Nothing is left holding a record of its old state.
		for (const id of hiddenDescendants) {
			expect(
				find(expanded.goals, id)?.originalHidden,
				`leftover ${id}`
			).toBeUndefined();
		}
	});

	it("keeps a counter-goal that was already hidden hidden when its parent is expanded again", () => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;
		const preset = JSON.parse(JSON.stringify(start)) as AssuranceCaseResponse;
		const target = find(preset.goals, "CG-p");
		if (target) {
			target.hidden = true;
		}

		const collapsed = toggleHiddenForChildren(preset, "P1");
		const expanded = toggleHiddenForChildren(collapsed, "P1");

		expect(find(expanded.goals, "CG-p")?.hidden).toBe(true);
		expect(find(expanded.goals, "E1")?.hidden).toBe(false);
	});
});

describe("findSiblingHiddenState with counter-goals", () => {
	it("reports a parent whose only child is a counter-goal as collapsed when it is", () => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;
		const collapsed = toggleHiddenForChildren(start, "S1");

		// S1 has a claim and a counter-goal; both are hidden.
		expect(findSiblingHiddenState(collapsed, "S1")).toBe(true);
		// Evidence's only child is the counter-goal.
		const evidenceCollapsed = toggleHiddenForChildren(start, "E1");
		expect(findSiblingHiddenState(evidenceCollapsed, "E1")).toBe(true);
	});

	it("reports a parent whose only child is a counter-goal as open when it is", () => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		expect(findSiblingHiddenState(start, "E1")).toBe(false);
		expect(findSiblingHiddenState(start, "CG-p")).toBe(false);
	});

	it("finds a counter-goal by its id wherever it hangs", () => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;
		const collapsed = toggleHiddenForChildren(start, "CG-e");

		expect(findSiblingHiddenState(collapsed, "CG-e")).toBe(true);
		// A counter-goal with no children reports its own state, hidden with
		// the rest of what CG-e holds.
		expect(findSiblingHiddenState(collapsed, "CG-nested")).toBe(true);
	});
});

describe("collapse and expand reach the counter-goal cards on the canvas", () => {
	function hiddenNodeIds(assuranceCase: AssuranceCaseResponse): string[] {
		return convertAssuranceCase(
			assuranceCase as unknown as Parameters<typeof convertAssuranceCase>[0]
		)
			.caseNodes.filter((node) => node.hidden)
			.map((node) => node.id)
			.sort();
	}

	it.each([
		[
			"a claim",
			"P1",
			[
				"evidence-E1",
				"goal-CG-e",
				"goal-CG-nested",
				"goal-CG-p",
				"property-P3",
			],
		],
		["evidence", "E1", ["goal-CG-e", "goal-CG-nested", "property-P3"]],
		["a counter-goal", "CG-e", ["goal-CG-nested", "property-P3"]],
	])("collapsing %s hides its counter-goal cards, and expanding shows them again", (_label, parentId, expected) => {
		const start = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		const collapsed = toggleHiddenForChildren(start, parentId);
		const expanded = toggleHiddenForChildren(collapsed, parentId);

		expect(hiddenNodeIds(start)).toEqual([]);
		expect(hiddenNodeIds(collapsed)).toEqual(expected);
		expect(hiddenNodeIds(expanded)).toEqual([]);
	});
});
