import { describe, expect, it } from "vitest";
import {
	buildHealthCheckList,
	buildPipelineFormCheckList,
	ITEM_CHECK_NAME,
	PIPELINE_FORM_CHECK_NAME,
} from "../../../src/__tests__/fixtures/health-checks";
import {
	healthCheckListSchema,
	MAX_PUBLISHED_CHECKS,
	normaliseRecommendation,
} from "../health-checks";

function fieldsOf(list: unknown): string[] {
	const parsed = healthCheckListSchema.safeParse(list);
	return parsed.success
		? []
		: parsed.error.issues.map((issue) => issue.path.join("."));
}

const minimalCheck = (name: string) => ({
	name,
	version: "1",
	scope: "item",
	value: { type: "boolean" },
});

describe("check list schema", () => {
	it("accepts the demo list", () => {
		expect(
			healthCheckListSchema.safeParse(buildHealthCheckList()).success
		).toBe(true);
	});

	it("accepts exactly 200 checks and refuses 201", () => {
		const list = (count: number) => ({
			pipeline: "p",
			checks: Array.from({ length: count }, (_, i) => minimalCheck(`c${i}`)),
		});
		expect(
			healthCheckListSchema.safeParse(list(MAX_PUBLISHED_CHECKS)).success
		).toBe(true);
		expect(
			healthCheckListSchema.safeParse(list(MAX_PUBLISHED_CHECKS + 1)).success
		).toBe(false);
	});

	it("refuses a duplicate check name and names it", () => {
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [minimalCheck("a"), minimalCheck("a")],
			})
		).toEqual(["checks.1.name"]);
	});

	it("refuses unknown keys at the top and on a check", () => {
		expect(fieldsOf({ ...buildHealthCheckList(), extra: 1 })).toEqual([""]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), colour: "red" }],
			})
		).toEqual(["checks.0"]);
	});

	it("refuses names and versions with edge whitespace", () => {
		expect(
			fieldsOf({ pipeline: "p", checks: [minimalCheck(" padded")] })
		).toEqual(["checks.0.name"]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), version: "1 " }],
			})
		).toEqual(["checks.0.version"]);
	});

	it("refuses an enum setting without options and a default of the wrong type", () => {
		const withParam = (param: Record<string, unknown>) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck("a"), params: [param] }],
		});
		expect(fieldsOf(withParam({ key: "k", label: "K", type: "enum" }))).toEqual(
			["checks.0.params.0.options"]
		);
		expect(
			fieldsOf(
				withParam({ key: "k", label: "K", type: "number", default: "x" })
			)
		).toEqual(["checks.0.params.0.default"]);
	});

	it("refuses options on a setting that is not an enum, and a default that does not fit each type", () => {
		const withParam = (param: Record<string, unknown>) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck("a"), params: [param] }],
		});
		const fields = (param: Record<string, unknown>) =>
			fieldsOf(withParam({ key: "k", label: "K", ...param }));
		expect(fields({ type: "string", options: ["x"] })).toEqual([
			"checks.0.params.0.options",
		]);
		for (const param of [
			{ type: "string", default: 5 },
			{ type: "boolean", default: "yes" },
			{ type: "duration", default: 5 },
			{ type: "duration", default: "" },
			{ type: "enum", options: ["x", "y"], default: "z" },
		]) {
			expect(fields(param), JSON.stringify(param)).toEqual([
				"checks.0.params.0.default",
			]);
		}
		for (const param of [
			{ type: "string", default: "s" },
			{ type: "number", default: 5 },
			{ type: "boolean", default: false },
			{ type: "duration", default: "PT5M" },
			{ type: "enum", options: ["x", "y"], default: "y" },
		]) {
			expect(fields(param), JSON.stringify(param)).toEqual([]);
		}
	});

	it("refuses a prototype key in a recommendation's parameters and in a rule's parameters", () => {
		const list = JSON.parse(
			'{"pipeline":"p","checks":[{"name":"a","version":"1","scope":"item","value":{"type":"boolean"},"recommended":{"rule":{"kind":"identity","params":{"__proto__":{"x":1}}}}}]}'
		);
		expect(fieldsOf(list)).toEqual([
			"checks.0.recommended.rule.params.__proto__",
		]);
	});

	it("refuses text a database cannot store", () => {
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), description: "bad\u0000" }],
			})
		).toEqual(["checks.0.description"]);
	});

	it("checks a recommendation for shape only", () => {
		const withRecommended = (recommended: unknown) => ({
			pipeline: "p",
			checks: [{ ...minimalCheck(ITEM_CHECK_NAME), recommended }],
		});
		// A recommendation that would fail as settings still has a valid shape.
		expect(
			fieldsOf(
				withRecommended({
					rule: { kind: "threshold", direction: "target" },
					window: "P1M",
				})
			)
		).toEqual([]);
		expect(fieldsOf(withRecommended({ colour: "red" }))).toEqual([
			"checks.0.recommended",
		]);
	});
});

describe("a check list in a pipeline's own form", () => {
	const parsed = healthCheckListSchema.parse(buildPipelineFormCheckList());
	const gauge = parsed.checks.find(
		(check) => check.name === PIPELINE_FORM_CHECK_NAME
	);

	it("turns plain settings into the list of settings, typing each from its value and labelling each from its name", () => {
		expect(gauge?.params).toEqual([
			{
				key: "reference_gap",
				label: "Reference gap",
				type: "string",
				default: "mean_gap",
			},
			{ key: "max_dt", label: "Max dt", type: "duration", default: "PT12S" },
			{ key: "strict", label: "Strict", type: "boolean", default: false },
			{ key: "tolerance", label: "Tolerance", type: "number", default: 0.5 },
		]);
	});

	it("replaces every underscore in a label and lower-cases the rest", () => {
		const list = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [{ ...minimalCheck("a"), params: { SIM_A_B_c: 1 } }],
		});
		expect(list.checks[0]?.params?.[0]?.label).toBe("Sim a b c");
	});

	it("types a text value that is not a duration TEA accepts as text", () => {
		const types = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				{
					...minimalCheck("a"),
					params: { a: "PT0S", b: "P101Y", c: "PT5M", d: "" },
				},
			],
		}).checks[0]?.params;
		expect(types?.map((param) => param.type)).toEqual([
			"string",
			"string",
			"duration",
			"string",
		]);
	});

	it("refuses a setting with no usable default, naming the setting", () => {
		for (const value of [null, [1], { x: 1 }, Number.POSITIVE_INFINITY]) {
			expect(
				fieldsOf({
					pipeline: "p",
					checks: [{ ...minimalCheck("a"), params: { max_dt: value } }],
				}),
				JSON.stringify(value)
			).toEqual(["checks.0.params.max_dt"]);
		}
	});

	it("refuses a setting whose label would be too long, an empty name, and anything that is neither a list nor an object", () => {
		// Capitalising the ligature "ﬃ" gives three letters, so a key at the
		// limit makes a label past it.
		const longKey = `ﬃ${"a".repeat(199)}`;
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), params: { [longKey]: 1 } }],
			})
		).toEqual([`checks.0.params.${longKey}`]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), params: { "": 1 } }],
			})
		).toEqual(["checks.0.params"]);
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), params: "x" }],
			})
		).toEqual(["checks.0.params"]);
	});

	it("keeps naming the field of a list entry that is wrong", () => {
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [
					{
						...minimalCheck("a"),
						params: [{ key: "k", label: "K", type: "enum" }],
					},
				],
			})
		).toEqual(["checks.0.params.0.options"]);
	});

	it("stores scalar as number", () => {
		expect(gauge?.value).toEqual({ type: "number" });
		expect(
			fieldsOf({
				pipeline: "p",
				checks: [{ ...minimalCheck("a"), value: { type: "other" } }],
			})
		).toEqual(["checks.0.value.type"]);
	});

	it("accepts and drops a version label in a recommended rule, reduction, reduction rule, aggregation and aggregation rule", () => {
		const check = parsed.checks.find((entry) => entry.name === ITEM_CHECK_NAME);
		expect(check?.recommended?.rule).toEqual({ kind: "identity" });
		expect(check?.recommended?.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.05, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.8 },
			},
		});
		const reduced = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				{
					...minimalCheck("a"),
					recommended: {
						reduction: {
							kind: "mean",
							version: "0.0",
							rule: { kind: "identity", version: "0.0" },
						},
					},
				},
			],
		});
		expect(reduced.checks[0]?.recommended?.reduction).toEqual({
			kind: "mean",
			rule: { kind: "identity" },
		});
	});
});

describe("normaliseRecommendation", () => {
	const share = {
		kind: "proportion",
		params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
	};
	const entry = (recommended: unknown) => ({
		...minimalCheck("a"),
		recommended,
	});

	it("turns an older share and an older percentile reduction into the current form", () => {
		const converted = normaliseRecommendation(
			entry({
				aggregation: share,
				reduction: { kind: "percentile", params: { p: 95 } },
			}) as never
		);
		expect(converted.recommended?.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.9 },
			},
		});
		expect(converted.recommended?.reduction?.params).toEqual({
			percentile: 95,
		});
	});

	it("returns an entry that needs no conversion, or has an unexpected shape, as it came", () => {
		for (const value of [
			entry(undefined),
			entry(null),
			entry({ rule: { kind: "identity" } }),
			entry({ aggregation: { kind: "proportion", params: null } }),
			null,
			"text",
			[],
		]) {
			expect(normaliseRecommendation(value), JSON.stringify(value)).toBe(value);
		}
	});
});
