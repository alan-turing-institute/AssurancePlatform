import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	checkListIssues,
	healthCriteriaSettingsSchema,
	servedSettings,
} from "@/lib/schemas/health-criteria";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import {
	analyseDraft,
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	durationToDraft,
	friendlyMessage,
	ownRuleRequired,
	recommendationIsUsable,
	rescaleRule,
	shapeFitsCheck,
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
		expect(complete?.aggregation?.params).toMatchObject({
			threshold: 0.95,
			avail_floor: 0.8,
			use_verdict: true,
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
			analyseDraft(changed, check).complete?.aggregation?.params.threshold
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
				"aggregation.params.threshold",
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
					params: {
						...base.aggregation.params,
						threshold: 0.333_333_333_333_333,
					},
				},
			},
			{ rule: 1, reduction: 1, aggregation: 1 }
		);
		const draft = draftFromStored(stored, item, "i");
		expect(draft.aggregation.threshold).toBe("33.3333333333333");
		expect(
			analyseDraft(draft, item).complete?.aggregation?.params.threshold
		).toBe(0.333_333_333_333_333);
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
			analyseDraft(draft, item).complete?.aggregation?.params.threshold
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
		expect(analysis.errors["aggregation.params.threshold"]).toBe("is required");
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
