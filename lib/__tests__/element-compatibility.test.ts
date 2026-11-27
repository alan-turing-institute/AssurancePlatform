import { describe, expect, it } from "vitest";
import {
	canBeChildOf,
	getCompatibleChildTypes,
	getCompatibleParentTypes,
	isBeneathEvidenceRefused,
	normaliseOrphanType,
	ONLY_COUNTER_GOALS_BENEATH_EVIDENCE,
	parentTypeRefusal,
	REACTFLOW_TO_CANONICAL,
} from "@/lib/element-compatibility";

/** Every type a stored element can have, in its canonical spelling. */
const ALL_TYPES = [
	"goal",
	"strategy",
	"property_claim",
	"evidence",
	"away_goal",
	"module",
	"context",
	"justification",
	"assumption",
	"contract",
];

/** The spellings of each placeable type that callers hand to the rules. */
const SPELLINGS: Record<string, string[]> = {
	goal: ["goal", "GOAL", "Goal", " goal "],
	strategy: ["strategy", "STRATEGY", "Strategy", "\tstrategy\n"],
	property_claim: [
		"property_claim",
		"PROPERTY_CLAIM",
		"propertyClaim",
		"propertyclaim",
		"property",
		"PROPERTY",
		" property_claim ",
	],
	evidence: ["evidence", "EVIDENCE", " Evidence"],
	away_goal: ["away_goal", "AWAY_GOAL", "awayGoal", "awaygoal"],
	module: ["module", "MODULE", "Module"],
};

/** Parent type -> the whole set of child types it accepts. */
const CHILDREN: Record<string, string[]> = {
	goal: ["strategy", "property_claim", "away_goal", "module"],
	strategy: ["property_claim", "away_goal", "module"],
	property_claim: [
		"property_claim",
		"evidence",
		"strategy",
		"away_goal",
		"module",
	],
	evidence: [],
	away_goal: [],
	module: [],
	context: [],
	justification: [],
	assumption: [],
	contract: [],
};

/** Child type -> the whole set of parent types it may sit under. */
const PARENTS: Record<string, string[]> = {
	goal: [],
	strategy: ["goal", "property_claim"],
	property_claim: ["goal", "strategy", "property_claim"],
	evidence: ["property_claim"],
	away_goal: ["goal", "strategy", "property_claim"],
	module: ["goal", "strategy", "property_claim"],
	context: [],
	justification: [],
	assumption: [],
	contract: [],
};

const PARENT_ID_REFUSAL = /^parentId /;

const sorted = (values: string[]): string[] => [...values].sort();
const childrenOf = (type: string): string[] => CHILDREN[type] ?? [];
const parentsOf = (type: string): string[] => PARENTS[type] ?? [];

const spellingRows = Object.entries(SPELLINGS).flatMap(([type, spellings]) =>
	spellings.map((spelling) => [type, spelling] as const)
);

describe("getCompatibleChildTypes", () => {
	it.each(
		Object.entries(CHILDREN)
	)("gives every child type %s accepts and no other", (parent, expected) => {
		expect(sorted(getCompatibleChildTypes(parent))).toStrictEqual(
			sorted(expected)
		);
	});

	it.each(spellingRows)("reads %s written as %j", (type, spelling) => {
		expect(sorted(getCompatibleChildTypes(spelling))).toStrictEqual(
			sorted(childrenOf(type))
		);
	});

	it.each([
		"",
		"widget",
		"properties",
		"away goal",
	])("gives no children for the unknown type %j", (unknown) => {
		expect(getCompatibleChildTypes(unknown)).toStrictEqual([]);
	});
});

describe("getCompatibleParentTypes", () => {
	it.each(
		Object.entries(PARENTS)
	)("gives every parent type %s may sit under and no other", (child, expected) => {
		expect(sorted(getCompatibleParentTypes(child))).toStrictEqual(
			sorted(expected)
		);
	});

	it.each(spellingRows)("reads %s written as %j", (type, spelling) => {
		expect(sorted(getCompatibleParentTypes(spelling))).toStrictEqual(
			sorted(parentsOf(type))
		);
	});

	it.each([
		"",
		"widget",
		"properties",
	])("gives no parents for the unknown type %j", (unknown) => {
		expect(getCompatibleParentTypes(unknown)).toStrictEqual([]);
	});
});

describe("canBeChildOf", () => {
	const pairs = ALL_TYPES.flatMap((parent) =>
		ALL_TYPES.map((child) => [parent, child] as const)
	);

	it.each(pairs)("answers for parent %s and child %s", (parent, child) => {
		expect(canBeChildOf(child, parent)).toBe(
			childrenOf(parent).includes(child)
		);
	});

	it.each(
		spellingRows
	)("reads the child %s written as %j", (type, spelling) => {
		expect(canBeChildOf(spelling, "property_claim")).toBe(
			childrenOf("property_claim").includes(type)
		);
		expect(canBeChildOf(spelling, "evidence")).toBe(false);
	});

	it.each(
		spellingRows
	)("reads the parent %s written as %j", (type, spelling) => {
		expect(canBeChildOf("strategy", spelling)).toBe(
			childrenOf(type).includes("strategy")
		);
		expect(canBeChildOf("evidence", spelling)).toBe(
			childrenOf(type).includes("evidence")
		);
	});

	it("refuses an unknown parent and an unknown child", () => {
		expect(canBeChildOf("strategy", "widget")).toBe(false);
		expect(canBeChildOf("widget", "goal")).toBe(false);
		expect(canBeChildOf("", "")).toBe(false);
	});
});

describe("the two directions agree", () => {
	it.each(
		ALL_TYPES
	)("lists %s as a parent of a child exactly when the child lists it as a child", (type) => {
		for (const other of ALL_TYPES) {
			const asChild = getCompatibleChildTypes(type).includes(other);
			const asParent = getCompatibleParentTypes(other).includes(type);
			expect(asParent).toBe(asChild);
		}
	});
});

describe("normaliseOrphanType", () => {
	it.each([
		[undefined, ""],
		["", ""],
		["goal", "goal"],
		["STRATEGY", "strategy"],
		["Evidence", "evidence"],
		["property_claim", "property_claim"],
		["propertyclaim", "property_claim"],
		["PropertyClaim", "property_claim"],
		["Property Claim", "property_claim"],
		["away  goal", "away_goal"],
		["Away Goal", "away_goal"],
		["a  b", "a_b"],
		["a b c", "a_b_c"],
		["property", "property"],
	])("turns %j into %j", (input, expected) => {
		expect(normaliseOrphanType(input)).toBe(expected);
	});
});

describe("REACTFLOW_TO_CANONICAL", () => {
	it("maps each canvas node type to its canonical element type", () => {
		expect(REACTFLOW_TO_CANONICAL).toStrictEqual({
			property: "property_claim",
			strategy: "strategy",
			evidence: "evidence",
			context: "context",
			goal: "goal",
			awayGoal: "away_goal",
			module: "module",
		});
	});
});

describe("isBeneathEvidenceRefused", () => {
	const evidenceSpellings = ["evidence", "EVIDENCE", " Evidence "];

	it.each(
		evidenceSpellings
	)("refuses a goal that is not a counter-goal beneath %j", (parent) => {
		expect(isBeneathEvidenceRefused({ elementType: "GOAL" }, parent)).toBe(
			true
		);
		expect(
			isBeneathEvidenceRefused(
				{ elementType: "GOAL", isDefeater: false },
				parent
			)
		).toBe(true);
		expect(
			isBeneathEvidenceRefused(
				{ elementType: "GOAL", isDefeater: null },
				parent
			)
		).toBe(true);
	});

	it.each(evidenceSpellings)("admits a counter-goal beneath %j", (parent) => {
		expect(
			isBeneathEvidenceRefused(
				{ elementType: "GOAL", isDefeater: true },
				parent
			)
		).toBe(false);
		expect(
			isBeneathEvidenceRefused(
				{ elementType: "goal", isDefeater: true },
				parent
			)
		).toBe(false);
	});

	it.each([
		"STRATEGY",
		"PROPERTY_CLAIM",
		"EVIDENCE",
		"AWAY_GOAL",
		"MODULE",
	])("refuses a %s beneath evidence even when marked as a defeater", (elementType) => {
		expect(
			isBeneathEvidenceRefused({ elementType, isDefeater: true }, "EVIDENCE")
		).toBe(true);
		expect(isBeneathEvidenceRefused({ elementType }, "EVIDENCE")).toBe(true);
	});

	it.each([
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"AWAY_GOAL",
		"MODULE",
		"",
	])("has nothing to say about a parent of type %j", (parent) => {
		expect(isBeneathEvidenceRefused({ elementType: "GOAL" }, parent)).toBe(
			false
		);
	});
});

describe("parentTypeRefusal", () => {
	const refusalPairs = ALL_TYPES.flatMap((parent) =>
		ALL_TYPES.filter(
			(child) => parent !== "evidence" && !childrenOf(parent).includes(child)
		).map((child) => [parent, child] as const)
	);

	it("admits every child that canBeChildOf admits", () => {
		for (const parent of Object.keys(CHILDREN)) {
			for (const child of childrenOf(parent)) {
				expect(
					parentTypeRefusal({ elementType: child.toUpperCase() }, parent)
				).toBeUndefined();
			}
		}
	});

	it.each(
		refusalPairs
	)("refuses a %s parent for a %s child with a parentId message naming both", (parent, child) => {
		const refusal = parentTypeRefusal({ elementType: child }, parent);
		expect(refusal).toMatch(PARENT_ID_REFUSAL);
		expect(refusal).not.toBe(ONLY_COUNTER_GOALS_BENEATH_EVIDENCE);
		expect(refusal).not.toContain("undefined");
		expect(refusal).toContain(child);
		expect(refusal).toContain(parent === "evidence" ? "evidence" : parent);
	});

	it.each(
		ALL_TYPES.filter((child) => child !== "goal")
	)("refuses %s beneath evidence with the evidence refusal", (child) => {
		expect(
			parentTypeRefusal({ elementType: child.toUpperCase() }, "EVIDENCE")
		).toBe(ONLY_COUNTER_GOALS_BENEATH_EVIDENCE);
	});

	it("refuses a plain goal beneath evidence with the evidence refusal", () => {
		expect(parentTypeRefusal({ elementType: "GOAL" }, "EVIDENCE")).toBe(
			ONLY_COUNTER_GOALS_BENEATH_EVIDENCE
		);
		expect(
			parentTypeRefusal({ elementType: "GOAL", isDefeater: false }, "EVIDENCE")
		).toBe(ONLY_COUNTER_GOALS_BENEATH_EVIDENCE);
	});

	it.each([
		"EVIDENCE",
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"AWAY_GOAL",
		"MODULE",
	])("admits a counter-goal beneath %s", (parent) => {
		expect(
			parentTypeRefusal({ elementType: "GOAL", isDefeater: true }, parent)
		).toBeUndefined();
	});

	it("does not treat the defeater flag on other types as a counter-goal", () => {
		expect(
			parentTypeRefusal(
				{ elementType: "STRATEGY", isDefeater: true },
				"STRATEGY"
			)
		).toMatch(PARENT_ID_REFUSAL);
		expect(
			parentTypeRefusal(
				{ elementType: "STRATEGY", isDefeater: true },
				"EVIDENCE"
			)
		).toBe(ONLY_COUNTER_GOALS_BENEATH_EVIDENCE);
	});

	it("starts the evidence refusal with parentId", () => {
		expect(ONLY_COUNTER_GOALS_BENEATH_EVIDENCE).toMatch(PARENT_ID_REFUSAL);
	});

	it("reads a lower-case child type when it is a counter-goal", () => {
		expect(
			parentTypeRefusal({ elementType: "goal", isDefeater: true }, "EVIDENCE")
		).toBeUndefined();
	});
});
