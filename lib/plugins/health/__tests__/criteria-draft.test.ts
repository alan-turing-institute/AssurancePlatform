import { describe, expect, it } from "vitest";
import {
	type HealthCheck,
	normaliseRecommendation,
} from "@/lib/schemas/health-checks";
import {
	checkListIssues,
	healthCriteriaSettingsSchema,
	type ServedSettings,
	servedSettings,
} from "@/lib/schemas/health-criteria";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import {
	aggregationIsHeld,
	analyseDraft,
	BLANK_AGGREGATION,
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	durationToDraft,
	friendlyMessage,
	ownRuleRequired,
	paramDraftOf,
	type RuleShape,
	recommendationIsUsable,
	reductionAvailable,
	reductionRuleIsShare,
	rescaleRule,
	shapeFitsCheck,
	type ValueType,
} from "../criteria-draft";

const CHECKS = buildHealthCheckList().checks as HealthCheck[];

function demo(name: string): HealthCheck {
	const found = CHECKS.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no demo check ${name}`);
	}
	return found;
}

function edited(
	check: HealthCheck,
	change: (draft: CriteriaDraft) => void
): CriteriaDraft {
	const draft = structuredClone(draftFromCheck(check, "integration-1"));
	change(draft);
	return draft;
}

describe("the draft built from each demo check's recommendation", () => {
	it.each(
		CHECKS.map((check) => [check.name, check] as const)
	)("%s is exactly what the server's schema accepts", (_name, check) => {
		const analysis = analyseDraft(draftFromCheck(check, "i"), check);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).not.toBeNull();
		expect(
			healthCriteriaSettingsSchema.safeParse(analysis.complete).success
		).toBe(true);
		expect(checkListIssues(analysis.complete ?? {}, check)).toEqual([]);
		expect(recommendationIsUsable(check, "i")).toBe(true);
	});

	it("sends shares as fractions and durations in ISO 8601", () => {
		const check = demo(ITEM_CHECK_NAME);
		const { complete } = analyseDraft(draftFromCheck(check, "i"), check);
		expect(complete?.aggregation?.params).toEqual({
			avail_floor: 0.8,
			use_verdict: true,
		});
		expect(complete?.aggregation?.rule).toEqual({
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.95 },
		});
		expect(complete?.reduction?.rule?.params).toEqual({
			pass_values: 0.8,
			marginal_values: 0.5,
		});
		expect(complete?.window).toBe("PT1M");
		expect(complete?.valid_for).toBe("PT5M");
	});

	it("leaves steps 2 and 3 out for a whole-system check, and keeps its window", () => {
		const check = demo(SYSTEM_CHECK_NAME);
		const { complete } = analyseDraft(draftFromCheck(check, "i"), check);
		expect(complete?.reduction).toBeUndefined();
		expect(complete?.aggregation).toBeUndefined();
		expect(complete?.window).toBe("PT10M");
	});
});

describe("percentages and durations", () => {
	it("shows a stored share as a percentage without float noise", () => {
		const check = demo(ITEM_CHECK_NAME);
		const draft = draftFromCheck(check, "i");
		expect(draft.aggregation.threshold).toBe("95");
		expect(draft.reduction.rule.pass).toBe("80");
		const changed = edited(check, (d) => {
			d.aggregation.threshold = "57";
		});
		expect(
			analyseDraft(changed, check).complete?.aggregation?.rule?.params
				?.pass_values
		).toBe(0.57);
	});

	it.each([
		["PT1H30M", "90", "minutes"],
		["PT2H", "2", "hours"],
		["P7D", "7", "days"],
		["P1W", "7", "days"],
		["PT45S", "45", "seconds"],
		["PT5M", "5", "minutes"],
	])("shows %s as %s %s", (iso, amount, unit) => {
		expect(durationToDraft(iso)).toEqual({ amount, unit });
	});

	it("sends each unit as its own designator", () => {
		const check = demo(NUMERIC_CHECK_NAME);
		for (const [unit, iso] of [
			["seconds", "PT30S"],
			["minutes", "PT30M"],
			["hours", "PT30H"],
			["days", "P30D"],
		] as const) {
			const draft = edited(check, (d) => {
				d.window = { amount: "30", unit };
			});
			expect(analyseDraft(draft, check).complete?.window).toBe(iso);
		}
	});

	it("sends 'indefinite' when the time limit is switched off", () => {
		const check = demo(NUMERIC_CHECK_NAME);
		const draft = edited(check, (d) => {
			d.indefinite = true;
		});
		expect(analyseDraft(draft, check).complete?.valid_for).toBe("indefinite");
	});

	it("reports an amount that is not a whole number beside its field", () => {
		const check = demo(NUMERIC_CHECK_NAME);
		const draft = edited(check, (d) => {
			d.window = { amount: "1.5", unit: "hours" };
		});
		const analysis = analyseDraft(draft, check);
		expect(analysis.errors.window).toBeDefined();
		expect(analysis.complete).toBeNull();
	});
});

describe("each rule shape", () => {
	const numeric = demo(NUMERIC_CHECK_NAME);

	it("at least and at most", () => {
		const atLeast = edited(numeric, (d) => {
			d.rule = { ...d.rule, shape: "at-least", pass: "3", marginal: "1" };
		});
		expect(analyseDraft(atLeast, numeric).complete?.rule).toEqual({
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 3, marginal_values: 1 },
		});
		const atMost = edited(numeric, (d) => {
			d.rule = { ...d.rule, shape: "at-most", pass: "1", marginal: "" };
		});
		expect(analyseDraft(atMost, numeric).complete?.rule).toEqual({
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 1 },
		});
	});

	it("between", () => {
		const draft = edited(numeric, (d) => {
			d.rule = {
				...d.rule,
				shape: "between",
				passLow: "1",
				passHigh: "2",
				marginalLow: "0",
				marginalHigh: "3",
			};
		});
		expect(analyseDraft(draft, numeric).complete?.rule).toEqual({
			kind: "band",
			params: { pass_values: [1, 2], marginal_values: [0, 3] },
		});
	});

	it("one of, with numbers for a numeric check and text for a text check", () => {
		const draft = edited(numeric, (d) => {
			d.rule = {
				...d.rule,
				shape: "one-of",
				passList: "1\n2\n",
				marginalList: "",
			};
		});
		expect(analyseDraft(draft, numeric).complete?.rule).toEqual({
			kind: "membership",
			params: { pass_values: [1, 2] },
		});
		const text: HealthCheck = {
			...numeric,
			value: { type: "string" },
			recommended: undefined,
		};
		const textDraft = draftFromCheck(text, "i");
		textDraft.rule = { ...textDraft.rule, passList: "red\ngreen" };
		textDraft.aggregation = { ...textDraft.aggregation, threshold: "90" };
		textDraft.window = { amount: "5", unit: "minutes" };
		textDraft.validFor = { amount: "1", unit: "hours" };
		expect(
			analyseDraft(textDraft, text).settings.rule?.params?.pass_values
		).toEqual(["red", "green"]);
		expect(analyseDraft(textDraft, text).settings.reduction).toBeUndefined();
	});

	it("yes or no", () => {
		const item = demo(ITEM_CHECK_NAME);
		expect(
			analyseDraft(draftFromCheck(item, "i"), item).complete?.rule
		).toEqual({
			kind: "identity",
		});
	});

	it("reports an unreadable number beside its field and leaves it out", () => {
		const draft = edited(numeric, (d) => {
			d.rule = { ...d.rule, pass: "abc" };
		});
		const analysis = analyseDraft(draft, numeric);
		expect(analysis.errors["rule.params.pass_values"]).toBe("must be a number");
		expect(analysis.complete).toBeNull();
	});

	it("uses the shared limit checks for the marginal side", () => {
		const draft = edited(numeric, (d) => {
			d.rule = { ...d.rule, shape: "at-most", pass: "1", marginal: "0.5" };
		});
		expect(
			analyseDraft(draft, numeric).errors["rule.params.marginal_values"]
		).toContain("failing side");
	});
});

describe("which shapes fit which check", () => {
	it("allows only yes or no for a yes-or-no check", () => {
		const item = demo(ITEM_CHECK_NAME);
		expect(shapeFitsCheck("identity", item)).toBe(true);
		expect(shapeFitsCheck("at-least", item)).toBe(false);
		expect(shapeFitsCheck("one-of", item)).toBe(false);
	});

	it("keeps yes or no away from a numeric check, and allows nothing for a date check", () => {
		const numeric = demo(NUMERIC_CHECK_NAME);
		expect(shapeFitsCheck("identity", numeric)).toBe(false);
		expect(shapeFitsCheck("between", numeric)).toBe(true);
		const date: HealthCheck = { ...numeric, value: { type: "datetime" } };
		expect(shapeFitsCheck("at-least", date)).toBe(false);
		expect(shapeFitsCheck("identity", date)).toBe(false);
	});

	it("needs a rule of its own for a yes-or-no average but not for the latest reading", () => {
		const item = demo(ITEM_CHECK_NAME);
		expect(ownRuleRequired("identity", "mean", item)).toBe(true);
		expect(ownRuleRequired("identity", "last", item)).toBe(false);
		expect(ownRuleRequired("at-least", "mean", item)).toBe(false);
	});
});

describe("the check's own settings, by type", () => {
	const base = demo(NUMERIC_CHECK_NAME);
	const withParams: HealthCheck = {
		...base,
		params: [
			{ key: "label", label: "Label", type: "string" },
			{ key: "gain", label: "Gain", type: "number", unit: "dB" },
			{ key: "strict", label: "Strict", type: "boolean" },
			{ key: "every", label: "Every", type: "duration" },
			{
				key: "mode",
				label: "Mode",
				type: "enum",
				options: ["fast", "slow"],
			},
		],
	};

	it("sends each type in its own shape and leaves unset ones out", () => {
		const draft = draftFromCheck(withParams, "i");
		draft.params.label = { ...draft.params.label, text: "north" } as never;
		draft.params.gain = { ...draft.params.gain, text: "2.5" } as never;
		draft.params.strict = { ...draft.params.strict, flag: true } as never;
		draft.params.every = {
			...draft.params.every,
			amount: "2",
			unit: "hours",
		} as never;
		draft.params.mode = { ...draft.params.mode, text: "slow" } as never;
		expect(analyseDraft(draft, withParams).settings.check?.params).toEqual({
			label: "north",
			gain: 2.5,
			strict: true,
			every: "PT2H",
			mode: "slow",
		});
		expect(
			analyseDraft(draftFromCheck(withParams, "i"), withParams).settings.check
				?.params
		).toBeUndefined();
	});

	it("round-trips stored values and starts from the check's defaults", () => {
		const check = demo(NUMERIC_CHECK_NAME);
		expect(draftFromCheck(check, "i").params.tolerance_profile?.text).toBe(
			"standard"
		);
		const stored = analyseDraft(draftFromCheck(check, "i"), check).complete;
		expect(stored).not.toBeNull();
		if (stored) {
			const again = draftFromStored(
				servedSettings(stored, { rule: 1, reduction: 0, aggregation: 1 }),
				check,
				"i"
			);
			expect(analyseDraft(again, check).complete).toEqual(stored);
		}
	});

	it("reports a number that is not a number beside its field", () => {
		const draft = draftFromCheck(withParams, "i");
		draft.params.gain = { ...draft.params.gain, text: "loud" } as never;
		expect(analyseDraft(draft, withParams).errors["check.params.gain"]).toBe(
			"must be a number"
		);
	});
});

describe("messages", () => {
	it("puts the shared checks' field names in the form's words", () => {
		expect(friendlyMessage("rule.params.pass_values", "must be a number")).toBe(
			"must be a number"
		);
		expect(
			friendlyMessage(
				"rule.params.marginal_values",
				"must lie on the failing side of pass_values (below it)"
			)
		).toBe("must lie on the failing side of the pass limit (below it)");
		expect(
			friendlyMessage(
				"aggregation.rule.params.pass_values",
				"must be a number from 0 to 1"
			)
		).toBe("must be a number from 0 to 100");
	});
});

describe("stored rules through the draft", () => {
	const numeric = demo(NUMERIC_CHECK_NAME);
	const item = demo(ITEM_CHECK_NAME);

	function storedWith(check: HealthCheck, patch: Record<string, unknown>) {
		const base = analyseDraft(draftFromCheck(check, "i"), check).complete;
		if (!base) {
			throw new Error("the demo recommendation is not complete");
		}
		return servedSettings({ ...base, ...patch } as typeof base, {
			rule: 1,
			reduction: 1,
			aggregation: 1,
		});
	}

	it("shows a stored between rule as its four ends and sends the same numbers back", () => {
		const rule = {
			kind: "band",
			params: { pass_values: [1, 2], marginal_values: [0, 3] },
		};
		const draft = draftFromStored(storedWith(numeric, { rule }), numeric, "i");
		expect(draft.rule).toMatchObject({
			shape: "between",
			passLow: "1",
			passHigh: "2",
			marginalLow: "0",
			marginalHigh: "3",
		});
		expect(analyseDraft(draft, numeric).complete?.rule).toEqual(rule);
	});

	it("shows a stored one-of rule as one value to a line and sends the same values back", () => {
		const rule = {
			kind: "membership",
			params: { pass_values: [1, 2, 3], marginal_values: [4] },
		};
		const draft = draftFromStored(storedWith(numeric, { rule }), numeric, "i");
		expect(draft.rule).toMatchObject({
			shape: "one-of",
			passList: "1\n2\n3",
			marginalList: "4",
		});
		expect(analyseDraft(draft, numeric).complete?.rule).toEqual(rule);
	});

	it("shows the limits of a between rule on an average of yes-or-no readings as percentages", () => {
		const reduction = {
			kind: "mean",
			params: { avail_floor: 0.8 },
			rule: {
				kind: "band",
				params: { pass_values: [0.5, 0.9], marginal_values: [0.25, 0.95] },
			},
		};
		const draft = draftFromStored(storedWith(item, { reduction }), item, "i");
		expect(draft.reduction.rule).toMatchObject({
			shape: "between",
			passLow: "50",
			passHigh: "90",
			marginalLow: "25",
			marginalHigh: "95",
		});
		expect(analyseDraft(draft, item).complete?.reduction?.rule).toEqual(
			reduction.rule
		);
	});

	it("moves every limit of a rule between shares and plain numbers, and leaves text alone", () => {
		const rule = {
			...draftFromCheck(numeric, "i").rule,
			shape: "between" as const,
			pass: "0.8",
			marginal: "0.5",
			passLow: "0.5",
			passHigh: "0.9",
			marginalLow: "abc",
			marginalHigh: "",
			passList: "1\n2",
		};
		const up = rescaleRule(rule, 100);
		expect(up).toMatchObject({
			pass: "80",
			marginal: "50",
			passLow: "50",
			passHigh: "90",
			marginalLow: "abc",
			marginalHigh: "",
			passList: "1\n2",
		});
		expect(rescaleRule(up, 0.01)).toMatchObject({
			pass: "0.8",
			passLow: "0.5",
			passHigh: "0.9",
		});
	});
});

describe("numbers as typed", () => {
	const item = demo(ITEM_CHECK_NAME);
	const numeric = demo(NUMERIC_CHECK_NAME);

	it("sends a stored share with many decimal places back exactly when nothing was touched", () => {
		const base = analyseDraft(draftFromCheck(item, "i"), item).complete;
		if (!base?.aggregation) {
			throw new Error("the demo recommendation is not complete");
		}
		const stored = servedSettings(
			{
				...base,
				aggregation: {
					...base.aggregation,
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 0.333_333_333_333_333 },
					},
				},
			},
			{ rule: 1, reduction: 1, aggregation: 1 }
		);
		const draft = draftFromStored(stored, item, "i");
		expect(draft.aggregation.threshold).toBe("33.3333333333333");
		expect(
			analyseDraft(draft, item).complete?.aggregation?.rule?.params?.pass_values
		).toBe(0.333_333_333_333_333);
	});

	it("sends the parameters of the combining rule that the form does not show back unchanged", () => {
		const base = analyseDraft(draftFromCheck(item, "i"), item).complete;
		if (!base?.aggregation) {
			throw new Error("the demo recommendation is not complete");
		}
		const rule = {
			kind: "threshold" as const,
			direction: "maximize" as const,
			params: { pass_values: 0.95, tolerance: 0.01 },
		};
		const stored = servedSettings(
			{ ...base, aggregation: { ...base.aggregation, rule } },
			{ rule: 1, reduction: 1, aggregation: 1 }
		);
		const draft = draftFromStored(stored, item, "i");
		expect(draft.aggregation.threshold).toBe("95");
		expect(analyseDraft(draft, item).complete?.aggregation?.rule).toEqual(rule);
	});

	it.each([
		["33.3", 0.333],
		["7", 0.07],
		["0.1", 0.001],
		["100", 1],
		["57", 0.57],
	])("turns the percentage %s into the fraction %s by moving the point", (typed, fraction) => {
		const draft = edited(item, (d) => {
			d.aggregation.threshold = typed;
		});
		expect(
			analyseDraft(draft, item).complete?.aggregation?.rule?.params?.pass_values
		).toBe(fraction);
	});

	it.each([
		"0x10",
		"1e3",
		"+5",
		"1,5",
		"5%",
		"Infinity",
		"1 000",
		"-",
		".",
	])("does not read %j as a number", (typed) => {
		const draft = edited(numeric, (d) => {
			d.rule = { ...d.rule, pass: typed };
		});
		expect(analyseDraft(draft, numeric).errors["rule.params.pass_values"]).toBe(
			"must be a number"
		);
	});

	it.each([
		"-5",
		"0",
		"5",
		"5.25",
		"-0.5",
		".5",
	])("reads %j as a number", (typed) => {
		const draft = edited(numeric, (d) => {
			d.rule = { ...d.rule, pass: typed };
		});
		expect(
			analyseDraft(draft, numeric).errors["rule.params.pass_values"]
		).toBeUndefined();
	});

	it("says a required percentage is required when it is empty, not that it is out of range", () => {
		const draft = edited(item, (d) => {
			d.aggregation.threshold = "";
		});
		const analysis = analyseDraft(draft, item);
		expect(analysis.errors["aggregation.rule.params.pass_values"]).toBe(
			"is required"
		);
		expect(analysis.complete).toBeNull();
	});

	it("reports a between rule with one end of its limits typed", () => {
		const draft = edited(numeric, (d) => {
			d.rule = {
				...d.rule,
				shape: "between",
				passLow: "1",
				passHigh: "2",
				marginalLow: "",
				marginalHigh: "3",
			};
		});
		expect(
			analyseDraft(draft, numeric).errors["rule.params.marginal_values"]
		).toBe("needs both ends");
	});
});

describe("the combining steps in the current form", () => {
	const item = demo(ITEM_CHECK_NAME);
	const withAggregation = (aggregation: unknown): HealthCheck =>
		({
			...item,
			recommended: { ...item.recommended, aggregation },
		}) as HealthCheck;

	it("writes a percentile reduction's percentile under percentile and the share as the aggregation's own rule", () => {
		const check = demo(NUMERIC_CHECK_NAME);
		const draft = edited(check, (d) => {
			d.reductionOn = true;
			d.reduction = { ...d.reduction, kind: "percentile", percentile: "95" };
		});
		const { complete } = analyseDraft(draft, check);
		expect(complete?.reduction?.params).toEqual({ percentile: 95 });
		expect(complete?.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.9 },
			},
		});
	});

	it("fills the form from an older recommendation once it is converted, and calls it usable", () => {
		const older = withAggregation({
			kind: "proportion",
			params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
		});
		const check = normaliseRecommendation(older);
		expect(draftFromCheck(check, "i").aggregation.threshold).toBe("90");
		expect(recommendationIsUsable(check, "i")).toBe(true);
	});

	it("does not call a recommendation usable when its combining step is not a share with a pass mark and nothing else", () => {
		const rule = (params: Record<string, unknown>) => ({
			kind: "threshold",
			direction: "maximize",
			params,
		});
		const unusable = [
			{
				kind: "worst-of",
				params: { use_verdict: true },
				rule: rule({ pass_values: 1 }),
			},
			{ kind: "proportion", params: { use_verdict: true } },
			{
				kind: "proportion",
				params: { use_verdict: true },
				rule: rule({ pass_values: 0.9, marginal_values: 0.8 }),
			},
		];
		for (const aggregation of unusable) {
			expect(
				recommendationIsUsable(withAggregation(aggregation), "i"),
				JSON.stringify(aggregation)
			).toBe(false);
		}
	});

	it("shows an error on the share's pass mark under the path the form places it by", () => {
		const draft = edited(item, (d) => {
			d.aggregation.threshold = "150";
		});
		const analysis = analyseDraft(draft, item);
		expect(analysis.errors["aggregation.rule.params.pass_values"]).toBe(
			"must be a number from 0 to 1"
		);
		expect(
			friendlyMessage(
				"aggregation.rule.params.pass_values",
				analysis.errors["aggregation.rule.params.pass_values"] ?? ""
			)
		).toBe("must be a number from 0 to 100");
	});
});

// ---------------------------------------------------------------------------
// Builders for the sections below
// ---------------------------------------------------------------------------

const NUMERIC = demo(NUMERIC_CHECK_NAME);
const ITEM = demo(ITEM_CHECK_NAME);
const SYSTEM = demo(SYSTEM_CHECK_NAME);

/** The check with another kind of reading and no recommendation of its own. */
function ofType(check: HealthCheck, type: ValueType): HealthCheck {
	return {
		...check,
		value: { type } as HealthCheck["value"],
		recommended: undefined,
	};
}

function errorsFor(
	check: HealthCheck,
	change: (draft: CriteriaDraft) => void
): Record<string, string> {
	return analyseDraft(edited(check, change), check).errors;
}

function settingsFor(
	check: HealthCheck,
	change: (draft: CriteriaDraft) => void
) {
	return analyseDraft(edited(check, change), check).settings;
}

/** Stored settings for the check, with some blocks replaced by hand. */
function servedWith(
	check: HealthCheck,
	patch: Record<string, unknown>
): ServedSettings {
	const base = analyseDraft(draftFromCheck(check, "i"), check).complete;
	if (!base) {
		throw new Error("the demo recommendation is not complete");
	}
	const served = servedSettings(base, {
		rule: 1,
		reduction: 1,
		aggregation: 1,
	});
	return { ...served, ...patch } as ServedSettings;
}

function draftWith(
	check: HealthCheck,
	patch: Record<string, unknown>
): CriteriaDraft {
	return draftFromStored(servedWith(check, patch), check, "i");
}

function storedRule(
	kind: string,
	params?: Record<string, unknown>,
	direction?: string
) {
	return {
		kind,
		...(direction && { direction }),
		...(params && { params }),
		version: "r1",
	};
}

function storedAggregation(
	params: Record<string, unknown>,
	ruleParams?: Record<string, unknown>
) {
	return {
		kind: "proportion",
		params,
		...(ruleParams && {
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: ruleParams,
				version: "a1",
			},
		}),
		version: "a1",
	};
}

const BLANK_RULE_DRAFT = {
	shape: "at-least",
	pass: "",
	marginal: "",
	passLow: "",
	passHigh: "",
	marginalLow: "",
	marginalHigh: "",
	passList: "",
	marginalList: "",
	extra: {},
};
const BLANK_DURATION_DRAFT = { amount: "", unit: "minutes" };

/** The message for a typed value that is not a number, as the form shows it. */
const NOT_A_NUMBER_MESSAGE = errorsFor(NUMERIC, (d) => {
	d.rule = { ...d.rule, pass: "abc" };
})["rule.params.pass_values"];

// ---------------------------------------------------------------------------
// What a check allows
// ---------------------------------------------------------------------------

describe("which checks can combine readings", () => {
	it.each([
		["a yes-or-no item check", ITEM, true],
		["a numeric item check", NUMERIC, true],
		["a numeric whole-system check", SYSTEM, false],
		["an item check that returns text", ofType(NUMERIC, "string"), false],
		["a whole-system check that returns text", ofType(SYSTEM, "string"), false],
	])("%s: %s", (_name, check, expected) => {
		expect(reductionAvailable(check)).toBe(expected);
	});

	it.each([
		["boolean", "mean", true],
		["boolean", "median", false],
		["boolean", "last", false],
		["number", "mean", false],
		["string", "mean", false],
		["datetime", "mean", false],
	] as const)("limits of a %s check's %s are shares: %s", (type, kind, share) => {
		expect(reductionRuleIsShare(type, kind)).toBe(share);
	});

	it("asks for a rule of its own for a one-of reading rule on a combined number, not otherwise", () => {
		expect(ownRuleRequired("one-of", "mean", NUMERIC)).toBe(true);
		expect(ownRuleRequired("one-of", "max", NUMERIC)).toBe(false);
		expect(ownRuleRequired("at-most", "mean", NUMERIC)).toBe(false);
	});

	it("does not ask for a rule of its own where another problem is what stops the shape", () => {
		expect(ownRuleRequired("identity", "last", NUMERIC)).toBe(false);
		expect(ownRuleRequired("identity", "mean", SYSTEM)).toBe(false);
		expect(ownRuleRequired("one-of", "mean", ofType(NUMERIC, "string"))).toBe(
			false
		);
	});

	it.each([
		["a yes-or-no check", ITEM, ["identity"]],
		["a numeric check", NUMERIC, ["at-least", "at-most", "between", "one-of"]],
		["a text check", ofType(NUMERIC, "string"), ["one-of"]],
		["a date check", ofType(NUMERIC, "datetime"), []],
	] as [
		string,
		HealthCheck,
		RuleShape[],
	][])("%s fits exactly these shapes", (_name, check, fitting) => {
		const shapes: RuleShape[] = [
			"at-least",
			"at-most",
			"between",
			"identity",
			"one-of",
		];
		expect(shapes.filter((shape) => shapeFitsCheck(shape, check))).toEqual(
			shapes.filter((shape) => fitting.includes(shape))
		);
	});
});

// ---------------------------------------------------------------------------
// Drafts that start empty
// ---------------------------------------------------------------------------

describe("a draft with nothing recommended", () => {
	it.each([
		["boolean", "identity"],
		["string", "one-of"],
		["number", "at-least"],
		["datetime", "at-least"],
	] as const)("starts a %s check on the %s shape with every field empty", (type, shape) => {
		expect(draftFromCheck(ofType(SYSTEM, type), "i")).toStrictEqual({
			integrationId: "i",
			params: {},
			rule: { ...BLANK_RULE_DRAFT, shape },
			reductionOn: false,
			reduction: {
				kind: "mean",
				percentile: "",
				readingsNeeded: "",
				ownRule: false,
				rule: BLANK_RULE_DRAFT,
				extra: {},
			},
			aggregation: BLANK_AGGREGATION,
			window: BLANK_DURATION_DRAFT,
			validFor: BLANK_DURATION_DRAFT,
			indefinite: false,
		});
	});

	it("has a blank step 3 that holds nothing", () => {
		expect(BLANK_AGGREGATION).toStrictEqual({
			answersNeeded: "",
			extra: {},
			ruleExtra: {},
			threshold: "",
		});
		expect(aggregationIsHeld(BLANK_AGGREGATION)).toBe(false);
	});

	it.each([
		[undefined],
		["nonsense"],
		["P1M"],
		["PT0S"],
		["PT"],
	])("reads %j as no duration, in minutes", (iso) => {
		expect(durationToDraft(iso)).toStrictEqual(BLANK_DURATION_DRAFT);
	});

	it("gives a setting the draft lacks an empty draft, and finds one the draft has", () => {
		const draft = draftFromCheck(NUMERIC, "i");
		expect(paramDraftOf(draft, "not-a-setting")).toStrictEqual({
			text: "",
			flag: undefined,
			amount: "",
			unit: "minutes",
		});
		expect(paramDraftOf(draft, "tolerance_profile").text).toBe("standard");
	});
});

describe("step 3 held or blank", () => {
	const held = (change: Partial<typeof BLANK_AGGREGATION>) => ({
		...BLANK_AGGREGATION,
		...change,
	});

	it.each([
		["a pass mark", held({ threshold: "90" })],
		["a share of answers needed", held({ answersNeeded: "50" })],
		["a parameter of its own", held({ extra: { other: 1 } })],
		["a parameter of its rule", held({ ruleExtra: { other: 1 } })],
	])("is held with %s", (_name, aggregation) => {
		expect(aggregationIsHeld(aggregation)).toBe(true);
	});

	it.each([
		["a pass mark", held({ threshold: "  " })],
		["a share of answers needed", held({ answersNeeded: " \t" })],
	])("is blank with only spaces for %s", (_name, aggregation) => {
		expect(aggregationIsHeld(aggregation)).toBe(false);
	});

	it("is sent for a whole-system check only when the draft holds something", () => {
		const blank = settingsFor(SYSTEM, () => undefined);
		expect(blank.aggregation).toBeUndefined();
		const spaces = settingsFor(SYSTEM, (d) => {
			d.aggregation.threshold = "  ";
			d.aggregation.answersNeeded = "  ";
		});
		expect(spaces.aggregation).toBeUndefined();
		const filled = settingsFor(SYSTEM, (d) => {
			d.aggregation.answersNeeded = "50";
		});
		expect(filled.aggregation?.params?.avail_floor).toBe(0.5);
	});
});

// ---------------------------------------------------------------------------
// Durations as typed
// ---------------------------------------------------------------------------

describe("amounts of time as typed", () => {
	it.each([
		["5", "PT5H"],
		[" 5 ", "PT5H"],
		["123456789", "PT123456789H"],
	])("sends the amount %j as %s", (amount, iso) => {
		const settings = settingsFor(NUMERIC, (d) => {
			d.window = { amount, unit: "hours" };
		});
		expect(settings.window).toBe(iso);
	});

	it.each([
		"a5",
		"5a",
		"1234567890",
		"-5",
		"1.5",
		"5 5",
	])("refuses the amount %j beside its field and leaves it out", (amount) => {
		const change = (d: CriteriaDraft) => {
			d.window = { amount, unit: "hours" };
		};
		expect(errorsFor(NUMERIC, change).window).toBeDefined();
		expect(settingsFor(NUMERIC, change).window).toBeUndefined();
	});

	it.each([
		["window", "window"],
		["validFor", "valid_for"],
	] as const)("says a blank %s is missing, in the same way for spaces, and differently from a wrong amount", (field, path) => {
		const errors = (amount: string) =>
			errorsFor(NUMERIC, (d) => {
				d[field] = { amount, unit: "hours" };
			})[path];
		expect(errors("")).toBeDefined();
		expect(errors("  ")).toBe(errors(""));
		expect(errors("abc")).toBeDefined();
		expect(errors("abc")).not.toBe(errors(""));
	});
});

// ---------------------------------------------------------------------------
// Numbers as typed and as stored
// ---------------------------------------------------------------------------

describe("numbers typed into limits", () => {
	it.each([
		[".55", 0.55],
		["-.5", -0.5],
		["5.", 5],
	])("reads %j as %s", (typed, value) => {
		const settings = settingsFor(NUMERIC, (d) => {
			d.rule = { ...d.rule, pass: typed };
		});
		expect(settings.rule?.params?.pass_values).toBe(value);
	});

	it.each([
		"-0",
		"-0.0",
		"-00",
	])("sends the percentage %j as a plain zero, not a negative zero", (typed) => {
		const settings = settingsFor(ITEM, (d) => {
			d.aggregation.threshold = typed;
		});
		expect(settings.aggregation?.rule?.params?.pass_values).toBe(0);
	});

	it("keeps the sign of a typed negative percentage", () => {
		const settings = settingsFor(ITEM, (d) => {
			d.aggregation.threshold = "-5";
		});
		expect(settings.aggregation?.rule?.params?.pass_values).toBe(-0.05);
	});

	it.each([
		[1.5e-7, "0.000015"],
		[1.5e-10, "0.000000015"],
		[-1.5e-10, "-0.000000015"],
		[1e21, `1${"0".repeat(23)}`],
		[1.5e22, `15${"0".repeat(23)}`],
	])("shows the stored share %s as the percentage %s", (stored, text) => {
		const draft = draftWith(ITEM, {
			aggregation: storedAggregation(
				{ use_verdict: true },
				{ pass_values: stored }
			),
		});
		expect(draft.aggregation.threshold).toBe(text);
	});

	it.each([
		[Number.NaN],
		[Number.POSITIVE_INFINITY],
		[Number.NEGATIVE_INFINITY],
	])("shows a stored %s as an empty field", (stored) => {
		const aggregation = draftWith(ITEM, {
			aggregation: storedAggregation(
				{ avail_floor: stored },
				{ pass_values: stored }
			),
		}).aggregation;
		expect(aggregation.threshold).toBe("");
		expect(aggregation.answersNeeded).toBe("");
		const reduction = draftWith(NUMERIC, {
			reduction: {
				kind: "percentile",
				params: { percentile: stored, avail_floor: stored },
				version: "d1",
			},
		}).reduction;
		expect(reduction.percentile).toBe("");
		expect(reduction.readingsNeeded).toBe("");
		const rule = draftWith(NUMERIC, {
			rule: storedRule(
				"threshold",
				{ pass_values: stored, marginal_values: stored },
				"maximize"
			),
		}).rule;
		expect(rule.pass).toBe("");
		expect(rule.marginal).toBe("");
	});
});

describe("limits that are left out of the settings", () => {
	const passAt = (path: string, change: (d: CriteriaDraft) => void) => ({
		message: errorsFor(NUMERIC, change)[path],
		params: settingsFor(NUMERIC, change).rule?.params,
	});

	it("leaves an unreadable pass limit out and reports it", () => {
		const settings = settingsFor(NUMERIC, (d) => {
			d.rule = { ...d.rule, shape: "at-least", pass: "abc", marginal: "" };
		});
		expect(settings.rule).toStrictEqual({
			kind: "threshold",
			direction: "maximize",
		});
	});

	it("reports an unreadable marginal limit beside the marginal field", () => {
		const result = passAt("rule.params.marginal_values", (d) => {
			d.rule = { ...d.rule, shape: "at-least", pass: "1", marginal: "abc" };
		});
		expect(result.message).toBe(NOT_A_NUMBER_MESSAGE);
		expect(result.params).toStrictEqual({ pass_values: 1 });
	});

	it.each([
		["low", "x", "1"],
		["high", "1", "x"],
		["low", "1", ""],
		["high", "", "1"],
		["spaces in low", "  ", "1"],
		["spaces in high", "1", "  "],
	])("leaves a between limit out when its %s end is %j and %j", (_name, low, high) => {
		const result = passAt("rule.params.pass_values", (d) => {
			d.rule = { ...d.rule, shape: "between", passLow: low, passHigh: high };
		});
		expect(result.message).toBeDefined();
		expect(result.params?.pass_values).toBeUndefined();
	});

	it.each([
		["x", "1"],
		["1", "x"],
	])("reports the between ends %j and %j as not a number beside the pass limit", (low, high) => {
		const result = passAt("rule.params.pass_values", (d) => {
			d.rule = { ...d.rule, shape: "between", passLow: low, passHigh: high };
		});
		expect(result.message).toBe(NOT_A_NUMBER_MESSAGE);
	});

	it("treats a between end of only spaces as an end that is missing", () => {
		const message = (low: string) =>
			errorsFor(NUMERIC, (d) => {
				d.rule = { ...d.rule, shape: "between", passLow: low, passHigh: "2" };
			})["rule.params.pass_values"];
		expect(message("  ")).toBe(message(""));
		expect(message("1")).toBeUndefined();
	});

	it("reads a between limit when both ends are typed", () => {
		const result = passAt("rule.params.pass_values", (d) => {
			d.rule = { ...d.rule, shape: "between", passLow: "1", passHigh: "2" };
		});
		expect(result.message).toBeUndefined();
		expect(result.params).toMatchObject({ pass_values: [1, 2] });
	});

	it.each([
		["pass", "rule.params.pass_values"],
		["marginal", "rule.params.marginal_values"],
	] as const)("reports a list value that is not a number beside the %s list and leaves the list out", (side, path) => {
		const result = passAt(path, (d) => {
			d.rule = {
				...d.rule,
				shape: "one-of",
				passList: side === "pass" ? "1\nabc" : "1",
				marginalList: side === "marginal" ? "2\nabc" : "",
			};
		});
		expect(result.message).toBeDefined();
		expect(
			result.params?.[side === "pass" ? "pass_values" : "marginal_values"]
		).toBeUndefined();
	});

	it("words a list value that is not a number the same way for both lists", () => {
		const message = (side: "passList" | "marginalList", path: string) =>
			errorsFor(NUMERIC, (d) => {
				d.rule = { ...d.rule, shape: "one-of", [side]: "abc" };
			})[path];
		expect(message("passList", "rule.params.pass_values")).toBe(
			message("marginalList", "rule.params.marginal_values")
		);
		expect(message("passList", "rule.params.pass_values")).not.toBe(
			NOT_A_NUMBER_MESSAGE
		);
	});

	it("leaves an empty list out of a one-of rule and sends no parameters when both are empty", () => {
		const rule = (passList: string) =>
			settingsFor(NUMERIC, (d) => {
				d.rule = { ...d.rule, shape: "one-of", passList, marginalList: "" };
			}).rule;
		expect(rule("1\n2")).toStrictEqual({
			kind: "membership",
			params: { pass_values: [1, 2] },
		});
		expect(rule("")).toStrictEqual({ kind: "membership" });
	});

	it("sends no parameters for a threshold or band with every limit blank", () => {
		const rule = (shape: RuleShape) =>
			settingsFor(NUMERIC, (d) => {
				d.rule = { ...BLANK_RULE_DRAFT, shape };
			}).rule;
		expect(rule("at-most")).toStrictEqual({
			kind: "threshold",
			direction: "minimize",
		});
		expect(rule("between")).toStrictEqual({ kind: "band" });
	});

	it("ignores limits typed for another shape when the rule is yes or no, and keeps its other parameters", () => {
		const settings = settingsFor(NUMERIC, (d) => {
			d.rule = {
				...d.rule,
				shape: "identity",
				pass: "1",
				passList: "1\n2",
				extra: { note: 3 },
			};
		});
		expect(settings.rule).toStrictEqual({
			kind: "identity",
			params: { note: 3 },
		});
	});
});

// ---------------------------------------------------------------------------
// Steps 2 and 3 as built
// ---------------------------------------------------------------------------

describe("the combining steps as built from the draft", () => {
	const withReduction =
		(change: (reduction: CriteriaDraft["reduction"]) => void) =>
		(d: CriteriaDraft) => {
			d.reductionOn = true;
			change(d.reduction);
		};
	const answers = (typed: string) => (d: CriteriaDraft) => {
		d.aggregation.answersNeeded = typed;
	};

	it("sends a reduction with nothing else as only its kind", () => {
		const settings = settingsFor(
			NUMERIC,
			withReduction((r) => {
				r.kind = "max";
			})
		);
		expect(settings.reduction).toStrictEqual({ kind: "max" });
	});

	it("sends the parameters of a reduction that the form does not show unchanged", () => {
		const settings = settingsFor(
			NUMERIC,
			withReduction((r) => {
				r.kind = "max";
				r.extra = { keep: "me" };
			})
		);
		expect(settings.reduction).toStrictEqual({
			kind: "max",
			params: { keep: "me" },
		});
	});

	it.each([
		["  ", undefined],
		[" 80 ", 0.8],
	])("sends the share of readings needed %j as %s", (typed, fraction) => {
		const change = withReduction((r) => {
			r.kind = "max";
			r.readingsNeeded = typed;
		});
		expect(settingsFor(NUMERIC, change).reduction?.params?.avail_floor).toBe(
			fraction
		);
		expect(
			errorsFor(NUMERIC, change)["reduction.params.avail_floor"]
		).toBeUndefined();
	});

	it("reports a share of readings that is not a number and leaves it out", () => {
		const change = withReduction((r) => {
			r.kind = "max";
			r.readingsNeeded = "abc";
		});
		expect(errorsFor(NUMERIC, change)["reduction.params.avail_floor"]).toBe(
			NOT_A_NUMBER_MESSAGE
		);
		expect(settingsFor(NUMERIC, change).reduction).toStrictEqual({
			kind: "max",
		});
	});

	it("reports a percentile that is not a number and leaves it out", () => {
		const change = withReduction((r) => {
			r.kind = "percentile";
			r.percentile = "abc";
		});
		expect(errorsFor(NUMERIC, change)["reduction.params.percentile"]).toBe(
			NOT_A_NUMBER_MESSAGE
		);
		expect(settingsFor(NUMERIC, change).reduction).toStrictEqual({
			kind: "percentile",
		});
	});

	it("builds a reduction's own one-of rule from numbers and reports a bad value beside it", () => {
		const own = (passList: string) =>
			withReduction((r) => {
				r.kind = "max";
				r.ownRule = true;
				r.rule = { ...r.rule, shape: "one-of", passList };
			});
		expect(
			settingsFor(NUMERIC, own("1\n2")).reduction?.rule?.params?.pass_values
		).toStrictEqual([1, 2]);
		const mainRuleMessage = errorsFor(NUMERIC, (d) => {
			d.rule = { ...d.rule, shape: "one-of", passList: "1\nabc" };
		})["rule.params.pass_values"];
		expect(mainRuleMessage).toBeDefined();
		expect(
			errorsFor(NUMERIC, own("1\nabc"))["reduction.rule.params.pass_values"]
		).toBe(mainRuleMessage);
	});

	it("reads spaces in the share of answers needed as nothing", () => {
		expect(
			errorsFor(ITEM, answers("  "))["aggregation.params.avail_floor"]
		).toBeUndefined();
		expect(settingsFor(ITEM, answers("  ")).aggregation?.params).toStrictEqual({
			use_verdict: true,
		});
	});

	it("sends the share of answers needed, and reports one that is not a number", () => {
		expect(
			settingsFor(ITEM, answers(" 50 ")).aggregation?.params?.avail_floor
		).toBe(0.5);
		expect(
			errorsFor(ITEM, answers("abc"))["aggregation.params.avail_floor"]
		).toBe(NOT_A_NUMBER_MESSAGE);
		expect(settingsFor(ITEM, answers("abc")).aggregation?.params).toStrictEqual(
			{ use_verdict: true }
		);
	});
});

describe("check settings of type duration", () => {
	const withDuration: HealthCheck = {
		...NUMERIC,
		params: [{ key: "every", label: "Every", type: "duration" }],
	};
	const typedAmount = (amount: string) => (d: CriteriaDraft) => {
		d.params.every = { text: "", flag: undefined, amount, unit: "hours" };
	};

	it("starts empty, in minutes, when the check gives no default", () => {
		expect(draftFromCheck(withDuration, "i").params.every).toStrictEqual({
			text: "",
			flag: undefined,
			amount: "",
			unit: "minutes",
		});
	});

	it("leaves out an amount of only spaces without a problem", () => {
		expect(errorsFor(withDuration, typedAmount("  "))).toStrictEqual({});
		expect(
			settingsFor(withDuration, typedAmount("  ")).check?.params
		).toBeUndefined();
	});

	it("sends a typed amount trimmed, and reports one that is not a whole number beside the setting", () => {
		expect(
			settingsFor(withDuration, typedAmount(" 2 ")).check?.params
		).toStrictEqual({ every: "PT2H" });
		expect(
			errorsFor(withDuration, typedAmount("1.5"))["check.params.every"]
		).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Stored settings through the draft
// ---------------------------------------------------------------------------

describe("stored settings of unusual shape through the draft", () => {
	it("shows a one-of rule with a missing marginal list as an empty list", () => {
		const draft = draftWith(NUMERIC, {
			rule: storedRule("membership", { pass_values: [1] }),
		});
		expect(draft.rule.passList).toBe("1");
		expect(draft.rule.marginalList).toBe("");
	});

	it.each([
		["three values", [1, 2, 3]],
		["one value", [1]],
		["not a list", 5],
	])("shows a between limit given as %s as empty ends", (_name, pass) => {
		const draft = draftWith(NUMERIC, {
			rule: storedRule("band", { pass_values: pass, marginal_values: [0, 3] }),
		});
		expect(draft.rule).toMatchObject({
			passLow: "",
			passHigh: "",
			marginalLow: "0",
			marginalHigh: "3",
		});
	});

	it("shows a yes-or-no rule's limits only as parameters it keeps, not as a list", () => {
		const draft = draftWith(NUMERIC, {
			rule: storedRule("identity", { pass_values: [1, 2], note: "x" }),
		});
		expect(draft.rule).toStrictEqual({
			...BLANK_RULE_DRAFT,
			shape: "identity",
			extra: { note: "x" },
		});
	});

	it("keeps the parameters of a reduction other than the ones the form shows", () => {
		const draft = draftWith(NUMERIC, {
			reduction: {
				kind: "percentile",
				params: { percentile: 90, avail_floor: 0.7, other: "x" },
				version: "d1",
			},
		});
		expect(draft.reduction).toMatchObject({
			kind: "percentile",
			percentile: "90",
			readingsNeeded: "70",
		});
		expect(draft.reduction.extra).toStrictEqual({ other: "x" });
	});

	it("shows a reduction of an unknown kind as an average and one without parameters as empty", () => {
		const unknown = draftWith(NUMERIC, {
			reduction: { kind: "worst", version: "d1" },
		});
		expect(unknown.reduction.kind).toBe("mean");
		const bare = draftWith(NUMERIC, {
			reduction: { kind: "max", version: "d1" },
		});
		expect(bare.reduction).toMatchObject({
			kind: "max",
			percentile: "",
			readingsNeeded: "",
			extra: {},
		});
	});

	it("keeps the parameters of a combining step other than the ones the form shows", () => {
		const draft = draftWith(ITEM, {
			aggregation: storedAggregation(
				{
					threshold: 0.9,
					avail_floor: 0.8,
					use_verdict: true,
					marginal_threshold: 0.5,
					percentile: 1,
					other: 2,
				},
				{ pass_values: 0.95, tolerance: 0.01 }
			),
		});
		expect(draft.aggregation).toStrictEqual({
			threshold: "95",
			answersNeeded: "80",
			extra: { other: 2 },
			ruleExtra: { tolerance: 0.01 },
		});
	});

	it("shows a combining step with no rule, or a rule with no parameters, as an empty pass mark", () => {
		const noRule = draftWith(ITEM, {
			aggregation: storedAggregation({ avail_floor: 0.8 }),
		});
		expect(noRule.aggregation.threshold).toBe("");
		const noParams = draftWith(ITEM, {
			aggregation: {
				...storedAggregation({ avail_floor: 0.8 }),
				rule: storedRule("threshold", undefined, "maximize"),
			},
		});
		expect(noParams.aggregation.threshold).toBe("");
		expect(noParams.aggregation.ruleExtra).toStrictEqual({});
	});
});

describe("yes-or-no and duration check settings through the draft", () => {
	const withParams: HealthCheck = {
		...NUMERIC,
		params: [
			{ key: "strict", label: "Strict", type: "boolean" },
			{ key: "every", label: "Every", type: "duration" },
		],
	};
	const base = servedWith(NUMERIC, {});
	const fromStored = (params: Record<string, unknown>) =>
		draftFromStored(
			{ ...base, check: { ...base.check, params } },
			withParams,
			"i"
		).params;

	it.each([
		[true, true],
		[false, false],
		["yes", undefined],
		[1, undefined],
	])("shows the stored flag %j as %s", (stored, flag) => {
		expect(fromStored({ strict: stored }).strict?.flag).toBe(flag);
	});

	it("shows a stored duration as an amount and a unit", () => {
		expect(fromStored({ every: "PT2H" }).every).toMatchObject({
			amount: "2",
			unit: "hours",
		});
	});

	it("gives a check that lists no settings an empty set of setting drafts", () => {
		expect(draftFromCheck(SYSTEM, "i").params).toStrictEqual({});
		expect(settingsFor(SYSTEM, () => undefined).check?.params).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const WORDS_THEN_REST = /^\S.*\sis too high$/;
const TRAILING_IS = / is$/;

describe("the form's words for the shared checks' field names", () => {
	const PATH = "rule.params.marginal_values";

	it.each([
		"marginal_threshold",
		"marginal_values",
		"pass_values",
		"avail_floor",
	])("replaces %s with words and keeps the rest of the message", (name) => {
		const text = friendlyMessage(PATH, `${name} is too high`);
		expect(text).not.toContain(name);
		expect(text).toMatch(WORDS_THEN_REST);
	});

	it("uses the same words for both marginal names and different words for the others", () => {
		const words = (name: string) =>
			friendlyMessage(PATH, `${name} is`).replace(TRAILING_IS, "");
		expect(words("marginal_threshold")).toBe(words("marginal_values"));
		const distinct = new Set(
			["marginal_values", "pass_values", "avail_floor"].map(words)
		);
		expect(distinct.size).toBe(3);
	});

	it("replaces every occurrence of a name", () => {
		const text = friendlyMessage(PATH, "avail_floor and avail_floor");
		expect(text).not.toContain("avail_floor");
	});

	it.each([
		["reduction.params.avail_floor", true],
		["aggregation.params.avail_floor", true],
		["aggregation.params.threshold", true],
		["aggregation.rule.params.pass_values", true],
		["rule.params.pass_values", false],
		["x.aggregation.rule.params.pass_values", false],
		["aggregation.rule.params.pass_values.extra", false],
		["reduction.threshold.extra", false],
		["avail_floor.extra", false],
	])("for the path %s, reads a range as percentages: %s", (path, percent) => {
		const text = friendlyMessage(path, "must be from 0 to 1");
		expect(text.endsWith("from 0 to 100")).toBe(percent);
		expect(text.endsWith("from 0 to 1")).toBe(!percent);
	});
});
