import { describe, expect, test } from "vitest";
import { ElementTypeSchema } from "@/lib/schemas/case-export";
import { JUDGEMENT_PROMPT, JUDGEMENT_RULE_IDS } from "../judgement-prompt";
import { RULESET } from "../ruleset";
import { RULESET_DATA } from "../ruleset-data";
import type { RuleData } from "../ruleset-types";

const RULES: RuleData[] = RULESET_DATA.rules;
const SCOPES = ["case", "element"];
const SEVERITIES = ["error", "warning", "style"];
const MECHANISMS = ["structural", "judgement"];

function isFilled(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function isFilledList(value: unknown): boolean {
	return Array.isArray(value) && value.length > 0 && value.every(isFilled);
}

/** Ids of the rules for which `check` does not hold. */
function failing(check: (rule: RuleData) => boolean): string[] {
	return RULES.filter((rule) => !check(rule)).map((rule) => rule.id);
}

/** Every text a rule carries, whichever optional parts it has. */
function textsOf(rule: RuleData): string[] {
	const parts = [
		rule.title,
		rule.statement,
		rule.fix,
		rule.question_text,
		rule.apply?.look_for,
		rule.apply?.not_when,
		rule.apply?.wording,
	];
	return parts.filter((part): part is string => part !== undefined);
}

/** The rules the reading code hands to the model: judgement, review mode, not raised as a question. */
function judgementRules(): RuleData[] {
	return RULES.filter(
		(r) =>
			r.mechanism === "judgement" &&
			r.mode.includes("review") &&
			r.question_text === undefined
	);
}

function promptBlocks(): string[] {
	return JUDGEMENT_PROMPT.split("\n\n").slice(1);
}

function blockFor(id: string): string {
	return promptBlocks().find((b) => b.startsWith(`${id} (`)) ?? "";
}

/** The texts of a rule that its prompt block carries, each closing a line. */
function blockTextsOf(rule: RuleData): string[] {
	return [
		rule.statement,
		rule.apply?.look_for,
		rule.apply?.not_when,
		rule.apply?.wording,
		rule.fix,
	].filter((part): part is string => part !== undefined);
}

function closesALine(lines: string[], text: string): boolean {
	const last = text.slice(text.lastIndexOf("\n") + 1);
	return lines.some((line) => line.endsWith(last));
}

/** What a prompt block fails to say about its rule. */
function missingFromBlock(rule: RuleData, block: string): string[] {
	const lines = block.split("\n");
	const missing = blockTextsOf(rule).filter(
		(text) => !(block.includes(text) && closesALine(lines, text))
	);
	if (lines[0] !== `${rule.id} (${rule.severity}) ${rule.title}`) {
		missing.push("header");
	}
	if (!lines.some((line) => line.includes(rule.applies_to.join(", ")))) {
		missing.push("applies_to");
	}
	return missing;
}

describe("generated ruleset data", () => {
	test("carries a version and a date", () => {
		expect(isFilled(RULESET_DATA.version)).toBe(true);
		expect(isFilled(RULESET_DATA.date)).toBe(true);
	});

	test("lists families that each have a prefix, a name and a defect", () => {
		expect(RULESET_DATA.families.length).toBeGreaterThan(0);
		for (const family of RULESET_DATA.families) {
			expect(isFilled(family.prefix)).toBe(true);
			expect(isFilled(family.name)).toBe(true);
			expect(isFilled(family.defect)).toBe(true);
		}
	});

	test("gives every family its own prefix", () => {
		const prefixes = RULESET_DATA.families.map((f) => f.prefix);
		expect(new Set(prefixes).size).toBe(prefixes.length);
	});

	test("gives every rule its own non-empty id", () => {
		expect(RULES.length).toBeGreaterThan(0);
		expect(failing((r) => isFilled(r.id))).toStrictEqual([]);
		expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
	});

	test("places every rule in exactly one listed family by its id prefix", () => {
		const prefixes = RULESET_DATA.families.map((f) => f.prefix);
		const owners = (r: RuleData) =>
			prefixes.filter((p) => r.id.startsWith(p)).length;
		expect(failing((r) => owners(r) === 1)).toStrictEqual([]);
	});

	test("holds only the allowed scope, severity and mechanism values", () => {
		expect(failing((r) => SCOPES.includes(r.scope))).toStrictEqual([]);
		expect(failing((r) => SEVERITIES.includes(r.severity))).toStrictEqual([]);
		expect(failing((r) => MECHANISMS.includes(r.mechanism))).toStrictEqual([]);
	});

	test("says for every rule whether it can be acknowledged", () => {
		expect(failing((r) => typeof r.ackable === "boolean")).toStrictEqual([]);
	});

	test("gives every rule a title and a statement", () => {
		expect(failing((r) => isFilled(r.title))).toStrictEqual([]);
		expect(failing((r) => isFilled(r.statement))).toStrictEqual([]);
	});

	test("gives every rule a non-empty list of element types it applies to", () => {
		const known: readonly string[] = ElementTypeSchema.options;
		expect(failing((r) => isFilledList(r.applies_to))).toStrictEqual([]);
		expect(
			failing((r) => r.applies_to.every((t) => known.includes(t)))
		).toStrictEqual([]);
	});

	test("gives every rule a non-empty list of modes", () => {
		expect(failing((r) => isFilledList(r.mode))).toStrictEqual([]);
	});

	test("leaves no optional text empty where it is present", () => {
		expect(
			failing((r) => textsOf(r).every((text) => isFilled(text)))
		).toStrictEqual([]);
	});

	test("gives any apply block both its look-for and not-when text", () => {
		const withApply = RULES.filter((r) => r.apply !== undefined);
		expect(withApply.length).toBeGreaterThan(0);
		for (const rule of withApply) {
			expect(isFilled(rule.apply?.look_for)).toBe(true);
			expect(isFilled(rule.apply?.not_when)).toBe(true);
		}
	});

	test("keeps question text to judgement rules", () => {
		expect(
			failing(
				(r) => r.question_text === undefined || r.mechanism === "judgement"
			)
		).toStrictEqual([]);
	});

	test("gives every rule the model applies an apply block", () => {
		for (const rule of judgementRules()) {
			expect(rule.apply).toBeDefined();
		}
	});
});

describe("judgement rule ids", () => {
	test("are unique and each names a rule in the data", () => {
		const known = new Set(RULES.map((r) => r.id));
		expect(new Set(JUDGEMENT_RULE_IDS).size).toBe(JUDGEMENT_RULE_IDS.length);
		expect(JUDGEMENT_RULE_IDS.filter((id) => !known.has(id))).toStrictEqual([]);
	});

	test("are exactly the judgement rules the checker reports as applied by the model", () => {
		const expected = judgementRules()
			.map((r) => r.id)
			.sort();
		expect([...JUDGEMENT_RULE_IDS].sort()).toStrictEqual(expected);
	});
});

describe("judgement prompt", () => {
	test("opens with an introduction before the rule blocks", () => {
		expect(isFilled(JUDGEMENT_PROMPT.split("\n\n")[0])).toBe(true);
	});

	test("has one block per judgement rule id, in the order of the id list", () => {
		const blockIds = promptBlocks().map((b) => b.split(" ")[0]);
		expect(blockIds).toStrictEqual([...JUDGEMENT_RULE_IDS]);
	});

	test("states each listed rule's own title, severity, element types and texts", () => {
		const listed = RULES.filter((r) => JUDGEMENT_RULE_IDS.includes(r.id));
		const missing = listed.map((rule) => ({
			id: rule.id,
			missing: missingFromBlock(rule, blockFor(rule.id)),
		}));
		expect(missing.filter((m) => m.missing.length > 0)).toStrictEqual([]);
	});

	test("marks a case-level rule as reported once per case and no other", () => {
		const wrong = RULES.filter((r) => JUDGEMENT_RULE_IDS.includes(r.id)).filter(
			(r) => blockFor(r.id).includes("once per case") !== (r.scope === "case")
		);
		expect(wrong.map((r) => r.id)).toStrictEqual([]);
	});

	test("leaves out rules that are not in the id list", () => {
		const stray = RULES.filter(
			(r) => !JUDGEMENT_RULE_IDS.includes(r.id)
		).filter((r) => blockFor(r.id) !== "");
		expect(stray.map((r) => r.id)).toStrictEqual([]);
	});
});

describe("RULESET built from the data", () => {
	test("looks every rule up by its id", () => {
		expect(RULESET.rules.size).toBe(RULES.length);
		expect(failing((r) => RULESET.rules.get(r.id) === r)).toStrictEqual([]);
	});

	test("lists as acknowledgeable exactly the rules marked ackable", () => {
		const expected = RULES.filter((r) => r.ackable).map((r) => r.id);
		expect([...RULESET.ackableIds].sort()).toStrictEqual(expected.sort());
	});

	test("carries the data's version and date", () => {
		expect(RULESET.version).toBe(RULESET_DATA.version);
		expect(RULESET.date).toBe(RULESET_DATA.date);
	});
});
