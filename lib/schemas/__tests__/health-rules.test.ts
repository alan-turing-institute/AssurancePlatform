import { describe, expect, it } from "vitest";
import {
	aggregationSchema,
	parseDurationSeconds,
	reductionSchema,
	ruleSchema,
	validForSchema,
} from "../health-rules";

describe("parseDurationSeconds", () => {
	it.each([
		["PT1M", 60],
		["PT5M", 300],
		["PT90S", 90],
		["P1D", 86_400],
		["P1W", 604_800],
		["P1DT12H", 129_600],
		["P2W3DT4H5M6S", 2 * 604_800 + 3 * 86_400 + 4 * 3600 + 5 * 60 + 6],
	])("reads %s", (text, seconds) => {
		expect(parseDurationSeconds(text)).toBe(seconds);
	});

	it.each([
		"P1M",
		"P1Y",
		"P1Y2M",
		"PT0S",
		"P0D",
		"P",
		"PT",
		"P1DT",
		"1M",
		"PT1.5M",
		"pt1m",
		"",
	])("refuses %j", (text) => {
		expect(parseDurationSeconds(text)).toBeNull();
	});
});

describe("validForSchema", () => {
	it("accepts indefinite and a duration, and refuses anything else", () => {
		expect(validForSchema.safeParse("indefinite").success).toBe(true);
		expect(validForSchema.safeParse("PT5M").success).toBe(true);
		expect(validForSchema.safeParse("forever").success).toBe(false);
		expect(validForSchema.safeParse("P1M").success).toBe(false);
	});
});

describe("ruleSchema", () => {
	it("accepts the shapes each kind needs", () => {
		const shapes = [
			{ kind: "identity", version: "r1" },
			{
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: 5, marginal_values: 8 },
				version: "r1",
			},
			{
				kind: "band",
				params: { pass_values: [1, 2], marginal_values: [0, 3] },
				version: "r1",
			},
			{ kind: "membership", params: { pass_values: ["a"] }, version: "r1" },
		];
		for (const shape of shapes) {
			expect(ruleSchema.safeParse(shape).success).toBe(true);
		}
	});

	it("accepts target as a direction, needing a numeric pass value, and refuses it as a kind", () => {
		const target = {
			kind: "threshold",
			direction: "target",
			params: { pass_values: 5 },
			version: "r1",
		};
		expect(ruleSchema.safeParse(target).success).toBe(true);
		expect(ruleSchema.safeParse({ ...target, params: {} }).success).toBe(false);
		expect(
			ruleSchema.safeParse({ kind: "target", version: "r1" }).success
		).toBe(false);
	});

	it("refuses a rule missing the keys its kind needs", () => {
		const shapes = [
			{ kind: "threshold", params: { pass_values: 1 }, version: "r1" },
			{ kind: "threshold", direction: "maximize", version: "r1" },
			{ kind: "band", params: { pass_values: [1] }, version: "r1" },
			{ kind: "membership", params: { pass_values: [] }, version: "r1" },
			{ kind: "unknown", version: "r1" },
			{ kind: "identity" },
		];
		for (const shape of shapes) {
			expect(ruleSchema.safeParse(shape).success).toBe(false);
		}
	});

	it("keeps unknown keys inside params", () => {
		const parsed = ruleSchema.parse({
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 1, note: "kept" },
			version: "r1",
		});
		expect(parsed.params?.note).toBe("kept");
	});
});

describe("reductionSchema and aggregationSchema", () => {
	it("limit kinds to their lists", () => {
		expect(
			reductionSchema.safeParse({ kind: "mean", version: "d1" }).success
		).toBe(true);
		expect(
			reductionSchema.safeParse({ kind: "mode", version: "d1" }).success
		).toBe(false);
		expect(
			aggregationSchema.safeParse({
				kind: "proportion",
				params: { threshold: 0.9 },
				version: "a1",
			}).success
		).toBe(true);
		expect(
			aggregationSchema.safeParse({
				kind: "average",
				params: {},
				version: "a1",
			}).success
		).toBe(false);
	});

	it("checks the parameters a kind needs", () => {
		const noThreshold = aggregationSchema.safeParse({
			kind: "proportion",
			params: {},
			version: "a1",
		});
		expect(noThreshold.success).toBe(false);
		const badPercentile = aggregationSchema.safeParse({
			kind: "percentile",
			params: { percentile: 150 },
			version: "a1",
		});
		expect(badPercentile.success).toBe(false);
	});
});
