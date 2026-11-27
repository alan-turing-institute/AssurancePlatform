import { describe, expect, it } from "vitest";
import { describeDifference } from "../echo-difference-words";

describe("describeDifference", () => {
	it.each([
		[
			{ field: "check.version", declared: "0.3", used: "0.2" },
			"The pipeline used version 0.2 of the check; the settings say 0.3.",
		],
		[
			{ field: "check.params", declared: {}, used: { a: 1 } },
			"The pipeline ran the check with different settings of its own.",
		],
		[
			{ field: "rule.version", declared: "r2", used: "r1" },
			"The pipeline used rule r1; the settings say r2.",
		],
		[
			{ field: "reduction.version", declared: "d2", used: "d1" },
			"The pipeline used combining step d1; the settings say d2.",
		],
		[
			{ field: "aggregation.version", declared: "a2", used: "a1" },
			"The pipeline used claim-level step a1; the settings say a2.",
		],
		[
			{ field: "reduction", declared: null, used: "d1" },
			"The pipeline used a combining step; the settings do not have one.",
		],
		[
			{ field: "aggregation", declared: "a1", used: null },
			"The pipeline did not use a claim-level step; the settings have one.",
		],
		[
			{ field: "window", declared: "PT1H30M", used: "PT5M" },
			"The pipeline used a window of 5 minutes; the settings say 1 hour 30 minutes.",
		],
		[
			{ field: "valid_for", declared: "PT5M", used: "indefinite" },
			"The pipeline let the result count for no time limit; the settings say 5 minutes.",
		],
	])("words %j in the present", (difference, sentence) => {
		expect(describeDifference(difference)).toBe(sentence);
	});

	it("words the settings side in the past on a stored record", () => {
		expect(
			describeDifference(
				{ field: "rule.version", declared: "r2", used: "r1" },
				true
			)
		).toBe("The pipeline used rule r1; the settings said r2.");
		expect(
			describeDifference(
				{ field: "reduction", declared: null, used: "d1" },
				true
			)
		).toBe(
			"The pipeline used a combining step; the settings did not have one."
		);
		expect(
			describeDifference(
				{ field: "aggregation", declared: "a1", used: null },
				true
			)
		).toBe(
			"The pipeline did not use a claim-level step; the settings had one."
		);
	});

	it.each([
		["check.version", [1, 2], { major: 3 }, '{"major":3}', "[1,2]"],
		["rule.version", 2, { v: 1 }, '{"v":1}', "2"],
		["window", { a: 1 }, 90, "90", '{"a":1}'],
		["valid_for", null, [5], "[5]", "null"],
	])("writes the %s values that are not text as they are stored", (field, declared, used, usedText, declaredText) => {
		const text = describeDifference({ field, declared, used });

		expect(text.indexOf(usedText)).toBeGreaterThanOrEqual(0);
		expect(text.indexOf(declaredText)).toBeGreaterThan(text.indexOf(usedText));
	});

	it("treats a missing used value as not used", () => {
		const difference = (used: unknown) =>
			describeDifference({ field: "reduction", declared: "d1", used });

		expect(difference(undefined)).toBe(difference(null));
		expect(difference(undefined)).not.toBe(difference("d1"));
	});

	it("does not word a rule field as presence or absence", () => {
		const difference = (declared: unknown, used: unknown) =>
			describeDifference({ field: "rule", declared, used });

		expect(difference(null, "identity")).toBe(
			difference("threshold", "identity")
		);
		expect(difference(null, "identity")).toContain("rule");
		expect(difference("threshold", null)).toBe(difference(null, "identity"));
		const unknownField = describeDifference({
			field: "unlisted",
			declared: null,
			used: "identity",
		});
		expect(difference(null, "identity")).toBe(
			unknownField.replace("unlisted", "rule")
		);
	});

	it("falls back to a plain sentence for a field it does not know", () => {
		expect(
			describeDifference({ field: "something", declared: 1, used: 2 })
		).toBe("The pipeline's result differed from the settings in something.");
	});
});
