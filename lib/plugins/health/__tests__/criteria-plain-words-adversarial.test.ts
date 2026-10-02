import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { PartialSettings } from "@/lib/schemas/health-criteria";
import {
	BOOLEAN_CHECK,
	NUMBER_CHECK,
	SYSTEM_CHECK,
	TEXT_CHECK,
} from "@/src/__tests__/fixtures/health-criteria-probe-data";
import { analyseDraft, draftFromCheck } from "../criteria-draft";
import {
	plainWords,
	remainingLines,
	ruleOutcomes,
	subjectsOf,
} from "../criteria-plain-words";

const LONG_DIGITS = /\d{6,}/;
const BROKEN_WORDS = /NaN|undefined|null|\[object|\s{2,}|\(\s*\)/;

function textOf(settings: PartialSettings, check: HealthCheck, key?: string) {
	return plainWords(settings, check)
		.filter((sentence) => key === undefined || sentence.key === key)
		.map((sentence) => sentence.text)
		.join("\n");
}

const NUMBER_BASE: PartialSettings = {
	check: { name: NUMBER_CHECK.name, version: "1.0", scope: "widget" },
	window: "PT10M",
	valid_for: "PT1H",
};

describe("plain words state each number with its direction", () => {
	it("words a threshold that maximises as at least, with the marginal limit below the pass limit", () => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 8, marginal_values: 5 },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(text).toContain("passes when it is at least 8 mm");
		expect(text).toContain(
			"is marginal when it is at least 5 mm but below 8 mm"
		);
		expect(text).toContain("fails when it is below 5 mm");
		expect(text).not.toContain("at most");
		expect(text).not.toContain("above");
	});

	it("words a threshold that minimises as at most, with the marginal limit above the pass limit", () => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "minimize",
					params: { pass_values: 0.5, marginal_values: 1.25 },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(text).toContain("passes when it is at most 0.5 mm");
		expect(text).toContain(
			"is marginal when it is above 0.5 mm but at most 1.25 mm"
		);
		expect(text).toContain("fails when it is above 1.25 mm");
		expect(text).not.toContain("at least");
		expect(text).not.toContain("below");
	});

	it("words a threshold without a marginal limit with no marginal clause, failing beyond the pass limit", () => {
		const maximize = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 8 },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(maximize).not.toContain("marginal");
		expect(maximize).toContain("fails when it is below 8 mm");
		const minimize = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "minimize",
					params: { pass_values: 8 },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(minimize).toContain("fails when it is above 8 mm");
	});

	it("words a band with both pairs of numbers and a list with both lists", () => {
		const band = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "band",
					params: { pass_values: [2, 4], marginal_values: [1, 5] },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(band).toContain("between 2 mm and 4 mm");
		expect(band).toContain(
			"between 1 mm and 5 mm but not between 2 mm and 4 mm"
		);
		expect(band).toContain("not between 1 mm and 5 mm");
		const list = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "membership",
					params: { pass_values: [1, 2], marginal_values: [3] },
				},
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(list).toContain("one of 1, 2");
		expect(list).toContain("one of 3");
		expect(list).toContain("in neither list");
	});

	it("words a yes-or-no rule as the answer being yes or no", () => {
		const text = textOf(
			{
				check: { name: BOOLEAN_CHECK.name, version: "3", scope: "widget" },
				rule: { kind: "identity" },
				window: "PT5M",
				valid_for: "PT5M",
			},
			BOOLEAN_CHECK,
			"rule"
		);
		expect(text).toContain("passes when the answer is yes");
		expect(text).toContain("fails when the answer is no");
	});

	it("states the share numbers as percentages without drift", () => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1 },
				},
				reduction: { kind: "mean", params: { avail_floor: 0.285 } },
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.07, avail_floor: 0.58, use_verdict: true },
				},
			},
			NUMBER_CHECK
		);
		expect(text).toContain("at least 7% of the widgets pass");
		expect(text).toContain("fewer than 58% of the widgets have an answer");
		expect(text).toContain("fewer than 28.5% of");
		expect(text).toContain("widget's readings have an answer");
		expect(text).not.toMatch(LONG_DIGITS);
	});

	it("names the combined value and the rule that judges it, at most staying at most", () => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1 },
				},
				reduction: {
					kind: "percentile",
					params: { p: 95 },
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 3, marginal_values: 6 },
					},
				},
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: true },
				},
			},
			NUMBER_CHECK,
			"reduction"
		);
		expect(text).toContain("the 95th percentile");
		expect(text).toContain("passes when it is at most 3 mm");
		expect(text).toContain("above 3 mm but at most 6 mm");
		expect(text).not.toContain("at least");
	});

	it.each([
		[1, "1st"],
		[2, "2nd"],
		[3, "3rd"],
		[4, "4th"],
		[11, "11th"],
		[12, "12th"],
		[13, "13th"],
		[21, "21st"],
		[22, "22nd"],
		[23, "23rd"],
		[50, "50th"],
		[101, "101st"],
		[111, "111th"],
		[112, "112th"],
	])("writes the percentile %s as %s", (p, word) => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1 },
				},
				reduction: { kind: "percentile", params: { p } },
			},
			NUMBER_CHECK,
			"reduction"
		);
		expect(text).toContain(`the ${word} percentile`);
	});

	it("writes each combining method in words and quotes how long a result counts, including no time limit", () => {
		const base = {
			...NUMBER_BASE,
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 1 },
			},
		} as const;
		for (const [kind, words] of [
			["mean", "the average"],
			["median", "the median"],
			["max", "the highest reading"],
			["min", "the lowest reading"],
			["last", "the latest reading"],
			["sum", "the sum"],
		] as const) {
			expect(
				textOf({ ...base, reduction: { kind } }, NUMBER_CHECK, "reduction")
			).toContain(words);
		}
		expect(
			textOf({ ...base, valid_for: "PT1H30M" }, NUMBER_CHECK, "validity")
		).toBe("A result counts for 1 hour 30 minutes.");
		expect(
			textOf({ ...base, valid_for: "indefinite" }, NUMBER_CHECK, "validity")
		).toBe("A result counts until someone withdraws it.");
	});
});

describe("plain words for a whole-system check", () => {
	const settings: PartialSettings = {
		check: { name: SYSTEM_CHECK.name, version: "1", scope: "environment" },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 40, marginal_values: 25 },
		},
		window: "PT10M",
		valid_for: "PT1H",
	};

	it("says the claim takes the latest reading in each window and has no combining sentences", () => {
		const sentences = plainWords(settings, SYSTEM_CHECK);
		const keys = sentences.map((sentence) => sentence.key);
		expect(keys).not.toContain("reduction");
		expect(keys).not.toContain("claim");
		expect(keys).not.toContain("answers-needed");
		expect(keys).not.toContain("readings-needed");
		expect(textOf(settings, SYSTEM_CHECK, "window")).toBe(
			"The claim takes the latest reading in each 10-minute window as its result."
		);
		expect(textOf(settings, SYSTEM_CHECK, "reading")).toContain(
			"the whole system"
		);
	});

	it("words the unit of readings and the limits", () => {
		const text = textOf(settings, SYSTEM_CHECK, "rule");
		expect(text).toContain("at least 40 widgets/min");
		expect(text).toContain("at least 25 widgets/min but below 40 widgets/min");
	});

	it("shows no combining lines in the short view's list", () => {
		const lines = remainingLines(settings, SYSTEM_CHECK);
		expect(
			lines.find((line) => line.label === "Combining readings")?.text
		).toBe("Not used");
		expect(lines.some((line) => line.label === "Answers needed")).toBe(false);
	});
});

describe("plain words for a draft that is not finished", () => {
	const blankChecks: [string, HealthCheck][] = [
		["boolean", BOOLEAN_CHECK],
		["number", NUMBER_CHECK],
		["text", TEXT_CHECK],
		["whole-system", SYSTEM_CHECK],
	];

	it.each(
		blankChecks
	)("has no NaN, undefined or empty gap for a blank %s draft", (_name, check) => {
		const draft = draftFromCheck(check, "integration-1");
		const { settings } = analyseDraft(draft, check);
		for (const sentence of plainWords(settings, check)) {
			expect(sentence.text).not.toMatch(BROKEN_WORDS);
		}
		for (const line of remainingLines(settings, check)) {
			expect(line.text).not.toMatch(BROKEN_WORDS);
			expect(line.label).not.toMatch(BROKEN_WORDS);
		}
	});

	it.each(
		blankChecks
	)("has no broken words for a %s draft with junk typed into every field", (_name, check) => {
		const draft = draftFromCheck(check, "integration-1");
		const junk = {
			...draft,
			rule: {
				...draft.rule,
				pass: "abc",
				marginal: "x",
				passLow: "1",
				passHigh: "",
				passList: "\n",
			},
			reductionOn: true,
			reduction: {
				...draft.reduction,
				kind: "percentile" as const,
				percentile: "?",
			},
			aggregation: {
				...draft.aggregation,
				threshold: "NaN",
				answersNeeded: "-",
			},
			window: { amount: "", unit: "days" as const },
			validFor: { amount: "x", unit: "hours" as const },
		};
		const { settings } = analyseDraft(junk, check);
		for (const sentence of plainWords(settings, check)) {
			expect(sentence.text).not.toMatch(BROKEN_WORDS);
		}
	});

	it("reads '(not set)' for a limit that has not been typed", () => {
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: { kind: "threshold", direction: "maximize" },
			},
			NUMBER_CHECK,
			"rule"
		);
		expect(text).toContain("(not set)");
	});

	it("shows an empty settings object as just the reading sentence and no number", () => {
		const sentences = plainWords({}, NUMBER_CHECK);
		expect(sentences[0]?.key).toBe("reading");
		for (const sentence of sentences) {
			expect(sentence.text).not.toMatch(BROKEN_WORDS);
		}
	});
});

describe("subject words", () => {
	it("come from the check's scope_label", () => {
		const check: HealthCheck = {
			...NUMBER_CHECK,
			scope: "batch",
			scope_label: { one: "tray", many: "trays" },
		};
		const { settings } = analyseDraft(
			draftFromCheck(
				{
					...check,
					recommended: {
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 1 },
						},
						reduction: { kind: "median", params: { avail_floor: 0.5 } },
						aggregation: {
							kind: "proportion",
							params: { threshold: 0.9, avail_floor: 0.5, use_verdict: true },
						},
						window: "PT5M",
						valid_for: "PT5M",
					},
				},
				"i"
			),
			check
		);
		const text = textOf(settings, check);
		expect(text).toContain("one tray");
		expect(text).toContain("of the trays pass");
		expect(text).toContain("tray's readings");
		expect(text).not.toContain("batch");
	});

	it("falls back to the scope word when the check has no scope_label, and still reads sensibly", () => {
		const check: HealthCheck = {
			...NUMBER_CHECK,
			scope: "batch",
			scope_label: undefined,
		};
		expect(subjectsOf(check)).toEqual({ one: "batch", many: "batch subjects" });
		const text = textOf(
			{
				...NUMBER_BASE,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1 },
				},
				reduction: { kind: "mean" },
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, avail_floor: 0.5, use_verdict: true },
				},
			},
			check
		);
		expect(text).toContain("batch");
		expect(text).not.toMatch(BROKEN_WORDS);
	});
});

describe("articles before a subject word", () => {
	const settings: PartialSettings = {
		...NUMBER_BASE,
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 1 },
		},
		reduction: { kind: "mean", params: { avail_floor: 0.5 } },
	};

	it.each([
		["item", "an item's readings"],
		["widget", "a widget's readings"],
		["umbrella", "an umbrella's readings"],
		["tray", "a tray's readings"],
	])("writes the right article before %s", (one, phrase) => {
		const check: HealthCheck = {
			...NUMBER_CHECK,
			scope_label: { one, many: `${one}s` },
		};
		expect(textOf(settings, check, "readings-needed")).toContain(phrase);
	});
});

describe("rule outcomes", () => {
	it("lists pass, marginal and fail in that order, marginal only when a marginal limit is given", () => {
		expect(
			ruleOutcomes(
				{
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 2, marginal_values: 1 },
				},
				{ share: false, unit: undefined }
			).map((outcome) => outcome.verdict)
		).toEqual(["pass", "marginal", "fail"]);
		expect(
			ruleOutcomes(
				{
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 2 },
				},
				{ share: false, unit: undefined }
			).map((outcome) => outcome.verdict)
		).toEqual(["pass", "fail"]);
	});

	it("writes limits as percentages when they are shares", () => {
		const outcomes = ruleOutcomes(
			{
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.95, marginal_values: 0.07 },
			},
			{ share: true, unit: undefined }
		);
		expect(outcomes[0]?.text).toBe("it is at least 95%");
		expect(outcomes[1]?.text).toBe("it is at least 7% but below 95%");
	});
});
