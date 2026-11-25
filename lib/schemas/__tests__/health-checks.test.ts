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

function issuesOf(list: unknown) {
	const parsed = healthCheckListSchema.safeParse(list);
	return parsed.success ? [] : parsed.error.issues;
}

function messageAt(list: unknown, path: string): string | undefined {
	return issuesOf(list).find((issue) => issue.path.join(".") === path)?.message;
}

const listWith = (check: Record<string, unknown>) => ({
	pipeline: "p",
	checks: [{ ...minimalCheck("a"), ...check }],
});

const settingWith = (param: Record<string, unknown>) =>
	listWith({ params: [{ key: "k", label: "K", type: "string", ...param }] });

const entryFieldCases: [string, unknown, string, string][] = [
	[
		"an empty pipeline",
		{ pipeline: "", checks: [] },
		"pipeline",
		"pipeline is required",
	],
	[
		"an empty check name",
		listWith({ name: "" }),
		"checks.0.name",
		"name is required",
	],
	[
		"an empty check version",
		listWith({ version: "" }),
		"checks.0.version",
		"version is required",
	],
	[
		"an empty check scope",
		listWith({ scope: "" }),
		"checks.0.scope",
		"scope is required",
	],
	[
		"a scope with edge whitespace",
		listWith({ scope: " item" }),
		"checks.0.scope",
		"scope must not start or end with whitespace",
	],
	[
		"a description over 2000 characters",
		listWith({ description: "a".repeat(2001) }),
		"checks.0.description",
		"must be at most 2000 characters",
	],
	[
		"an empty singular scope label",
		listWith({ scope_label: { one: "", many: "x" } }),
		"checks.0.scope_label.one",
		"one is required",
	],
	[
		"an empty plural scope label",
		listWith({ scope_label: { one: "x", many: "" } }),
		"checks.0.scope_label.many",
		"many is required",
	],
	[
		"a value type that is not offered",
		listWith({ value: { type: "other" } }),
		"checks.0.value.type",
		"type must be one of boolean, number, string, datetime",
	],
];

describe("check list schema — messages for a check", () => {
	it.each(entryFieldCases)("reports %s", (_label, list, path, message) => {
		expect(messageAt(list, path)).toBe(message);
	});

	it("reports more than 200 checks", () => {
		const list = {
			pipeline: "p",
			checks: Array.from({ length: 201 }, (_, i) => minimalCheck(`c${i}`)),
		};
		expect(messageAt(list, "checks")).toBe("must have at most 200 checks");
	});

	it("reports a repeated check name and a repeated setting key", () => {
		const repeated = issuesOf({
			pipeline: "p",
			checks: [minimalCheck("a"), minimalCheck("a")],
		});
		expect(repeated.map((issue) => issue.message)).toEqual([
			"is listed more than once",
		]);
		const setting = { key: "k", label: "K", type: "string" };
		const keys = issuesOf(listWith({ params: [setting, setting] }));
		expect(keys.map((issue) => issue.path.join("."))).toEqual([
			"checks.0.params.1.key",
		]);
		expect(keys[0]?.message).toBe("is listed more than once");
	});

	it("accepts a description of 2000 characters", () => {
		expect(issuesOf(listWith({ description: "a".repeat(2000) }))).toEqual([]);
	});
});

const settingCases: [string, Record<string, unknown>, string, string][] = [
	["an empty label", { label: "" }, "label", "label is required"],
	[
		"a label over 200 characters",
		{ label: "a".repeat(201) },
		"label",
		"label must be at most 200 characters",
	],
	["an empty key", { key: "" }, "key", "key is required"],
	[
		"a key with edge whitespace",
		{ key: "k " },
		"key",
		"key must not start or end with whitespace",
	],
	[
		"the prototype key",
		{ key: "__proto__" },
		"key",
		"__proto__ is not an allowed name",
	],
	[
		"a type that is not offered",
		{ type: "colour" },
		"type",
		"must be one of string, number, boolean, duration, enum",
	],
	[
		"an enum with no options",
		{ type: "enum" },
		"options",
		"is required for an enum setting",
	],
	[
		"options on a setting that is not an enum",
		{ options: ["x"] },
		"options",
		"is only used by an enum setting",
	],
	[
		"a default of the wrong type",
		{ type: "number", default: "x" },
		"default",
		"must be a value of type number",
	],
];

describe("check list schema — messages for a setting", () => {
	it.each(settingCases)("reports %s", (_label, param, field, message) => {
		expect(messageAt(settingWith(param), `checks.0.params.0.${field}`)).toBe(
			message
		);
	});

	it("accepts a label of 200 characters", () => {
		expect(issuesOf(settingWith({ label: "a".repeat(200) }))).toEqual([]);
	});

	it("accepts a unit of 100 characters and refuses 101", () => {
		expect(
			issuesOf(settingWith({ type: "number", unit: "a".repeat(100) }))
		).toEqual([]);
		expect(
			fieldsOf(settingWith({ type: "number", unit: "a".repeat(101) }))
		).toEqual(["checks.0.params.0.unit"]);
		expect(issuesOf(settingWith({ type: "number", unit: "ms" }))).toEqual([]);
	});

	it("reports both problems of an enum with a default and no options, without failing", () => {
		expect(fieldsOf(settingWith({ type: "enum", default: "x" }))).toEqual([
			"checks.0.params.0.options",
			"checks.0.params.0.default",
		]);
	});

	it("does not run the default check for a setting type that is not offered", () => {
		expect(fieldsOf(settingWith({ type: "colour", default: 5 }))).toEqual([
			"checks.0.params.0.type",
		]);
	});

	it("accepts 50 settings and refuses 51, naming the limit", () => {
		const settings = (count: number) =>
			listWith({
				params: Array.from({ length: count }, (_, i) => ({
					key: `k${i}`,
					label: "K",
					type: "string",
				})),
			});
		expect(issuesOf(settings(50))).toEqual([]);
		expect(messageAt(settings(51), "checks.0.params")).toBe(
			"must have at most 50 entries"
		);
	});
});

describe("check list schema — messages for plain settings", () => {
	const plain = (params: unknown) => listWith({ params });

	it("explains a value that cannot be a default and a value that is not a list or object", () => {
		expect(messageAt(plain({ gap: null }), "checks.0.params.gap")).toBe(
			"must have a default that is text, a number or true or false; use the list form for a setting with no default or with a fixed set of choices"
		);
		expect(messageAt(plain("x"), "checks.0.params")).toBe(
			"must be a list of settings or an object of setting names to default values"
		);
	});

	it("explains an empty setting name and a label that would be too long", () => {
		const empty = issuesOf(plain({ "": 1 }));
		expect(empty.map((issue) => issue.message)).toEqual([
			"must not have a setting with an empty name",
		]);
		const longKey = `ﬃ${"a".repeat(199)}`;
		const long = issuesOf(plain({ [longKey]: 1 }));
		expect(long.map((issue) => issue.message)).toEqual([
			"is too long: its label would exceed 200 characters",
		]);
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
