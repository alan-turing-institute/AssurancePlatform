import { describe, expect, it } from "vitest";
import {
	describeDifference,
	describeDifferences,
	NO_ACCEPTED_SETTINGS,
	NO_SETTINGS_ON_ARRIVAL,
} from "../echo-difference-words";
import type { HealthEchoDifference } from "../health-types";

const diff = (
	field: string,
	declared: unknown,
	used: unknown
): HealthEchoDifference => ({ field, declared, used });

describe("sentences for each field the server can send", () => {
	it.each([
		[
			diff("check.version", "0.3", "0.2"),
			"The pipeline used version 0.2 of the check; the settings say 0.3.",
			"The pipeline used version 0.2 of the check; the settings said 0.3.",
		],
		[
			diff("check.params", { a: 1 }, { a: 2 }),
			"The pipeline ran the check with different settings of its own.",
			"The pipeline ran the check with different settings of its own.",
		],
		[
			diff("rule.version", "r3", "r2"),
			"The pipeline used rule r2; the settings say r3.",
			"The pipeline used rule r2; the settings said r3.",
		],
		[
			diff("reduction.version", "d2", "d1"),
			"The pipeline used combining step d1; the settings say d2.",
			"The pipeline used combining step d1; the settings said d2.",
		],
		[
			diff("aggregation.version", "a2", "a1"),
			"The pipeline used claim-level step a1; the settings say a2.",
			"The pipeline used claim-level step a1; the settings said a2.",
		],
		[
			diff("window", "PT5M", "PT90M"),
			"The pipeline used a window of 90 minutes; the settings say 5 minutes.",
			"The pipeline used a window of 90 minutes; the settings said 5 minutes.",
		],
		[
			diff("valid_for", "PT1H", "P1D"),
			"The pipeline let the result count for 1 day; the settings say 1 hour.",
			"The pipeline let the result count for 1 day; the settings said 1 hour.",
		],
	])("words %j in the present and past tense", (difference, present, past) => {
		expect(describeDifference(difference)).toBe(present);
		expect(describeDifference(difference, true)).toBe(past);
	});

	it("words a combining step used by the pipeline only, and by the settings only, in both tenses", () => {
		const usedOnly = diff("reduction", null, "d1");
		const declaredOnly = diff("reduction", "d1", null);
		expect(describeDifference(usedOnly)).toBe(
			"The pipeline used a combining step; the settings do not have one."
		);
		expect(describeDifference(usedOnly, true)).toBe(
			"The pipeline used a combining step; the settings did not have one."
		);
		expect(describeDifference(declaredOnly)).toBe(
			"The pipeline did not use a combining step; the settings have one."
		);
		expect(describeDifference(declaredOnly, true)).toBe(
			"The pipeline did not use a combining step; the settings had one."
		);
	});

	it("words a claim-level step on one side only, in both directions", () => {
		expect(describeDifference(diff("aggregation", null, "a3"))).toBe(
			"The pipeline used a claim-level step; the settings do not have one."
		);
		expect(describeDifference(diff("aggregation", "a3", null))).toBe(
			"The pipeline did not use a claim-level step; the settings have one."
		);
	});

	it("says no time limit for indefinite rather than the stored word, on either side", () => {
		const declaredIndefinite = describeDifference(
			diff("valid_for", "indefinite", "PT5M")
		);
		expect(declaredIndefinite).toContain("the settings say no time limit");
		expect(declaredIndefinite).not.toContain("indefinite");
		const usedIndefinite = describeDifference(
			diff("valid_for", "PT5M", "indefinite")
		);
		expect(usedIndefinite).toContain("no time limit");
		expect(usedIndefinite).not.toContain("indefinite");
	});

	it("keeps a duration it cannot read as the text it was given", () => {
		expect(describeDifference(diff("window", "PT5M", "soonish"))).toContain(
			"a window of soonish"
		);
	});
});

describe("fields it does not know", () => {
	it.each([
		["future.field"],
		["rule"],
		["reduction.params"],
		[""],
		["constructor"],
		["__proto__"],
	])("does not throw or print undefined for the field %j", (field) => {
		const sentence = describeDifference(diff(field, undefined, undefined));
		expect(sentence).not.toContain("undefined");
		expect(sentence.length).toBeGreaterThan(0);
		expect(describeDifference(diff(field, 1, 2), true)).not.toContain(
			"undefined"
		);
	});

	it("does not print undefined for a step present on neither side", () => {
		expect(
			describeDifference(diff("reduction", undefined, undefined))
		).not.toContain("undefined");
	});
});

describe("lists and fixed lines", () => {
	it("gives one sentence per difference, in order", () => {
		expect(
			describeDifferences([
				diff("window", "PT5M", "PT1M"),
				diff("rule.version", "r2", "r1"),
			])
		).toEqual([
			"The pipeline used a window of 1 minute; the settings say 5 minutes.",
			"The pipeline used rule r1; the settings say r2.",
		]);
		expect(describeDifferences([])).toEqual([]);
	});

	it("keeps the two fixed lines for results without accepted settings", () => {
		expect(NO_SETTINGS_ON_ARRIVAL).toBe(
			"No accepted settings when this result arrived."
		);
		expect(NO_ACCEPTED_SETTINGS).toBe(
			"This claim has no accepted settings. Results are shown, but nobody has accepted how they are judged."
		);
	});
});
