import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	checkListIssues,
	type HealthCriteriaSettings,
	healthCriteriaSettingsSchema,
} from "@/lib/schemas/health-criteria";
import { parseDurationSeconds } from "@/lib/schemas/health-rules";
import {
	BOOLEAN_CHECK,
	NUMBER_CHECK,
	SYSTEM_CHECK,
	served,
	TEXT_CHECK,
} from "@/src/__tests__/fixtures/health-criteria-probe-data";
import {
	analyseDraft,
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	durationToDraft,
	rescaleRule,
} from "../criteria-draft";

const INTEGRATION_ID = "integration-1";

function roundTrip(settings: HealthCriteriaSettings, check: HealthCheck) {
	const draft = draftFromStored(served(settings), check, INTEGRATION_ID);
	return analyseDraft(draft, check);
}

const BOOLEAN_FULL: HealthCriteriaSettings = {
	check: {
		name: BOOLEAN_CHECK.name,
		version: BOOLEAN_CHECK.version,
		scope: "widget",
		params: {
			line: "ALL",
			retries: 0,
			strict: false,
			settle: "PT90M",
			profile: "careful",
		},
	},
	rule: { kind: "identity" },
	reduction: {
		kind: "mean",
		params: { avail_floor: 0.285 },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.95, marginal_values: 0.57 },
		},
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.07, avail_floor: 0.58, use_verdict: true },
	},
	window: "PT5M",
	valid_for: "P2D",
};

const NUMBER_AT_MOST: HealthCriteriaSettings = {
	check: { name: NUMBER_CHECK.name, version: "1.0", scope: "widget" },
	rule: {
		kind: "threshold",
		direction: "minimize",
		params: { pass_values: 0.5, marginal_values: 1.25 },
	},
	reduction: {
		kind: "percentile",
		params: { p: 95, avail_floor: 0.145 },
		rule: {
			kind: "band",
			params: { pass_values: [0.1, 0.9], marginal_values: [0, 1.5] },
		},
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.285, use_verdict: true },
	},
	window: "PT10S",
	valid_for: "indefinite",
};

const NUMBER_BAND_NO_REDUCTION: HealthCriteriaSettings = {
	check: { name: NUMBER_CHECK.name, version: "1.0", scope: "widget" },
	rule: {
		kind: "band",
		params: { pass_values: [-2.5, 2.5] },
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.9, use_verdict: true },
	},
	window: "PT1H",
	valid_for: "P7D",
};

const NUMBER_MEMBERSHIP: HealthCriteriaSettings = {
	check: { name: NUMBER_CHECK.name, version: "1.0", scope: "widget" },
	rule: {
		kind: "membership",
		params: { pass_values: [1, 2, 3.5], marginal_values: [4] },
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 1, use_verdict: true },
	},
	window: "PT1M",
	valid_for: "PT30M",
};

const TEXT_MEMBERSHIP: HealthCriteriaSettings = {
	check: { name: TEXT_CHECK.name, version: "2", scope: "widget" },
	rule: {
		kind: "membership",
		params: { pass_values: ["A", "B"], marginal_values: ["C"] },
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.5, avail_floor: 0.1, use_verdict: true },
	},
	window: "PT15M",
	valid_for: "PT1H",
};

const SYSTEM_SETTINGS: HealthCriteriaSettings = {
	check: { name: SYSTEM_CHECK.name, version: "1", scope: "environment" },
	rule: {
		kind: "threshold",
		direction: "maximize",
		params: { pass_values: 40, marginal_values: 25 },
	},
	window: "PT10M",
	valid_for: "PT1H",
};

const ROUND_TRIPS: [string, HealthCriteriaSettings, HealthCheck][] = [
	[
		"boolean check, every check setting, combining step with its own rule",
		BOOLEAN_FULL,
		BOOLEAN_CHECK,
	],
	[
		"number check, at most with marginal limit, percentile, no time limit",
		NUMBER_AT_MOST,
		NUMBER_CHECK,
	],
	[
		"number check, band without marginal limit, no combining step",
		NUMBER_BAND_NO_REDUCTION,
		NUMBER_CHECK,
	],
	["number check, one of with numbers", NUMBER_MEMBERSHIP, NUMBER_CHECK],
	["text check, one of with marginal list", TEXT_MEMBERSHIP, TEXT_CHECK],
	["whole-system check", SYSTEM_SETTINGS, SYSTEM_CHECK],
];

describe("draft round trip from stored settings", () => {
	it.each(
		ROUND_TRIPS
	)("returns exactly what was stored: %s", (_name, settings, check) => {
		const analysis = roundTrip(settings, check);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).toEqual(settings);
	});

	it("keeps a threshold without a marginal limit free of one", () => {
		const analysis = roundTrip(SYSTEM_SETTINGS, SYSTEM_CHECK);
		const params = analysis.complete?.rule.params ?? {};
		expect(Object.keys(params)).toEqual(["pass_values", "marginal_values"]);
		const without: HealthCriteriaSettings = {
			...SYSTEM_SETTINGS,
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 40 },
			},
		};
		expect(roundTrip(without, SYSTEM_CHECK).complete?.rule.params).toEqual({
			pass_values: 40,
		});
	});

	it("keeps rule parameters the form has no field for", () => {
		const withExtra: HealthCriteriaSettings = {
			...SYSTEM_SETTINGS,
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 40, tolerance_note: "kept" },
			},
		};
		expect(roundTrip(withExtra, SYSTEM_CHECK).complete).toEqual(withExtra);
	});
});

describe("percentages", () => {
	const aggregationOf = (fraction: number): HealthCriteriaSettings => ({
		...NUMBER_BAND_NO_REDUCTION,
		aggregation: {
			kind: "proportion",
			params: { threshold: fraction, avail_floor: fraction, use_verdict: true },
		},
	});

	it("returns every stored fraction to the thousandth as the same number, with no float drift", () => {
		for (let k = 0; k <= 1000; k++) {
			const fraction = Number((k / 1000).toFixed(3));
			const settings = aggregationOf(fraction);
			const analysis = roundTrip(settings, NUMBER_CHECK);
			expect(analysis.errors).toEqual({});
			expect(analysis.complete?.aggregation?.params.threshold).toBe(fraction);
			expect(analysis.complete?.aggregation?.params.avail_floor).toBe(fraction);
		}
	});

	it("returns every stored fraction to the ten-thousandth as the same number", () => {
		for (let k = 0; k <= 10_000; k++) {
			const fraction = Number((k / 10_000).toFixed(4));
			const analysis = roundTrip(aggregationOf(fraction), NUMBER_CHECK);
			expect(analysis.complete?.aggregation?.params.threshold).toBe(fraction);
		}
	});

	it.each([
		[0.95, "95"],
		[0.285, "28.5"],
		[0.07, "7"],
		[0.58, "58"],
		[0.29, "29"],
	])("shows the fraction %s as the short text %s", (fraction, text) => {
		const draft = draftFromStored(
			served(aggregationOf(fraction)),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		expect(draft.aggregation.threshold).toBe(text);
		expect(draft.aggregation.answersNeeded).toBe(text);
	});

	it("shows and returns the limits of a rule judging an average of yes-or-no readings as percentages", () => {
		const draft = draftFromStored(
			served(BOOLEAN_FULL),
			BOOLEAN_CHECK,
			INTEGRATION_ID
		);
		expect(draft.reduction.rule.pass).toBe("95");
		expect(draft.reduction.rule.marginal).toBe("57");
		expect(draft.reduction.readingsNeeded).toBe("28.5");
	});

	it("does not show the limits of a number check's combined-value rule as percentages", () => {
		const draft = draftFromStored(
			served(NUMBER_AT_MOST),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		expect(draft.reduction.rule.passLow).toBe("0.1");
		expect(draft.reduction.rule.passHigh).toBe("0.9");
	});

	it("rescales rule limits to a percentage and back without drift", () => {
		for (let k = 0; k <= 1000; k++) {
			const fraction = Number((k / 1000).toFixed(3));
			const rule = {
				...draftFromStored(served(NUMBER_AT_MOST), NUMBER_CHECK, INTEGRATION_ID)
					.reduction.rule,
				pass: String(fraction),
			};
			const up = rescaleRule(rule, 100);
			expect(Number(up.pass)).toBe(Number((fraction * 100).toFixed(1)));
			expect(rescaleRule(up, 0.01).pass).toBe(String(fraction));
		}
	});

	it.each([
		["", false],
		["abc", false],
		["95%", false],
		["NaN", false],
		["Infinity", false],
		["-5", false],
		["101", false],
		["1e3", false],
		["0", true],
		["100", true],
		[" 95 ", true],
		["95.0", true],
	])("the claim threshold typed as %j is %s", (typed, accepted) => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{ ...draft, aggregation: { ...draft.aggregation, threshold: typed } },
			NUMBER_CHECK
		);
		expect(analysis.complete !== null).toBe(accepted);
		if (!accepted) {
			expect(analysis.errors["aggregation.params.threshold"]).toBeTruthy();
		}
	});

	it("sends a threshold typed with surrounding spaces as the trimmed fraction", () => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{
				...draft,
				aggregation: { ...draft.aggregation, threshold: "  62.5  " },
			},
			NUMBER_CHECK
		);
		expect(analysis.complete?.aggregation?.params.threshold).toBe(0.625);
	});
});

describe("durations", () => {
	it.each([
		["PT1S", "1", "seconds"],
		["PT59S", "59", "seconds"],
		["PT60S", "1", "minutes"],
		["PT5M", "5", "minutes"],
		["PT90M", "90", "minutes"],
		["PT1H30M", "90", "minutes"],
		["PT1H", "1", "hours"],
		["PT24H", "1", "days"],
		["P1DT1H", "25", "hours"],
		["P1W", "7", "days"],
		["P36500D", "36500", "days"],
	])("shows %s as %s %s", (iso, amount, unit) => {
		expect(durationToDraft(iso)).toEqual({ amount, unit });
	});

	it.each([
		["P100Y"],
		["P1M"],
		["PT"],
		["P"],
		["soon"],
		[""],
		["P36501D"],
		["PT0S"],
	])("shows %j, which is not an accepted duration, as blank", (iso) => {
		expect(durationToDraft(iso).amount).toBe("");
	});

	it("shows a missing duration as blank", () => {
		expect(durationToDraft(undefined).amount).toBe("");
	});

	it("keeps the length of a mixed stored duration when it comes back", () => {
		const settings: HealthCriteriaSettings = {
			...NUMBER_BAND_NO_REDUCTION,
			window: "PT1H30M",
			valid_for: "P1DT12H",
		};
		const analysis = roundTrip(settings, NUMBER_CHECK);
		expect(analysis.errors).toEqual({});
		expect(parseDurationSeconds(analysis.complete?.window ?? "")).toBe(5400);
		expect(parseDurationSeconds(analysis.complete?.valid_for ?? "")).toBe(
			129_600
		);
	});

	it("sends the day unit as P<n>D and the others as PT<n><unit>", () => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const send = (window: CriteriaDraft["window"]) =>
			analyseDraft({ ...draft, window }, NUMBER_CHECK).complete?.window;
		expect(send({ amount: "3", unit: "seconds" })).toBe("PT3S");
		expect(send({ amount: "3", unit: "minutes" })).toBe("PT3M");
		expect(send({ amount: "3", unit: "hours" })).toBe("PT3H");
		expect(send({ amount: "3", unit: "days" })).toBe("P3D");
	});

	it("accepts a window at the 100-year cap and refuses one day over it", () => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const at = analyseDraft(
			{ ...draft, window: { amount: "36500", unit: "days" } },
			NUMBER_CHECK
		);
		expect(at.errors).toEqual({});
		const over = analyseDraft(
			{ ...draft, window: { amount: "36501", unit: "days" } },
			NUMBER_CHECK
		);
		expect(over.complete).toBeNull();
		expect(over.errors.window).toBeTruthy();
	});

	it.each([
		["", true],
		["0", true],
		["-5", true],
		["5.5", true],
		["1e3", true],
		["abc", true],
		["1234567890", true],
		["999999999", true],
		[" 7 ", false],
		["007", false],
	])("a window amount typed as %j has a problem: %s", (amount, problem) => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{ ...draft, window: { amount, unit: "days" } },
			NUMBER_CHECK
		);
		expect(analysis.errors.window !== undefined).toBe(problem);
		expect(analysis.complete === null).toBe(problem);
	});

	it("sends indefinite and ignores the length typed beside it", () => {
		const draft = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{
				...draft,
				indefinite: true,
				validFor: { amount: "junk", unit: "days" },
			},
			NUMBER_CHECK
		);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete?.valid_for).toBe("indefinite");
	});

	it("asks for a length again once no time limit is switched off with nothing typed", () => {
		const draft = draftFromStored(
			served(NUMBER_AT_MOST),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		expect(draft.indefinite).toBe(true);
		const analysis = analyseDraft(
			{ ...draft, indefinite: false },
			NUMBER_CHECK
		);
		expect(analysis.errors.valid_for).toBeTruthy();
		expect(analysis.complete).toBeNull();
	});
});

describe("check settings of each type", () => {
	const draft = () =>
		draftFromStored(served(BOOLEAN_FULL), BOOLEAN_CHECK, INTEGRATION_ID);

	it("fills a draft from a check's defaults and leaves settings without one blank", () => {
		const fresh = draftFromCheck(BOOLEAN_CHECK, INTEGRATION_ID);
		expect(fresh.params.line?.text).toBe("ALL");
		expect(fresh.params.retries?.text).toBe("");
		expect(fresh.params.strict?.flag).toBeUndefined();
	});

	it("keeps a number setting of zero and a yes-or-no setting of false", () => {
		const analysis = analyseDraft(draft(), BOOLEAN_CHECK);
		expect(analysis.complete?.check.params?.retries).toBe(0);
		expect(analysis.complete?.check.params?.strict).toBe(false);
	});

	it.each([
		["retries", { text: "abc" }],
		["retries", { text: "Infinity" }],
		["settle", { amount: "0" }],
		["settle", { amount: "-1" }],
		["settle", { amount: "1.5" }],
		["profile", { text: "bogus" }],
	])("reports a problem beside %s typed as %j", (key, patch) => {
		const base = draft();
		const analysis = analyseDraft(
			{
				...base,
				params: { ...base.params, [key]: { ...base.params[key], ...patch } },
			} as CriteriaDraft,
			BOOLEAN_CHECK
		);
		expect(analysis.errors[`check.params.${key}`]).toBeTruthy();
		expect(analysis.complete).toBeNull();
	});

	it("leaves a setting out when its field is empty rather than sending an empty value", () => {
		const base = draft();
		const analysis = analyseDraft(
			{
				...base,
				params: {
					...base.params,
					retries: { ...base.params.retries, text: "" } as never,
					profile: { ...base.params.profile, text: "" } as never,
				},
			},
			BOOLEAN_CHECK
		);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete?.check.params).not.toHaveProperty("retries");
		expect(analysis.complete?.check.params).not.toHaveProperty("profile");
	});

	it("sends a number setting typed with surrounding spaces as the number", () => {
		const base = draft();
		const analysis = analyseDraft(
			{
				...base,
				params: {
					...base.params,
					retries: { ...base.params.retries, text: "  12 " } as never,
				},
			},
			BOOLEAN_CHECK
		);
		expect(analysis.complete?.check.params?.retries).toBe(12);
	});
});

describe("text typed into the rule's fields", () => {
	const numberDraft = (
		patch: Partial<CriteriaDraft["rule"]>
	): CriteriaDraft => {
		const base = draftFromStored(
			served(NUMBER_BAND_NO_REDUCTION),
			NUMBER_CHECK,
			INTEGRATION_ID
		);
		return { ...base, rule: { ...base.rule, ...patch } };
	};

	it.each([
		["abc"],
		[""],
		["NaN"],
		["Infinity"],
		["1,5"],
	])("reports a problem for a pass limit of %j", (typed) => {
		const analysis = analyseDraft(
			numberDraft({ shape: "at-least", pass: typed, marginal: "" }),
			NUMBER_CHECK
		);
		expect(analysis.complete).toBeNull();
		expect(analysis.errors["rule.params.pass_values"]).toBeTruthy();
	});

	it("accepts a negative limit and spaces around a limit on a number check", () => {
		const analysis = analyseDraft(
			numberDraft({ shape: "at-least", pass: " -3 ", marginal: "-4" }),
			NUMBER_CHECK
		);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete?.rule.params).toEqual({
			pass_values: -3,
			marginal_values: -4,
		});
	});

	it("reports a marginal limit on the passing side of the pass limit", () => {
		const atLeast = analyseDraft(
			numberDraft({ shape: "at-least", pass: "5", marginal: "6" }),
			NUMBER_CHECK
		);
		expect(atLeast.errors["rule.params.marginal_values"]).toBeTruthy();
		const atMost = analyseDraft(
			numberDraft({ shape: "at-most", pass: "5", marginal: "4" }),
			NUMBER_CHECK
		);
		expect(atMost.errors["rule.params.marginal_values"]).toBeTruthy();
	});

	it("reports a band whose low limit is above its high limit", () => {
		const analysis = analyseDraft(
			numberDraft({
				shape: "between",
				passLow: "9",
				passHigh: "1",
				marginalLow: "",
				marginalHigh: "",
			}),
			NUMBER_CHECK
		);
		expect(analysis.errors["rule.params.pass_values"]).toBeTruthy();
	});

	it("reports a band with only one end of its pass limits typed", () => {
		const analysis = analyseDraft(
			numberDraft({
				shape: "between",
				passLow: "1",
				passHigh: "",
				marginalLow: "",
				marginalHigh: "",
			}),
			NUMBER_CHECK
		);
		expect(analysis.complete).toBeNull();
		expect(analysis.errors["rule.params.pass_values"]).toBeTruthy();
	});

	it("reports a band with only one end of its marginal limits typed instead of dropping it", () => {
		const analysis = analyseDraft(
			numberDraft({
				shape: "between",
				passLow: "1",
				passHigh: "2",
				marginalLow: "0",
				marginalHigh: "",
			}),
			NUMBER_CHECK
		);
		expect(analysis.errors["rule.params.marginal_values"]).toBeTruthy();
	});

	it("reports a list value that is not a number on a number check, and keeps text values on a text check", () => {
		const numbers = analyseDraft(
			numberDraft({ shape: "one-of", passList: "1\nabc\n3", marginalList: "" }),
			NUMBER_CHECK
		);
		expect(numbers.errors["rule.params.pass_values"]).toBeTruthy();
		const textBase = draftFromStored(
			served(TEXT_MEMBERSHIP),
			TEXT_CHECK,
			INTEGRATION_ID
		);
		const text = analyseDraft(
			{
				...textBase,
				rule: {
					...textBase.rule,
					passList: "  A  \n\n B\n12\n",
					marginalList: "",
				},
			},
			TEXT_CHECK
		);
		expect(text.errors).toEqual({});
		expect(text.complete?.rule.params?.pass_values).toEqual(["A", "B", "12"]);
	});

	it("reports an empty list of passing values", () => {
		const base = draftFromStored(
			served(TEXT_MEMBERSHIP),
			TEXT_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{ ...base, rule: { ...base.rule, passList: "\n  \n", marginalList: "" } },
			TEXT_CHECK
		);
		expect(analysis.errors["rule.params.pass_values"]).toBeTruthy();
	});
});

describe("shape and combining rules", () => {
	it("needs a rule of its own for an average of yes-or-no readings and sends one", () => {
		const base = draftFromCheck(BOOLEAN_CHECK, INTEGRATION_ID);
		const analysis = analyseDraft(
			{
				...base,
				reductionOn: true,
				reduction: { ...base.reduction, kind: "mean", ownRule: false },
				aggregation: { ...base.aggregation, threshold: "90" },
				window: { amount: "5", unit: "minutes" },
				validFor: { amount: "5", unit: "minutes" },
			},
			BOOLEAN_CHECK
		);
		expect(analysis.complete).toBeNull();
		expect(analysis.errors["reduction.rule.params.pass_values"]).toBeTruthy();
		expect(analysis.settings.reduction?.rule?.kind).toBe("threshold");
	});

	it("does not send a combining step for a whole-system check or a text check, whatever the draft holds", () => {
		for (const [settings, check] of [
			[SYSTEM_SETTINGS, SYSTEM_CHECK],
			[TEXT_MEMBERSHIP, TEXT_CHECK],
		] as const) {
			const base = draftFromStored(served(settings), check, INTEGRATION_ID);
			const analysis = analyseDraft({ ...base, reductionOn: true }, check);
			expect(analysis.settings.reduction).toBeUndefined();
		}
		const system = draftFromStored(
			served(SYSTEM_SETTINGS),
			SYSTEM_CHECK,
			INTEGRATION_ID
		);
		const analysis = analyseDraft(
			{ ...system, aggregation: { ...system.aggregation, threshold: "90" } },
			SYSTEM_CHECK
		);
		expect(analysis.settings.aggregation).toBeUndefined();
		expect(analysis.errors).toEqual({});
	});

	it("reports a percentile outside 0 to 100", () => {
		for (const typed of ["-1", "101", "", "abc"]) {
			const base = draftFromStored(
				served(NUMBER_AT_MOST),
				NUMBER_CHECK,
				INTEGRATION_ID
			);
			const analysis = analyseDraft(
				{ ...base, reduction: { ...base.reduction, percentile: typed } },
				NUMBER_CHECK
			);
			expect(analysis.errors["reduction.params.p"]).toBeTruthy();
		}
	});
});

// ---------------------------------------------------------------------------
// A draft never yields settings the server refuses without reporting a problem
// ---------------------------------------------------------------------------

const MODULUS = 4_294_967_296;

/** A small seeded generator, so a failing draft can be found again. */
function seeded(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) % MODULUS;
		return state / MODULUS;
	};
}

function hasNonFiniteNumber(value: unknown): boolean {
	if (typeof value === "number") {
		return !Number.isFinite(value);
	}
	if (typeof value === "object" && value !== null) {
		return Object.values(value).some(hasNonFiniteNumber);
	}
	return false;
}

const TYPED = [
	"",
	" ",
	"abc",
	"-1",
	"0",
	"1",
	"1.5",
	"2",
	"50",
	"100",
	"101",
	"1e3",
	" 7 ",
	"NaN",
	"Infinity",
	"0.1",
	"-0",
	"1e-7",
	"99999999999999999999",
	"1\n2",
	"x\ny",
	"95%",
];

const TEXT_PATHS = [
	"rule.pass",
	"rule.marginal",
	"rule.passLow",
	"rule.passHigh",
	"rule.marginalLow",
	"rule.marginalHigh",
	"rule.passList",
	"rule.marginalList",
	"reduction.percentile",
	"reduction.readingsNeeded",
	"reduction.rule.pass",
	"reduction.rule.marginal",
	"reduction.rule.passLow",
	"reduction.rule.passHigh",
	"reduction.rule.marginalLow",
	"reduction.rule.marginalHigh",
	"aggregation.threshold",
	"aggregation.answersNeeded",
	"window.amount",
	"validFor.amount",
	"params.retries.text",
	"params.settle.amount",
	"params.profile.text",
];

const SHAPES = ["identity", "at-least", "at-most", "between", "one-of"];
const KINDS = ["mean", "median", "max", "min", "last", "sum", "percentile"];
const UNITS = ["seconds", "minutes", "hours", "days"];

type Loose = Record<string, unknown>;

function setPath(target: Loose, path: string, value: unknown) {
	const keys = path.split(".");
	let node: Loose = target;
	for (const key of keys.slice(0, -1)) {
		const next = node[key];
		if (typeof next !== "object" || next === null) {
			return;
		}
		node = next as Loose;
	}
	node[keys.at(-1) ?? ""] = value;
}

function mutate(base: CriteriaDraft, random: () => number): CriteriaDraft {
	const draft = structuredClone(base) as unknown as Loose;
	const pick = <T>(items: T[]): T =>
		items[Math.floor(random() * items.length)] as T;
	const changes = 1 + Math.floor(random() * 4);
	for (let i = 0; i < changes; i++) {
		const roll = random();
		if (roll < 0.6) {
			setPath(draft, pick(TEXT_PATHS), pick(TYPED));
		} else if (roll < 0.7) {
			setPath(draft, "rule.shape", pick(SHAPES));
		} else if (roll < 0.78) {
			setPath(draft, "reduction.rule.shape", pick(SHAPES));
		} else if (roll < 0.84) {
			setPath(draft, "reduction.kind", pick(KINDS));
		} else if (roll < 0.88) {
			setPath(draft, "reductionOn", random() < 0.5);
		} else if (roll < 0.92) {
			setPath(draft, "reduction.ownRule", random() < 0.5);
		} else if (roll < 0.96) {
			setPath(draft, "indefinite", random() < 0.5);
		} else {
			setPath(draft, "window.unit", pick(UNITS));
		}
	}
	return draft as unknown as CriteriaDraft;
}

function withRecommendation(
	check: HealthCheck,
	settings: HealthCriteriaSettings
): HealthCheck {
	return {
		...check,
		recommended: {
			rule: settings.rule,
			reduction: settings.reduction,
			aggregation: settings.aggregation,
			window: settings.window,
			valid_for: settings.valid_for,
		},
	};
}

const FUZZ_CASES: [string, HealthCheck][] = [
	["boolean", withRecommendation(BOOLEAN_CHECK, BOOLEAN_FULL)],
	["number", withRecommendation(NUMBER_CHECK, NUMBER_AT_MOST)],
	["text", withRecommendation(TEXT_CHECK, TEXT_MEMBERSHIP)],
	["whole-system", withRecommendation(SYSTEM_CHECK, SYSTEM_SETTINGS)],
];

describe("a draft is never sent when the server would refuse it", () => {
	it.each(
		FUZZ_CASES
	)("for a %s check, settings that come back complete pass the server's checks, and every other draft reports a problem", (_name, check) => {
		const random = seeded(20_261_002);
		const base = draftFromCheck(check, INTEGRATION_ID);
		const startOk = analyseDraft(base, check);
		expect(startOk.errors).toEqual({});
		for (let run = 0; run < 4000; run++) {
			const draft = mutate(base, random);
			const analysis = analyseDraft(draft, check);
			const context = JSON.stringify(draft);
			if (analysis.complete) {
				expect(
					healthCriteriaSettingsSchema.safeParse(analysis.complete).success,
					context
				).toBe(true);
				expect(checkListIssues(analysis.complete, check), context).toEqual([]);
				expect(Object.keys(analysis.errors), context).toEqual([]);
				// A number that is not finite turns into null on the wire.
				expect(hasNonFiniteNumber(analysis.complete), context).toBe(false);
			} else {
				expect(Object.keys(analysis.errors).length, context).toBeGreaterThan(0);
			}
		}
	});
});
