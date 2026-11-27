import { describe, expect, it } from "vitest";
import {
	fromCollectionName,
	toDisplayType,
	toPrefix,
	toPrismaType,
} from "@/lib/element-types";

/** Prisma type -> every spelling callers hand to `toPrismaType`. */
const SPELLINGS: Record<string, string[]> = {
	GOAL: [
		"goal",
		"Goal",
		"GOAL",
		"toplevelgoal",
		"TopLevelGoal",
		"toplevelgoalnormative",
		"toplevel_normative_goal",
		"toplevel_goal",
		"toplevel normative goal",
		"toplevel  goal",
	],
	STRATEGY: ["strategy", "Strategy", "STRATEGY"],
	PROPERTY_CLAIM: [
		"property",
		"Property",
		"property_claim",
		"PROPERTY_CLAIM",
		"propertyclaim",
		"PropertyClaim",
		"Property Claim",
		"property  claim",
	],
	EVIDENCE: ["evidence", "Evidence", "EVIDENCE"],
	CONTEXT: ["context", "Context", "CONTEXT"],
	JUSTIFICATION: ["justification", "Justification", "JUSTIFICATION"],
	ASSUMPTION: ["assumption", "Assumption", "ASSUMPTION"],
	MODULE: ["module", "Module", "MODULE"],
	AWAY_GOAL: [
		"away_goal",
		"AWAY_GOAL",
		"awaygoal",
		"AwayGoal",
		"Away Goal",
		"away  goal",
	],
	CONTRACT: ["contract", "Contract", "CONTRACT"],
};

const PREFIXES: Record<string, string> = {
	GOAL: "G",
	STRATEGY: "S",
	PROPERTY_CLAIM: "P",
	EVIDENCE: "E",
	CONTEXT: "C",
	JUSTIFICATION: "J",
	ASSUMPTION: "A",
	MODULE: "M",
	AWAY_GOAL: "AG",
	CONTRACT: "Ct",
};

const DEFEATER_PREFIXES: Record<string, string> = {
	GOAL: "CG",
	STRATEGY: "CS",
	PROPERTY_CLAIM: "CP",
	EVIDENCE: "CE",
	CONTEXT: "CC",
	JUSTIFICATION: "CJ",
	ASSUMPTION: "CA",
	MODULE: "CM",
	AWAY_GOAL: "CAG",
	CONTRACT: "CCt",
};

const spellingRows = Object.entries(SPELLINGS).flatMap(([type, spellings]) =>
	spellings.map((spelling) => [spelling, type] as const)
);

describe("toPrismaType", () => {
	it.each(spellingRows)("turns %j into %s", (spelling, expected) => {
		expect(toPrismaType(spelling)).toBe(expected);
	});
});

describe("toDisplayType", () => {
	it.each(Object.keys(SPELLINGS))("lower-cases %s", (prismaType) => {
		expect(toDisplayType(prismaType)).toBe(prismaType.toLowerCase());
	});

	it.each([
		["GOAL", "goal"],
		["STRATEGY", "strategy"],
		["PROPERTY_CLAIM", "property_claim"],
		["EVIDENCE", "evidence"],
		["CONTEXT", "context"],
		["JUSTIFICATION", "justification"],
		["ASSUMPTION", "assumption"],
		["MODULE", "module"],
		["AWAY_GOAL", "away_goal"],
		["CONTRACT", "contract"],
		["goal", "goal"],
	])("turns %s into %s", (prismaType, expected) => {
		expect(toDisplayType(prismaType)).toBe(expected);
	});
});

describe("toPrefix", () => {
	it.each(
		Object.entries(PREFIXES)
	)("gives %s the prefix %s", (prismaType, expected) => {
		expect(toPrefix(prismaType)).toBe(expected);
		expect(toPrefix(prismaType, false)).toBe(expected);
	});

	it.each(
		Object.entries(DEFEATER_PREFIXES)
	)("gives a defeater of type %s the prefix %s", (prismaType, expected) => {
		expect(toPrefix(prismaType, true)).toBe(expected);
	});

	it.each([
		"",
		"WIDGET",
		"goal",
		"Goal",
	])("throws for the type %j that has no prefix", (unknown) => {
		expect(() => toPrefix(unknown)).toThrow(Error);
		expect(() => toPrefix(unknown, true)).toThrow(Error);
	});
});

describe("fromCollectionName", () => {
	it.each([
		["goals", "goal"],
		["contexts", "context"],
		["strategies", "strategy"],
		["propertyclaims", "property_claim"],
		["evidence", "evidence"],
		["awaygoals", "away_goal"],
		["modules", "module"],
	])("turns the collection %s into %s", (plural, expected) => {
		expect(fromCollectionName(plural)).toBe(expected);
	});

	it.each([
		"",
		"widgets",
		"Goals",
		"goal",
	])("returns an unrecognised name %j unchanged", (name) => {
		expect(fromCollectionName(name)).toBe(name);
	});
});
