import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { PartialSettings } from "@/lib/schemas/health-criteria";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import {
	BOOLEAN_CHECK,
	NUMBER_CHECK,
	SYSTEM_CHECK,
} from "@/src/__tests__/fixtures/health-criteria-probe-data";
import { analyseDraft, draftFromCheck } from "../criteria-draft";
import {
	plainWords,
	remainingLines,
	ruleOutcomes,
} from "../criteria-plain-words";

const NON_EMPTY = /\S/;
const UNSET_THEN_WITHDRAWN =
	/at most \(not set\).*counts until someone withdraws it\./;

const CHECKS = buildHealthCheckList().checks as HealthCheck[];

function demo(name: string): HealthCheck {
	const found = CHECKS.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no demo check ${name}`);
	}
	return found;
}

function wordsFor(check: HealthCheck) {
	const { settings } = analyseDraft(draftFromCheck(check, "i"), check);
	return plainWords(settings, check);
}

describe("the plain words for each demo check's recommended settings", () => {
	it("a yes-or-no check judged per item", () => {
		expect(wordsFor(demo(ITEM_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about one item: “Is the surface of the item free of visible marks?”",
			"The check runs with Camera line set to ALL.",
			"A reading passes when the answer is yes and fails when the answer is no.",
			"For each item, the readings in each 1-minute window are combined by taking the average; the average passes when it is at least 80%, is marginal when it is at least 50% but below 80%, and fails when it is below 50%.",
			"If fewer than 80% of an item's readings have an answer, that item has no answer.",
			"The claim passes when at least 95% of the items pass, and fails otherwise.",
			"If fewer than 80% of the items have an answer, the claim has no result.",
			"A result counts for 5 minutes.",
		]);
	});

	it("a numeric check judged per item, with step 2 off", () => {
		expect(wordsFor(demo(NUMERIC_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about one item: “How far the edge of the item sits from its expected position.”",
			"The check runs with Tolerance profile set to standard.",
			"A reading passes when it is at most 0.5 mm, is marginal when it is above 0.5 mm but at most 1 mm, and fails when it is above 1 mm.",
			"Each result uses the readings in a 5-minute window.",
			"The claim passes when at least 90% of the items pass, and fails otherwise.",
			"If fewer than 80% of the items have an answer, the claim has no result.",
			"A result counts for 30 minutes.",
		]);
	});

	it.each([
		["PT8H", "an 8-hour window"],
		["PT11H", "an 11-hour window"],
		["PT18M", "an 18-minute window"],
		["PT5M", "a 5-minute window"],
		["PT10M", "a 10-minute window"],
		["PT1H", "a 1-hour window"],
		["PT12H", "a 12-hour window"],
	])("writes the window %s with the right article", (window, phrase) => {
		const check = demo(NUMERIC_CHECK_NAME);
		const draft = draftFromCheck(check, "i");
		const { settings } = analyseDraft(draft, check);
		const text = plainWords({ ...settings, window }, check).map((s) => s.text);
		expect(text).toContain(`Each result uses the readings in ${phrase}.`);
	});

	it("a whole-system check", () => {
		expect(wordsFor(demo(SYSTEM_CHECK_NAME)).map((s) => s.text)).toEqual([
			"Each reading is about the whole system: “How many items the line processes each minute.”",
			"A reading passes when it is at least 40 items/min, is marginal when it is at least 25 items/min but below 40 items/min, and fails when it is below 25 items/min.",
			"The claim takes the latest reading in each 10-minute window as its result.",
			"A result counts for 1 hour.",
		]);
	});
});

describe("plain words follow the form as it changes", () => {
	const numeric = demo(NUMERIC_CHECK_NAME);

	function textFor(change: (draft: ReturnType<typeof draftFromCheck>) => void) {
		const draft = draftFromCheck(numeric, "i");
		change(draft);
		return plainWords(analyseDraft(draft, numeric).settings, numeric)
			.map((sentence) => sentence.text)
			.join(" ");
	}

	it("states the direction of every shape in words", () => {
		expect(
			textFor((d) => {
				d.rule = { ...d.rule, shape: "at-least", pass: "3", marginal: "" };
			})
		).toContain("passes when it is at least 3 mm");
		expect(
			textFor((d) => {
				d.rule = {
					...d.rule,
					shape: "between",
					passLow: "1",
					passHigh: "2",
					marginalLow: "0",
					marginalHigh: "4",
				};
			})
		).toContain(
			"passes when it is between 1 mm and 2 mm, is marginal when it is between 0 mm and 4 mm but not between 1 mm and 2 mm, and fails when it is not between 0 mm and 4 mm"
		);
		expect(
			textFor((d) => {
				d.rule = { ...d.rule, shape: "one-of", passList: "1\n2" };
			})
		).toContain("passes when it is one of 1, 2");
	});

	it("says 'no time limit' as waiting for a withdrawal, and shows a value not yet entered", () => {
		expect(
			textFor((d) => {
				d.indefinite = true;
				d.rule = { ...d.rule, pass: "" };
			})
		).toMatch(UNSET_THEN_WITHDRAWN);
	});

	it("includes the percentile, readings needed and own rule of step 2", () => {
		const text = textFor((d) => {
			d.reductionOn = true;
			d.reduction = {
				...d.reduction,
				kind: "percentile",
				percentile: "95",
				readingsNeeded: "70",
				ownRule: true,
				rule: { ...d.reduction.rule, shape: "at-most", pass: "2" },
			};
		});
		expect(text).toContain(
			"taking the 95th percentile; the 95th percentile passes"
		);
		expect(text).toContain("at most 2 mm");
		expect(text).toContain("fewer than 70% of an item's readings");
	});

	it("uses the check's own words for the subjects, and the scope word when it has none", () => {
		const labelled: HealthCheck = {
			...numeric,
			scope_label: { one: "bridge", many: "bridges" },
		};
		const draft = draftFromCheck(labelled, "i");
		const text = plainWords(analyseDraft(draft, labelled).settings, labelled)
			.map((sentence) => sentence.text)
			.join(" ");
		expect(text).toContain("about one bridge");
		expect(text).toContain("of the bridges pass");
		const unlabelled: HealthCheck = { ...numeric, scope_label: undefined };
		const plain = plainWords(
			analyseDraft(draftFromCheck(unlabelled, "i"), unlabelled).settings,
			unlabelled
		)
			.map((sentence) => sentence.text)
			.join(" ");
		expect(plain).toContain("about one item");
		expect(plain).toContain("of the item subjects pass");
	});
});

type Rule = NonNullable<PartialSettings["rule"]>;

const MM = { share: false, unit: "mm" };
const TIMING: PartialSettings = { window: "PT10M", valid_for: "PT1H" };
const MAXIMISE_FIVE: Rule = {
	kind: "threshold",
	direction: "maximize",
	params: { pass_values: 5 },
};

function sentenceText(
	settings: PartialSettings,
	check: HealthCheck,
	key: string
): string | undefined {
	return plainWords(settings, check).find((s) => s.key === key)?.text;
}

describe("the outcomes of a rule whose values are missing or malformed", () => {
	const UNSET_UP = ["it is at least (not set)", "it is below (not set)"];
	const NO_PAIR = [
		"it is between (not set) and (not set)",
		"it is not between (not set) and (not set)",
	];

	it.each<[string, Rule, string[]]>([
		[
			"a maximising threshold with no params",
			withKind("threshold", "maximize"),
			UNSET_UP,
		],
		[
			"a minimising threshold with no params",
			withKind("threshold", "minimize"),
			["it is at most (not set)", "it is above (not set)"],
		],
		[
			"an infinite limit",
			{
				...withKind("threshold", "maximize"),
				params: { pass_values: Number.POSITIVE_INFINITY },
			},
			UNSET_UP,
		],
		[
			"a limit that is not a number",
			{
				...withKind("threshold", "maximize"),
				params: { pass_values: Number.NaN },
			},
			UNSET_UP,
		],
		[
			"a marginal limit that is null",
			{
				...withKind("threshold", "maximize"),
				params: { pass_values: 5, marginal_values: null },
			},
			["it is at least 5 mm", "it is below 5 mm"],
		],
		["a band with no params", withKind("band"), NO_PAIR],
		[
			"a band with one pass pair and no marginal pair",
			{ ...withKind("band"), params: { pass_values: [1, 2] } },
			["it is between 1 mm and 2 mm", "it is not between 1 mm and 2 mm"],
		],
		[
			"a band whose pass list has three numbers",
			{ ...withKind("band"), params: { pass_values: [1, 2, 3] } },
			NO_PAIR,
		],
		[
			"a band whose pass list has one number",
			{ ...withKind("band"), params: { pass_values: [1] } },
			NO_PAIR,
		],
		[
			"a band whose marginal list is not a pair",
			{
				...withKind("band"),
				params: { pass_values: [1, 2], marginal_values: [0] },
			},
			[
				"it is between 1 mm and 2 mm",
				"it is between (not set) and (not set) but not between 1 mm and 2 mm",
				"it is not between (not set) and (not set)",
			],
		],
	])("words %s", (_name, rule, expected) => {
		expect(ruleOutcomes(rule, MM).map((o) => o.text)).toStrictEqual(expected);
	});

	it("words a membership rule with no params, empty lists and given lists", () => {
		expect(ruleOutcomes(withKind("membership"), MM)[0]?.text).toBe(
			"it is one of (not set)"
		);
		const empty = ruleOutcomes(
			{
				...withKind("membership"),
				params: { pass_values: [], marginal_values: [] },
			},
			MM
		);
		expect(empty.map((o) => o.text).slice(0, 2)).toStrictEqual([
			"it is one of (not set)",
			"it is one of (not set)",
		]);
		const given = ruleOutcomes(
			{
				...withKind("membership"),
				params: { pass_values: ["a", "b"], marginal_values: ["c"] },
			},
			MM
		);
		expect(given.map((o) => o.verdict)).toStrictEqual([
			"pass",
			"marginal",
			"fail",
		]);
		expect(given.slice(0, 2).map((o) => o.text)).toStrictEqual([
			"it is one of a, b",
			"it is one of c",
		]);
	});

	it("gives a membership rule's failing case its own words with and without a marginal list", () => {
		const without = ruleOutcomes(
			{ ...withKind("membership"), params: { pass_values: ["a"] } },
			MM
		);
		const withMarginal = ruleOutcomes(
			{
				...withKind("membership"),
				params: { pass_values: ["a"], marginal_values: ["b"] },
			},
			MM
		);
		expect(without.map((o) => o.verdict)).toStrictEqual(["pass", "fail"]);
		const failWithout = without.at(-1)?.text ?? "";
		const failWith = withMarginal.at(-1)?.text ?? "";
		expect(failWithout.length).toBeGreaterThan(0);
		expect(failWith.length).toBeGreaterThan(0);
		expect(failWithout).not.toBe(failWith);
	});
});

function withKind(kind: Rule["kind"], direction?: Rule["direction"]): Rule {
	return direction === undefined ? { kind } : { kind, direction };
}

describe("the article before a subject word and before a window length", () => {
	function readingsNeeded(one: string): string | undefined {
		const check: HealthCheck = {
			...NUMBER_CHECK,
			scope_label: { one, many: `${one}s` },
		};
		const settings: PartialSettings = {
			...TIMING,
			reduction: { kind: "mean", params: { avail_floor: 0.5 } },
		};
		return sentenceText(settings, check, "readings-needed");
	}

	it.each([
		["unit", "a unit"],
		["unicorn", "a unicorn"],
		["user", "a user"],
		["one", "a one"],
		["abuse", "an abuse"],
		["alone", "an alone"],
		["hour", "an hour"],
		["heir", "an heir"],
		["honor", "an honor"],
		["honour", "an honour"],
		["honest", "an honest"],
		["their", "a their"],
		["sensor8", "a sensor8"],
		["8 mm tray", "an 8 mm tray"],
		["28 mm tray", "a 28 mm tray"],
		["80 mm tray", "an 80 mm tray"],
		["item", "an item"],
		["sensor", "a sensor"],
	])("writes the subject %s as %s", (one, phrase) => {
		expect(readingsNeeded(one)).toBe(
			`If fewer than 50% of ${phrase}'s readings have an answer, that ${one} has no answer.`
		);
	});

	it.each([
		["PT28M", "a 28-minute window"],
		["PT80M", "an 80-minute window"],
		["P1DT2H", "a 1 day 2 hours window"],
	])("writes the window %s as %s", (window, phrase) => {
		expect(sentenceText({ window }, NUMBER_CHECK, "window")).toBe(
			`Each result uses the readings in ${phrase}.`
		);
	});

	it("keeps a window of several units in words for a whole-system check", () => {
		expect(sentenceText({ window: "PT1H30M" }, SYSTEM_CHECK, "window")).toBe(
			"The claim takes the latest reading in each 1 hour 30 minutes window as its result."
		);
	});
});

describe("the combining sentence", () => {
	function reductionWith(
		reduction: PartialSettings["reduction"],
		rule?: Rule
	): PartialSettings {
		return { ...TIMING, ...(rule && { rule }), reduction };
	}

	it("judges the combined value by the reading rule, in the reading's unit, when it has no rule of its own", () => {
		const settings = reductionWith({ kind: "max" }, MAXIMISE_FIVE);
		expect(sentenceText(settings, NUMBER_CHECK, "reduction")).toBe(
			"For each widget, the readings in each 10-minute window are combined by taking the highest reading; the highest reading passes when it is at least 5 mm and fails when it is below 5 mm."
		);
	});

	it("says only how readings are combined when there is no rule, and asks for no readings needed", () => {
		const settings = reductionWith({ kind: "mean" });
		expect(sentenceText(settings, NUMBER_CHECK, "reduction")).toBe(
			"For each widget, the readings in each 10-minute window are combined by taking the average."
		);
		expect(
			sentenceText(settings, NUMBER_CHECK, "readings-needed")
		).toBeUndefined();
	});

	it.each([
		[99.5, "the 99.5th percentile"],
		[undefined, "the (not set) percentile"],
	])("names a percentile of %s", (percentile, name) => {
		const settings = reductionWith({
			kind: "percentile",
			params: percentile === undefined ? {} : { percentile },
		});
		expect(sentenceText(settings, NUMBER_CHECK, "reduction")).toContain(
			`by taking ${name}.`
		);
	});

	it("asks for readings needed only when a share is given, including zero", () => {
		const settings = reductionWith({
			kind: "mean",
			params: { avail_floor: 0 },
		});
		expect(sentenceText(settings, NUMBER_CHECK, "readings-needed")).toBe(
			"If fewer than 0% of a widget's readings have an answer, that widget has no answer."
		);
	});
});

describe("the claim sentences", () => {
	it("shows a pass share that has not been entered, and asks for no answers needed", () => {
		const settings: PartialSettings = {
			...TIMING,
			aggregation: { kind: "proportion", params: {} },
		};
		expect(sentenceText(settings, NUMBER_CHECK, "claim")).toBe(
			"The claim passes when at least (not set) of the widgets pass, and fails otherwise."
		);
		expect(
			sentenceText(settings, NUMBER_CHECK, "answers-needed")
		).toBeUndefined();
	});

	it("gives no claim sentences without an aggregation", () => {
		const keys = plainWords(TIMING, NUMBER_CHECK).map((s) => s.key);
		expect(keys).toStrictEqual(["reading", "window", "validity"]);
	});
});

describe("the sentence about the check's own settings", () => {
	const PARAMS: HealthCheck = BOOLEAN_CHECK;

	function checkSentence(
		params: Record<string, unknown> | undefined,
		check: HealthCheck = PARAMS
	): string | undefined {
		const settings = {
			...TIMING,
			check: { name: check.name, version: check.version, params },
		} as PartialSettings;
		return sentenceText(settings, check, "check-settings");
	}

	it("lists each given setting in the order the check lists them, with units, yes or no and lengths in words", () => {
		expect(
			checkSentence({
				profile: "fast",
				settle: "PT30S",
				strict: true,
				retries: 3,
				line: "ALL",
			})
		).toBe(
			"The check runs with Line name set to ALL, Retries set to 3 tries, Strict mode set to yes, Settle time set to 30 seconds, Profile set to fast."
		);
	});

	it("words false as no, and a setting that is null or not given is left out", () => {
		expect(checkSentence({ strict: false, line: null })).toBe(
			"The check runs with Strict mode set to no."
		);
	});

	it("leaves a length-like value of a text setting as it was typed", () => {
		expect(checkSentence({ line: "PT5M" })).toBe(
			"The check runs with Line name set to PT5M."
		);
	});

	it("writes a number given for a length setting with its unit", () => {
		const check: HealthCheck = {
			...NUMBER_CHECK,
			params: [{ key: "delay", label: "Delay", type: "duration", unit: "s" }],
		};
		expect(checkSentence({ delay: 90 }, check)).toBe(
			"The check runs with Delay set to 90 s."
		);
	});

	it("says nothing about names the check does not list", () => {
		expect(
			checkSentence({ undefined: 1, other: 2 }, NUMBER_CHECK)
		).toBeUndefined();
		expect(checkSentence({ line: "ALL", other: 2 })).toBe(
			"The check runs with Line name set to ALL."
		);
		expect(checkSentence(undefined)).toBeUndefined();
	});
});

describe("the reading sentence and the order of sentences", () => {
	it("ends the reading sentence after the subject when the check has no description", () => {
		const bare: HealthCheck = {
			name: "Bare",
			version: "1",
			scope: "widget",
			scope_label: { one: "widget", many: "widgets" },
			value: { type: "number", unit: "mm" },
		};
		expect(sentenceText(TIMING, bare, "reading")).toBe(
			"Each reading is about one widget."
		);
		expect(
			sentenceText(TIMING, { ...bare, scope: "environment" }, "reading")
		).toBe("Each reading is about the whole system.");
	});

	it("returns the sentences in the order a reader needs them, each under its own key", () => {
		const settings = {
			...TIMING,
			check: { name: BOOLEAN_CHECK.name, version: "3", params: { line: "A" } },
			rule: { kind: "identity" },
			reduction: { kind: "mean", params: { avail_floor: 0.6 } },
			aggregation: { kind: "proportion", params: { avail_floor: 0.5 } },
		} as PartialSettings;
		expect(plainWords(settings, BOOLEAN_CHECK).map((s) => s.key)).toStrictEqual(
			[
				"reading",
				"check-settings",
				"rule",
				"reduction",
				"readings-needed",
				"claim",
				"answers-needed",
				"validity",
			]
		);
	});
});

/** True when every line has a non-empty label and no two share one. */
function hasOwnLabels(lines: { label: string }[]): boolean {
	const labels = lines.map((l) => l.label);
	const filled = labels.every((label) => label.trim().length > 0);
	return filled && new Set(labels).size === labels.length;
}

describe("the summary lines for the blocks the short view does not edit", () => {
	it("gives a line for the source, the reading rule, the combining and the answers needed", () => {
		const settings: PartialSettings = {
			...TIMING,
			rule: { kind: "identity" },
			reduction: {
				kind: "mean",
				params: { avail_floor: 0.6 },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.8 },
				},
			},
			aggregation: { kind: "proportion", params: { avail_floor: 0.75 } },
		};
		const lines = remainingLines(settings, BOOLEAN_CHECK);
		expect(hasOwnLabels(lines)).toBe(true);
		expect(lines[2]?.label).toContain("widget");
		expect(lines.map((l) => l.text)).toStrictEqual([
			"Seal Present Check, version 3",
			"A reading passes when the answer is yes and fails when the answer is no",
			"For each widget, the readings in each 10-minute window are combined by taking the average; the average passes when it is at least 80% and fails when it is below 80%. If fewer than 60% of a widget's readings have an answer, that widget has no answer.",
			"At least 75% of the widgets need an answer.",
		]);
	});

	it("words an unused combining step and leaves out the answers needed when none is given", () => {
		const settings: PartialSettings = {
			...TIMING,
			rule: MAXIMISE_FIVE,
			aggregation: { kind: "proportion", params: {} },
		};
		expect(hasOwnLabels(remainingLines(settings, NUMBER_CHECK))).toBe(true);
		expect(
			remainingLines(settings, NUMBER_CHECK).map((l) => l.text)
		).toStrictEqual([
			"Gap Width Measure, version 1.0",
			"A reading passes when it is at least 5 mm and fails when it is below 5 mm",
			expect.stringMatching(NON_EMPTY),
		]);
		const combining = remainingLines(settings, NUMBER_CHECK)[2]?.text;
		expect(combining).not.toBe(
			remainingLines(
				{ ...settings, reduction: { kind: "mean" } },
				NUMBER_CHECK
			)[2]?.text
		);
	});

	it("gives only the source and the combining line for empty settings", () => {
		const lines = remainingLines({}, NUMBER_CHECK);
		expect(hasOwnLabels(lines)).toBe(true);
		expect(lines.map((l) => l.text)).toStrictEqual([
			"Gap Width Measure, version 1.0",
			expect.stringMatching(NON_EMPTY),
		]);
	});

	it("gives no combining or answers-needed lines for a whole-system check", () => {
		const settings: PartialSettings = {
			...TIMING,
			rule: MAXIMISE_FIVE,
			reduction: { kind: "mean" },
			aggregation: { kind: "proportion", params: { avail_floor: 0.5 } },
		};
		const lines = remainingLines(settings, SYSTEM_CHECK);
		expect(hasOwnLabels(lines)).toBe(true);
		expect(lines).toHaveLength(3);
		expect(lines[2]?.label).not.toContain("widget");
		expect(lines[0]?.text).toBe("Line Rate Monitor, version 1");
		expect(lines[1]?.text).toBe(
			"A reading passes when it is at least 5 widgets/min and fails when it is below 5 widgets/min"
		);
	});
});
