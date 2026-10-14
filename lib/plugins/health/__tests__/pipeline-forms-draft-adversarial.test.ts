import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { servedSettings } from "@/lib/schemas/health-criteria";
import type { HealthEvidenceRecord } from "@/lib/schemas/health-evidence";
import {
	analyseDraft,
	draftFromCheck,
	draftFromStored,
	draftsEqual,
	friendlyMessage,
	recommendationIsUsable,
} from "../criteria-draft";
import { plainWords } from "../criteria-plain-words";
import { describeLevels } from "../health-format";

const INTEGRATION_ID = "integration-1";

const checkWith = (recommended: Record<string, unknown>): HealthCheck =>
	({
		name: "Panel Flatness Check",
		version: "2.1",
		scope: "panel",
		scope_label: { one: "panel", many: "panels" },
		value: { type: "number", unit: "mm" },
		params: [
			{ key: "max_gap", label: "Max gap", type: "duration", default: "PT12S" },
			{
				key: "sample_count",
				label: "Sample count",
				type: "number",
				default: 5,
			},
			{ key: "strict", label: "Strict", type: "boolean", default: false },
			{ key: "mode", label: "Mode", type: "string", default: "fast" },
		],
		recommended,
	}) as unknown as HealthCheck;

const share = (passValues: number) => ({
	kind: "proportion",
	params: { avail_floor: 0.8, use_verdict: true },
	rule: {
		kind: "threshold",
		direction: "maximize",
		params: { pass_values: passValues },
	},
});

const recommendation = (aggregation: unknown = share(0.95)) => ({
	rule: {
		kind: "threshold",
		direction: "minimize",
		params: { pass_values: 0.5 },
	},
	reduction: {
		kind: "percentile",
		params: { percentile: 90, avail_floor: 0.8 },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.8 },
		},
	},
	aggregation,
	window: "PT5M",
	valid_for: "PT30M",
});

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

describe("the settings draft for the pipeline's own forms", () => {
	const check = checkWith(recommendation());

	it("builds the share as a rule from the recommendation, keeping every plain setting's value and type", () => {
		const { complete, errors } = analyseDraft(
			draftFromCheck(check, INTEGRATION_ID),
			check
		);
		expect(errors).toEqual({});
		expect(complete?.check.params).toEqual({
			max_gap: "PT12S",
			sample_count: 5,
			strict: false,
			mode: "fast",
		});
		expect(complete?.aggregation).toEqual(share(0.95));
		expect(complete?.reduction?.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
	});

	it("reads a stored share's pass mark from its rule and writes the same settings back", () => {
		const first = analyseDraft(draftFromCheck(check, INTEGRATION_ID), check);
		const served = servedSettings(first.complete as never, {
			rule: 4,
			reduction: 2,
			aggregation: 3,
		});
		const again = analyseDraft(
			draftFromStored(served, check, INTEGRATION_ID),
			check
		);
		expect(again.complete).toEqual(first.complete);
		expect(
			draftsEqual(
				draftFromStored(served, check, INTEGRATION_ID),
				draftFromCheck(check, INTEGRATION_ID)
			)
		).toBe(true);
	});

	it("round-trips every whole percentage, writing the pass mark as the fraction it stands for", () => {
		for (let percent = 0; percent <= 100; percent += 1) {
			const draft = draftFromCheck(check, INTEGRATION_ID);
			draft.aggregation.threshold = String(percent);
			const { complete, errors } = analyseDraft(draft, check);
			expect(errors, `${percent}%`).toEqual({});
			const written = complete?.aggregation?.rule?.params?.pass_values;
			expect(written, `${percent}%`).toBe(Number(`${percent / 100}`));
			const served = servedSettings(complete as never, {
				rule: 1,
				reduction: 1,
				aggregation: 1,
			});
			expect(
				draftFromStored(served, check, INTEGRATION_ID).aggregation.threshold
			).toBe(String(percent));
		}
	});

	it.each([
		"12.5",
		"0.1",
		"99.9",
		"33.333",
	])("keeps the digits of a pass mark of %s%%", (text) => {
		const draft = draftFromCheck(check, INTEGRATION_ID);
		draft.aggregation.threshold = text;
		const { complete } = analyseDraft(draft, check);
		const written = complete?.aggregation?.rule?.params?.pass_values as number;
		const served = servedSettings(complete as never, {
			rule: 1,
			reduction: 1,
			aggregation: 1,
		});
		expect(
			draftFromStored(served, check, INTEGRATION_ID).aggregation.threshold
		).toBe(text);
		expect(written).toBeCloseTo(Number(text) / 100, 12);
	});

	it.each([
		["a blank text", "", "is required"],
		["only spaces", "   ", "is required"],
		["a word", "abc", "must be a number"],
		["a percent sign", "90%", "must be a number"],
		["an exponent", "9e1", "must be a number"],
		["a minus sign", "-5", "from 0 to 1"],
		["over 100", "101", "from 0 to 1"],
	])("reports a pass mark given as %s on the rule's own field", (_name, text, message) => {
		const draft = draftFromCheck(check, INTEGRATION_ID);
		draft.aggregation.threshold = text;
		const { errors, complete } = analyseDraft(draft, check);
		expect(Object.keys(errors)).toEqual([
			"aggregation.rule.params.pass_values",
		]);
		expect(errors["aggregation.rule.params.pass_values"]).toContain(message);
		expect(complete).toBeNull();
	});

	it("keeps an unrelated setting of the combining step that the form does not show", () => {
		const withExtra = checkWith(
			recommendation({
				...share(0.95),
				params: { avail_floor: 0.8, use_verdict: true, note: "kept" },
			})
		);
		const { complete } = analyseDraft(
			draftFromCheck(withExtra, INTEGRATION_ID),
			withExtra
		);
		expect(complete?.aggregation?.params).toEqual({
			avail_floor: 0.8,
			use_verdict: true,
			note: "kept",
		});
	});

	it("writes the percentile as percentile and reports a bad one on that field", () => {
		const draft = draftFromCheck(check, INTEGRATION_ID);
		draft.reduction.percentile = "75";
		expect(analyseDraft(draft, check).complete?.reduction?.params).toEqual({
			percentile: 75,
			avail_floor: 0.8,
		});
		for (const text of ["", "abc", "9e1"]) {
			draft.reduction.percentile = text;
			const { errors, complete } = analyseDraft(draft, check);
			expect(Object.keys(errors), text).toEqual([
				"reduction.params.percentile",
			]);
			expect(complete).toBeNull();
		}
		draft.reduction.percentile = "101";
		expect(Object.keys(analyseDraft(draft, check).errors)).toEqual([
			"reduction.params.percentile",
		]);
	});

	it("never writes p, nor a pass mark in params", () => {
		const { complete } = analyseDraft(
			draftFromCheck(check, INTEGRATION_ID),
			check
		);
		expect(complete?.reduction?.params).not.toHaveProperty("p");
		expect(complete?.aggregation?.params).not.toHaveProperty("threshold");
		expect(complete?.aggregation?.params).not.toHaveProperty(
			"marginal_threshold"
		);
	});
});

describe("whether a recommendation can be accepted as it stands", () => {
	it("is yes for a share with a rule", () => {
		expect(
			recommendationIsUsable(checkWith(recommendation()), INTEGRATION_ID)
		).toBe(true);
	});

	it.each([
		[
			"a combining step with no rule",
			{ kind: "proportion", params: { avail_floor: 0.8, use_verdict: true } },
		],
		[
			"a worst-of step",
			{
				kind: "worst-of",
				params: { use_verdict: false },
				rule: {
					kind: "threshold",
					direction: "minimize",
					params: { pass_values: 5 },
				},
			},
		],
		[
			"a share with a marginal mark on its rule",
			{
				...share(0.9),
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9, marginal_values: 0.8 },
				},
			},
		],
		[
			"a share judged on values",
			{ ...share(0.9), params: { use_verdict: false } },
		],
		["a share with a pass mark above 1", share(1.5)],
	])("is no for %s", (_name, aggregation) => {
		expect(
			recommendationIsUsable(
				checkWith(recommendation(aggregation)),
				INTEGRATION_ID
			)
		).toBe(false);
	});
});

describe("the form's wording of a refusal", () => {
	it("reads the pass mark's range as a percentage", () => {
		expect(
			friendlyMessage(
				"aggregation.rule.params.pass_values",
				"must be a number from 0 to 1"
			)
		).toBe("must be a number from 0 to 100");
	});

	it("leaves the range of a reading rule's pass mark and of the percentile alone", () => {
		expect(
			friendlyMessage("rule.params.pass_values", "must be a number from 0 to 1")
		).toBe("must be a number from 0 to 1");
		expect(
			friendlyMessage(
				"reduction.params.percentile",
				"must be a number from 0 to 100 for a percentile"
			)
		).toBe("must be a number from 0 to 100 for a percentile");
	});
});

// ---------------------------------------------------------------------------
// The evidence log's description of a record
// ---------------------------------------------------------------------------

const record = (parts: Record<string, unknown>): HealthEvidenceRecord =>
	({
		check: { name: "Panel Flatness Check", version: "2.1", scope: "panel" },
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 0.5 },
			version: "r1",
		},
		...parts,
	}) as unknown as HealthEvidenceRecord;

const levelText = (parts: Record<string, unknown>, label: string) =>
	describeLevels(record(parts)).find((level) => level.label.startsWith(label))
		?.text;

describe("the evidence log's description of the combining step", () => {
	it("reads a share from its own rule", () => {
		expect(
			levelText(
				{
					aggregation: {
						kind: "proportion",
						params: { use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.95 },
							version: "a3",
						},
						version: "a3",
					},
				},
				"Across all"
			)
		).toBe("share passing at least 0.95 · a3");
	});

	it("includes the marginal mark that the rule carries", () => {
		expect(
			levelText(
				{
					aggregation: {
						kind: "proportion",
						params: { use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.95, marginal_values: 0.9 },
							version: "a3",
						},
						version: "a3",
					},
				},
				"Across all"
			)
		).toBe("share passing at least 0.95 (marginal from 0.9) · a3");
	});

	it("still describes an older record whose pass mark is in params", () => {
		expect(
			levelText(
				{
					aggregation: {
						kind: "proportion",
						params: {
							threshold: 0.95,
							marginal_threshold: 0.9,
							use_verdict: true,
						},
						version: "a1",
					},
				},
				"Across all"
			)
		).toBe("share passing at least 0.95 (marginal from 0.9) · a1");
		expect(
			levelText(
				{
					aggregation: {
						kind: "proportion",
						params: { threshold: 0, use_verdict: true },
						version: "a1",
					},
				},
				"Across all"
			)
		).toBe("share passing at least 0 · a1");
	});

	it("prefers the rule when a record carries both a rule and a pass mark in params", () => {
		expect(
			levelText(
				{
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.5, use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.95 },
							version: "a1",
						},
						version: "a1",
					},
				},
				"Across all"
			)
		).toBe("share passing at least 0.95 · a1");
	});
});

describe("the evidence log's description of a reduction's percentile", () => {
	const reduction = (params: Record<string, unknown> | undefined) => ({
		reduction: {
			kind: "percentile",
			...(params && { params }),
			version: "d1",
		},
	});
	const text = (params: Record<string, unknown> | undefined) =>
		levelText(reduction(params), "Each panel");

	it.each([
		[
			"percentile",
			{ percentile: 90 },
			"percentile 90, judged by the reading rule · d1",
		],
		["p", { p: 75 }, "percentile 75, judged by the reading rule · d1"],
		[
			"percentile of 0",
			{ percentile: 0 },
			"percentile 0, judged by the reading rule · d1",
		],
		["p of 0", { p: 0 }, "percentile 0, judged by the reading rule · d1"],
		[
			"both, preferring percentile",
			{ percentile: 90, p: 10 },
			"percentile 90, judged by the reading rule · d1",
		],
		[
			"a null percentile and a p",
			{ percentile: null, p: 50 },
			"percentile 50, judged by the reading rule · d1",
		],
		["neither", {}, "percentile, judged by the reading rule · d1"],
	])("reads the percentile from %s", (_name, params, expected) => {
		expect(text(params)).toBe(expected);
	});

	it("does not fail on a percentile reduction with no params", () => {
		expect(text(undefined)).toBe("percentile, judged by the reading rule · d1");
	});
});

// ---------------------------------------------------------------------------
// The plain-words summary
// ---------------------------------------------------------------------------

describe("the plain-words summary of the combining step", () => {
	const claimSentence = (aggregation: unknown) => {
		const check = checkWith(recommendation(aggregation));
		const { settings } = analyseDraft(
			draftFromCheck(check, INTEGRATION_ID),
			check
		);
		return plainWords(settings, check).find(
			(sentence) => sentence.key === "claim"
		)?.text;
	};

	it("states the share from the aggregation's own rule", () => {
		expect(claimSentence(share(0.95))).toBe(
			"The claim passes when at least 95% of the panels pass, and fails otherwise."
		);
	});

	it.each([
		[0, "0%"],
		[1, "100%"],
		[0.125, "12.5%"],
	])("states a pass mark of %s as %s", (passValues, written) => {
		expect(claimSentence(share(passValues))).toContain(
			`at least ${written} of the panels`
		);
	});
});
