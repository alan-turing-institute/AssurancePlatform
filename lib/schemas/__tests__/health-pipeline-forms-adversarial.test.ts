import { describe, expect, it } from "vitest";
import {
	type HealthCheck,
	healthCheckListSchema,
	normaliseRecommendation,
} from "../health-checks";
import {
	computeSource,
	criteriaSaveRequestSchema,
	echoAgainst,
	type HealthCriteriaSettings,
	issuesToFieldErrors,
	nextCounters,
	normaliseSettings,
	type StoredCriteria,
	servedFromStored,
} from "../health-criteria";
import {
	normaliseCombiningBlocks,
	parseDurationSeconds,
} from "../health-rules";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTEGRATION_ID = "5b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

const checkEntry = (extra: Record<string, unknown> = {}) => ({
	name: "Panel Flatness Check",
	version: "2.1",
	scope: "panel",
	value: { type: "number" },
	...extra,
});

const listOf = (...checks: Record<string, unknown>[]) => ({
	pipeline: "Plain pipeline",
	checks,
});

function parsedCheck(extra: Record<string, unknown> = {}): HealthCheck {
	const result = healthCheckListSchema.safeParse(listOf(checkEntry(extra)));
	if (!result.success) {
		throw new Error(JSON.stringify(result.error.issues));
	}
	const [first] = result.data.checks;
	if (!first) {
		throw new Error("no check parsed");
	}
	return first;
}

function issuePaths(input: unknown): string[] {
	const result = healthCheckListSchema.safeParse(input);
	return result.success
		? []
		: result.error.issues.map((issue) => issue.path.join("."));
}

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) {
			deepFreeze(child);
		}
	}
	return value;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// ---------------------------------------------------------------------------
// Plain settings in a check list
// ---------------------------------------------------------------------------

describe("a check's plain settings object", () => {
	// Each row's expected entry is what the pipeline's own translation of the
	// same key and value produces: type from the value, label with every
	// underscore a space, first character upper case and the rest lower case.
	it.each([
		["max_dt", "PT12S", "Max dt", "duration"],
		["reported_value", "ground_speed", "Reported value", "string"],
		["simulated_sectors", 3, "Simulated sectors", "number"],
		["flag", true, "Flag", "boolean"],
		["off", false, "Off", "boolean"],
		["Mixed_CASE_key", "x", "Mixed case key", "string"],
		["a__b", 1.5, "A  b", "number"],
		["trailing_", "x", "Trailing ", "string"],
		["_leading", "x", " leading", "string"],
		["x1_y2", 0, "X1 y2", "number"],
		["neg", -2, "Neg", "number"],
		["empty", "", "Empty", "string"],
		["UPPER", "V", "Upper", "string"],
		["sector_count_2", 12, "Sector count 2", "number"],
		["w", "P1W", "W", "duration"],
		["d", "P2D", "D", "duration"],
		["t", "PT1H30M", "T", "duration"],
		["m", "PT90M", "M", "duration"],
		["pt", "PT", "Pt", "string"],
		["p", "P", "P", "string"],
		["lower", "pt12s", "Lower", "string"],
		["padded", "PT12S ", "Padded", "string"],
		["limit", "P36500D", "Limit", "duration"],
		["a_b_c_d", "some_text", "A b c d", "string"],
	])("stores %s = %j as label %j of type %s", (key, value, label, type) => {
		const stored = parsedCheck({ params: { [key]: value } });
		expect(stored.params).toEqual([{ key, label, type, default: value }]);
	});

	it("keeps the order of the settings as written", () => {
		const stored = parsedCheck({
			params: { zeta: "z", alpha: 1, mid: true },
		});
		expect(stored.params?.map((param) => param.key)).toEqual([
			"zeta",
			"alpha",
			"mid",
		]);
	});

	it("gives a text value a duration type exactly when TEA's own duration check reads it", () => {
		const texts = [
			"PT12S",
			"PT0S",
			"P0D",
			"PT",
			"P",
			"P1Y",
			"P1M",
			"PT1M",
			"P1W2DT3H4M5S",
			"P36500D",
			"P36501D",
			"P99999999999D",
			"pt5m",
			" PT5M",
			"PT5M\n",
			"PT1.5S",
			"PT-5S",
			"indefinite",
			"12",
			"",
		];
		for (const text of texts) {
			const [param] = parsedCheck({ params: { setting: text } }).params ?? [];
			expect(param?.type, text).toBe(
				parseDurationSeconds(text) === null ? "string" : "duration"
			);
			expect(param?.default).toBe(text);
		}
	});

	it("stores a duration that TEA refuses at the edges (zero length, over 100 years) as text", () => {
		const types = ["PT0S", "P36501D", "P99999999999D"].map(
			(text) => parsedCheck({ params: { setting: text } }).params?.[0]?.type
		);
		expect(types).toEqual(["string", "string", "string"]);
	});

	it("accepts a number of any size that is finite, and zero", () => {
		const stored = parsedCheck({
			params: { big: 1e300, tiny: 5e-324, zero: 0, negative_zero: -0 },
		});
		expect(stored.params?.map((param) => param.type)).toEqual([
			"number",
			"number",
			"number",
			"number",
		]);
	});

	it.each([
		["null", null],
		["an empty list", []],
		["a list", [1, 2]],
		["an empty object", {}],
		["an object", { nested: 1 }],
		["undefined", undefined],
	])("refuses %s as a value and names the setting", (_name, value) => {
		const paths = issuePaths(listOf(checkEntry({ params: { max_dt: value } })));
		expect(paths).toEqual(["checks.0.params.max_dt"]);
	});

	it("names only the refused setting when others are fine", () => {
		const paths = issuePaths(
			listOf(
				checkEntry({
					params: { good_one: 1, bad_one: null, good_two: "x", bad_two: [] },
				})
			)
		);
		expect(paths).toEqual([
			"checks.0.params.bad_one",
			"checks.0.params.bad_two",
		]);
	});

	it.each([
		["Infinity", Number.POSITIVE_INFINITY],
		["-Infinity", Number.NEGATIVE_INFINITY],
		["NaN", Number.NaN],
	])("refuses %s as a value", (_name, value) => {
		expect(
			issuePaths(listOf(checkEntry({ params: { limit: value } })))
		).toEqual(["checks.0.params.limit"]);
	});

	it("refuses a number that overflows when read from JSON text", () => {
		const body = JSON.parse(
			'{"pipeline":"p","checks":[{"name":"c","version":"1","scope":"item","value":{"type":"number"},"params":{"limit":1e999}}]}'
		);
		expect(issuePaths(body)).toEqual(["checks.0.params.limit"]);
	});

	it("refuses a setting with an empty name", () => {
		const result = healthCheckListSchema.safeParse(
			listOf(checkEntry({ params: { "": 1 } }))
		);
		expect(result.success).toBe(false);
	});

	it("refuses a name that has edge whitespace, as a key must match exactly", () => {
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { " padded": 1 } }))
			).success
		).toBe(false);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { "padded ": 1 } }))
			).success
		).toBe(false);
	});

	it("accepts 50 settings and refuses 51", () => {
		const settings = (count: number) =>
			Object.fromEntries(
				Array.from({ length: count }, (_, i) => [`setting_${i}`, i])
			);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: settings(50) }))
			).success
		).toBe(true);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: settings(51) }))
			).success
		).toBe(false);
	});

	it("accepts a name whose label is exactly 200 characters and refuses one longer", () => {
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { [`k${"a".repeat(199)}`]: 1 } }))
			).success
		).toBe(true);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { [`k${"a".repeat(200)}`]: 1 } }))
			).success
		).toBe(false);
	});

	it("refuses a label that grows past the limit when the name is converted", () => {
		// "İ" lower-cases to two UTF-16 units, so 101 of them make a label of
		// 201 units from a name of 101 characters.
		const key = "İ".repeat(101);
		expect(issuePaths(listOf(checkEntry({ params: { [key]: 1 } })))).toEqual([
			`checks.0.params.${key}`,
		]);
	});

	it("refuses a text that Postgres cannot store, in a name or a value", () => {
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { "a\u0000b": 1 } }))
			).success
		).toBe(false);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { fine: "a\u0000b" } }))
			).success
		).toBe(false);
		expect(
			healthCheckListSchema.safeParse(
				listOf(checkEntry({ params: { "a\ud800b": 1 } }))
			).success
		).toBe(false);
	});

	it("keeps names that look like built-in object properties as ordinary settings", () => {
		const stored = parsedCheck({
			params: {
				constructor: "c",
				toString: 1,
				hasOwnProperty: true,
				valueOf: "PT5S",
				prototype: "p",
			},
		});
		expect(stored.params?.map((param) => [param.key, param.type])).toEqual([
			["constructor", "string"],
			["toString", "number"],
			["hasOwnProperty", "boolean"],
			["valueOf", "duration"],
			["prototype", "string"],
		]);
	});

	it("keeps two settings whose labels come out the same, each under its own name", () => {
		const stored = parsedCheck({ params: { a_b: 1, A_B: 2, "a b": 3 } });
		expect(stored.params?.map((param) => param.key)).toEqual([
			"a_b",
			"A_B",
			"a b",
		]);
		expect(stored.params?.map((param) => param.label)).toEqual([
			"A b",
			"A b",
			"A b",
		]);
	});

	it("does not change the object it is given", () => {
		const input = deepFreeze(
			listOf(checkEntry({ params: { max_dt: "PT12S" } }))
		);
		expect(() => healthCheckListSchema.parse(input)).not.toThrow();
		expect(input.checks[0]?.params).toEqual({ max_dt: "PT12S" });
	});

	it("accepts both forms in one list and leaves the list form as it was", () => {
		const listForm = [
			{
				key: "tolerance_profile",
				label: "Tolerance profile",
				type: "enum",
				options: ["standard", "strict"],
				default: "standard",
			},
		];
		const result = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				checkEntry({ name: "Listed", params: listForm }),
				checkEntry({ name: "Plain", params: { max_dt: "PT12S" } }),
			],
		});
		expect(result.checks[0]?.params).toEqual(listForm);
		expect(result.checks[1]?.params).toEqual([
			{ key: "max_dt", label: "Max dt", type: "duration", default: "PT12S" },
		]);
	});

	it("still refuses a malformed list of settings and names the entry", () => {
		expect(
			issuePaths(listOf(checkEntry({ params: [{ key: "only_a_key" }] })))
		).toContain("checks.0.params.0.label");
		expect(
			issuePaths(
				listOf(
					checkEntry({
						params: [
							{ key: "a", label: "A", type: "string" },
							{ key: "a", label: "A again", type: "string" },
						],
					})
				)
			)
		).toEqual(["checks.0.params.1.key"]);
	});

	it.each([
		["text", "max_dt"],
		["a number", 5],
		["true", true],
		["null", null],
	])("refuses settings given as %s", (_name, params) => {
		expect(issuePaths(listOf(checkEntry({ params })))).not.toEqual([]);
	});

	it("does not accept scalar as the type of a setting", () => {
		expect(
			healthCheckListSchema.safeParse(
				listOf(
					checkEntry({
						params: [{ key: "a", label: "A", type: "scalar" }],
					})
				)
			).success
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// scalar
// ---------------------------------------------------------------------------

describe("the scalar value type", () => {
	it("is stored as number, with its unit", () => {
		expect(parsedCheck({ value: { type: "scalar" } }).value).toEqual({
			type: "number",
		});
		expect(
			parsedCheck({ value: { type: "scalar", unit: "kn" } }).value
		).toEqual({ type: "number", unit: "kn" });
	});

	it("leaves the other value types as they were", () => {
		expect(parsedCheck({ value: { type: "boolean" } }).value).toEqual({
			type: "boolean",
		});
		expect(
			parsedCheck({ value: { type: "string", allowed: ["a", "b"] } }).value
		).toEqual({ type: "string", allowed: ["a", "b"] });
	});

	it.each([
		["a capital letter", { type: "Scalar" }],
		[
			"a scalar with a list of allowed texts",
			{ type: "scalar", allowed: ["a"] },
		],
		["a scalar with an unknown key", { type: "scalar", colour: "red" }],
		["an unknown type", { type: "vector" }],
	])("refuses %s", (_name, value) => {
		expect(issuePaths(listOf(checkEntry({ value })))).not.toEqual([]);
	});

	it("does not change the object it is given", () => {
		const input = deepFreeze(listOf(checkEntry({ value: { type: "scalar" } })));
		expect(() => healthCheckListSchema.parse(input)).not.toThrow();
		expect(input.checks[0]?.value).toEqual({ type: "scalar" });
	});
});

// ---------------------------------------------------------------------------
// Version labels inside a recommendation
// ---------------------------------------------------------------------------

const withVersions = () => ({
	rule: {
		kind: "threshold",
		direction: "minimize",
		params: { pass_values: 0.5 },
		version: "r9",
	},
	reduction: {
		kind: "mean",
		version: "d9",
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.8 },
			version: "d9",
		},
	},
	aggregation: {
		kind: "proportion",
		params: { use_verdict: true },
		version: "a9",
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.9 },
			version: "a9",
		},
	},
	window: "PT5M",
	valid_for: "PT30M",
});

describe("version labels inside a recommendation", () => {
	it("are accepted and dropped from the rule, the reduction and its rule, and the aggregation and its rule", () => {
		const { recommended } = parsedCheck({ recommended: withVersions() });
		expect(JSON.stringify(recommended)).not.toContain("version");
		expect(recommended?.aggregation?.rule?.params).toEqual({
			pass_values: 0.9,
		});
		expect(recommended?.reduction?.rule?.direction).toBe("maximize");
		expect(recommended?.rule?.params).toEqual({ pass_values: 0.5 });
	});

	it("do not change the object they are given", () => {
		const input = deepFreeze(
			listOf(checkEntry({ recommended: withVersions() }))
		);
		expect(() => healthCheckListSchema.parse(input)).not.toThrow();
		expect(JSON.stringify(input)).toContain("a9");
	});

	it.each([
		["a number", 3],
		["a list", ["a1"]],
		["null", null],
		["an object", { label: "a1" }],
		["a text over 200 characters", "x".repeat(201)],
	])("are refused when %s, at the label's own path", (_name, version) => {
		const recommended = withVersions();
		recommended.aggregation.rule.version = version as never;
		expect(issuePaths(listOf(checkEntry({ recommended })))).toEqual([
			"checks.0.recommended.aggregation.rule.version",
		]);
	});

	it("are refused on the recommendation itself and on its window", () => {
		expect(
			healthCheckListSchema.safeParse(
				listOf(
					checkEntry({ recommended: { ...withVersions(), version: "x1" } })
				)
			).success
		).toBe(false);
	});

	it("may be an empty text", () => {
		const recommended = withVersions();
		recommended.aggregation.version = "";
		expect(
			healthCheckListSchema.safeParse(listOf(checkEntry({ recommended })))
				.success
		).toBe(true);
	});

	it("are still refused as unknown keys inside the settings blocks of a claim", () => {
		const settings = {
			check: { name: "c", version: "1" },
			rule: { kind: "identity" },
			aggregation: {
				kind: "proportion",
				params: { use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9 },
					version: "a1",
				},
			},
			window: "PT1M",
			valid_for: "PT5M",
		};
		const result = criteriaSaveRequestSchema.safeParse({
			integration_id: INTEGRATION_ID,
			settings,
			accept: true,
		});
		expect(result.success).toBe(false);
	});
});

describe("a recommended aggregation", () => {
	it("may carry a rule, and may omit it", () => {
		expect(
			parsedCheck({ recommended: withVersions() }).recommended?.aggregation
				?.rule
		).toBeDefined();
		const without = withVersions();
		(without.aggregation as Record<string, unknown>).rule = undefined;
		const { recommended } = parsedCheck({ recommended: without });
		expect(recommended?.aggregation?.rule).toBeUndefined();
	});

	it("keeps the pass mark of an older share in params.threshold when stored", () => {
		const { recommended } = parsedCheck({
			recommended: {
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.95, use_verdict: true },
				},
			},
		});
		// Published lists are stored as given; the conversion is made on reading.
		expect(recommended?.aggregation?.params.threshold).toBe(0.95);
	});
});

// ---------------------------------------------------------------------------
// The conversions are total, idempotent and leave what they do not know alone
// ---------------------------------------------------------------------------

const ODD_SHAPES: [string, unknown][] = [
	["undefined", undefined],
	["null", null],
	["zero", 0],
	["an empty text", ""],
	["a text", "aggregation"],
	["true", true],
	["an empty list", []],
	["a list holding a block", [{ aggregation: { kind: "proportion" } }]],
	["an empty object", {}],
	["a null aggregation", { aggregation: null }],
	["a text aggregation", { aggregation: "proportion" }],
	["a list aggregation", { aggregation: [] }],
	["a numeric aggregation", { aggregation: 5 }],
	["an aggregation with no params", { aggregation: { kind: "proportion" } }],
	[
		"an aggregation with null params",
		{ aggregation: { kind: "proportion", params: null } },
	],
	[
		"an aggregation with list params",
		{ aggregation: { kind: "proportion", params: [] } },
	],
	[
		"an aggregation with text params",
		{ aggregation: { kind: "proportion", params: "threshold" } },
	],
	[
		"an aggregation with a list as its kind",
		{ aggregation: { kind: ["proportion"], params: { threshold: 0.9 } } },
	],
	[
		"a null threshold",
		{ aggregation: { kind: "proportion", params: { threshold: null } } },
	],
	[
		"a text threshold",
		{ aggregation: { kind: "proportion", params: { threshold: "0.9" } } },
	],
	[
		"an object threshold",
		{ aggregation: { kind: "proportion", params: { threshold: { a: 1 } } } },
	],
	[
		"a null rule beside a threshold",
		{
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9 },
				rule: null,
			},
		},
	],
	[
		"a rule beside a threshold",
		{
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9 },
				rule: { kind: "threshold" },
			},
		},
	],
	["a null reduction", { reduction: null }],
	["a text reduction", { reduction: "percentile" }],
	["a percentile with no params", { reduction: { kind: "percentile" } }],
	[
		"a percentile with null params",
		{ reduction: { kind: "percentile", params: null } },
	],
	[
		"a percentile with list params",
		{ reduction: { kind: "percentile", params: [90] } },
	],
	[
		"a percentile given as both p and percentile",
		{ reduction: { kind: "percentile", params: { p: 90, percentile: 95 } } },
	],
	["a mean with a p", { reduction: { kind: "mean", params: { p: 90 } } }],
	["a null recommended block", { recommended: null }],
	["a list recommended block", { recommended: [] }],
	["a text recommended block", { recommended: "x" }],
	[
		"both blocks odd at once",
		{ aggregation: [], reduction: { kind: "percentile", params: { p: 1 } } },
	],
	[
		"an object with no prototype",
		Object.assign(Object.create(null), {
			aggregation: { kind: "proportion", params: { threshold: 0.9 } },
		}),
	],
	["a date", new Date(0)],
];

describe("the conversions of older forms", () => {
	const converters: [string, (value: unknown) => unknown][] = [
		["normaliseCombiningBlocks", normaliseCombiningBlocks],
		["normaliseSettings", normaliseSettings],
		[
			"normaliseRecommendation",
			(value) =>
				(
					normaliseRecommendation({ recommended: value } as never) as {
						recommended?: unknown;
					}
				).recommended,
		],
		["normaliseRecommendation on the entry itself", normaliseRecommendation],
	];

	for (const [name, convert] of converters) {
		describe(name, () => {
			it.each(ODD_SHAPES)("does not throw on %s", (_shape, input) => {
				expect(() => convert(input)).not.toThrow();
			});

			it.each(ODD_SHAPES)("is idempotent on %s", (_shape, input) => {
				const once = convert(input);
				expect(convert(once)).toEqual(once);
			});

			it.each(ODD_SHAPES)("does not change a frozen %s", (_shape, input) => {
				const frozen = deepFreeze(input);
				expect(() => convert(frozen)).not.toThrow();
			});
		});
	}

	it.each([
		["undefined", undefined],
		["null", null],
		["a number", 5],
		["a text", "x"],
		["a list", [1, 2]],
	])("normaliseSettings returns %s as it came", (_name, input) => {
		expect(normaliseSettings(input)).toBe(input);
	});

	it("returns settings that need no conversion as they came", () => {
		const settings = {
			check: { name: "c", version: "1" },
			rule: { kind: "identity" },
			aggregation: {
				kind: "proportion",
				params: { use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9 },
				},
			},
			window: "PT1M",
			valid_for: "PT5M",
		};
		expect(normaliseSettings(settings)).toEqual(settings);
	});

	it("moves a share's threshold to its own rule and keeps every other key", () => {
		const settings = {
			check: { name: "c", version: "1", scope: "item" },
			rule: { kind: "identity" },
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
			},
			window: "PT1M",
			valid_for: "PT5M",
			note: "kept",
		};
		expect(normaliseSettings(settings)).toEqual({
			check: { name: "c", version: "1", scope: "item" },
			rule: { kind: "identity" },
			aggregation: {
				kind: "proportion",
				params: { avail_floor: 0.8, use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.95 },
				},
			},
			window: "PT1M",
			valid_for: "PT5M",
			note: "kept",
		});
	});

	it.each([
		0, 1, 0.5, 0.000_01,
	])("keeps a threshold of %s, falsy or not", (threshold) => {
		const converted = normaliseSettings({
			aggregation: { kind: "proportion", params: { threshold } },
		}) as { aggregation: { rule: { params: { pass_values: number } } } };
		expect(converted.aggregation.rule.params.pass_values).toBe(threshold);
	});

	it("renames a percentile reduction's p, including a p of 0 and 100", () => {
		for (const p of [0, 50, 100]) {
			expect(
				normaliseSettings({
					reduction: { kind: "percentile", params: { p, avail_floor: 0.8 } },
				})
			).toEqual({
				reduction: {
					kind: "percentile",
					params: { percentile: p, avail_floor: 0.8 },
				},
			});
		}
	});

	it("does not rename p when the percentile is already named, or the reduction is not a percentile", () => {
		const both = {
			reduction: { kind: "percentile", params: { p: 90, percentile: 95 } },
		};
		expect(normaliseSettings(both)).toEqual(both);
		const mean = { reduction: { kind: "mean", params: { p: 90 } } };
		expect(normaliseSettings(mean)).toEqual(mean);
	});

	it("leaves a threshold alone on an aggregation that is not a share, or that has a rule", () => {
		const worstOf = {
			aggregation: { kind: "worst-of", params: { threshold: 0.9 } },
		};
		expect(normaliseSettings(worstOf)).toEqual(worstOf);
		const withRule = {
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9 },
				rule: { kind: "threshold", direction: "maximize" },
			},
		};
		expect(normaliseSettings(withRule)).toEqual(withRule);
	});

	it("does not touch blocks it does not know", () => {
		const input = {
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: { p: 1, threshold: 2 },
			},
			extra_block: {
				aggregation: { kind: "proportion", params: { threshold: 0.9 } },
			},
			reduction: { kind: "mean", params: { avail_floor: 0.5 } },
		};
		expect(normaliseSettings(clone(input))).toEqual(input);
	});

	it("does not change the object it is given", () => {
		const input = deepFreeze({
			aggregation: { kind: "proportion", params: { threshold: 0.9 } },
			reduction: { kind: "percentile", params: { p: 80 } },
		});
		expect(() => normaliseSettings(input)).not.toThrow();
		expect(input.aggregation.params).toEqual({ threshold: 0.9 });
		expect(input.reduction.params).toEqual({ p: 80 });
	});

	it("keeps a __proto__ key as data and does not reach the prototype", () => {
		const input = JSON.parse(
			'{"aggregation":{"kind":"proportion","params":{"threshold":0.9,"__proto__":{"polluted":true}}}}'
		);
		const converted = normaliseSettings(input) as {
			aggregation: { params: Record<string, unknown> };
		};
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();
		expect(converted.aggregation.params.polluted).toBeUndefined();
		expect(Object.getPrototypeOf(converted.aggregation.params)).toBe(
			Object.prototype
		);
	});

	it("converts a recommendation's share and percentile, and leaves the entry's other keys", () => {
		const entry = {
			name: "c",
			version: "1",
			scope: "item",
			value: { type: "number" },
			recommended: {
				rule: { kind: "identity" },
				reduction: { kind: "percentile", params: { p: 90 } },
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: true },
				},
				window: "PT1M",
			},
		};
		expect(normaliseRecommendation(entry as never)).toEqual({
			...entry,
			recommended: {
				rule: { kind: "identity" },
				reduction: { kind: "percentile", params: { percentile: 90 } },
				aggregation: {
					kind: "proportion",
					params: { use_verdict: true },
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 0.9 },
					},
				},
				window: "PT1M",
			},
		});
	});

	it("returns an entry with no recommendation as it came", () => {
		const entry = { name: "c", version: "1" };
		expect(normaliseRecommendation(entry)).toBe(entry);
	});
});

// ---------------------------------------------------------------------------
// A settings save in either form
// ---------------------------------------------------------------------------

const newSettings = (): Record<string, any> => ({
	check: { name: "Panel Flatness Check", version: "2.1", scope: "panel" },
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
	aggregation: {
		kind: "proportion",
		params: { avail_floor: 0.8, use_verdict: true },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.95 },
		},
	},
	window: "PT5M",
	valid_for: "PT30M",
});

const oldSettings = (): Record<string, any> => {
	const settings = newSettings();
	settings.reduction.params = { p: 90, avail_floor: 0.8 };
	settings.aggregation = {
		kind: "proportion",
		params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
	};
	return settings;
};

const saveRequest = (settings: unknown) => ({
	integration_id: INTEGRATION_ID,
	settings,
	accept: true,
});

function saveIssues(settings: unknown): Record<string, string> {
	const result = criteriaSaveRequestSchema.safeParse(saveRequest(settings));
	if (result.success) {
		return {};
	}
	return issuesToFieldErrors(
		result.error.issues.map((issue) => ({
			path: issue.path as (string | number)[],
			message: issue.message,
		}))
	);
}

describe("a settings save", () => {
	it("accepts the share in the pipeline's form", () => {
		const result = criteriaSaveRequestSchema.safeParse(
			saveRequest(newSettings())
		);
		expect(result.success).toBe(true);
	});

	it("stores a save request in the older form in the new form, equal to one sent in the new form", () => {
		const fromOld = criteriaSaveRequestSchema.parse(saveRequest(oldSettings()));
		const fromNew = criteriaSaveRequestSchema.parse(saveRequest(newSettings()));
		expect(fromOld.settings).toEqual(fromNew.settings);
		expect(fromOld.settings.aggregation?.params).not.toHaveProperty(
			"threshold"
		);
		expect(fromOld.settings.reduction?.params).not.toHaveProperty("p");
		expect(fromOld.settings.reduction?.params?.percentile).toBe(90);
	});

	it.each([0, 1])("accepts a pass mark of %s", (passValues) => {
		const settings = newSettings();
		settings.aggregation.rule.params.pass_values = passValues;
		expect(saveIssues(settings)).toEqual({});
	});

	it.each([
		["above 1", 1.000_000_1],
		["below 0", -0.0001],
		["a text", "0.9"],
		["null", null],
		["a list", [0.9]],
		["not a number", Number.NaN],
		["infinite", Number.POSITIVE_INFINITY],
	])("places a pass mark that is %s on its field", (_name, passValues) => {
		const settings = newSettings();
		settings.aggregation.rule.params.pass_values = passValues;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.rule.params.pass_values",
		]);
	});

	it("places an out-of-range pass mark sent in the older form on the new field", () => {
		const settings = oldSettings();
		settings.aggregation.params.threshold = 1.5;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.rule.params.pass_values",
		]);
	});

	it("places a missing pass mark on its field", () => {
		const settings = newSettings();
		settings.aggregation.rule.params = {};
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.rule.params.pass_values",
		]);
	});

	it("refuses a share with neither a rule nor a threshold, on the rule", () => {
		const settings = newSettings();
		settings.aggregation.rule = undefined;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.rule",
		]);
	});

	it.each([
		[
			"a band rule",
			{ kind: "band", params: { pass_values: [0.1, 0.9] } },
			"settings.aggregation.rule.kind",
		],
		[
			"a rule for a minimum",
			{
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: 0.9 },
			},
			"settings.aggregation.rule.direction",
		],
		[
			"a rule aiming at a target",
			{ kind: "threshold", direction: "target", params: { pass_values: 0.9 } },
			"settings.aggregation.rule.direction",
		],
		[
			"a threshold rule with no direction",
			{ kind: "threshold", params: { pass_values: 0.9 } },
			"settings.aggregation.rule.direction",
		],
		[
			"a marginal mark",
			{
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.9, marginal_values: 0.8 },
			},
			"settings.aggregation.rule.params.marginal_values",
		],
	])("places %s on its field", (_name, rule, path) => {
		const settings = newSettings();
		settings.aggregation.rule = rule;
		expect(Object.keys(saveIssues(settings))).toContain(path);
		expect(saveIssues(settings)[path]).toBeTruthy();
	});

	it("refuses a rule carrying a version label, as for every other block of a request", () => {
		const settings = newSettings();
		settings.aggregation.rule.version = "a1";
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.rule",
		]);
	});

	it("refuses a threshold that sits beside the rule, naming params.threshold", () => {
		const settings = newSettings();
		settings.aggregation.params.threshold = 0.9;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.params.threshold",
		]);
	});

	it("refuses the old marginal mark, naming params.marginal_threshold", () => {
		const settings = newSettings();
		settings.aggregation.params.marginal_threshold = 0.8;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.params.marginal_threshold",
		]);
	});

	it.each([
		"worst-of",
		"percentile",
	])("refuses a %s combining step for now, on its kind", (kind) => {
		const settings = newSettings();
		settings.aggregation.kind = kind;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.kind",
		]);
	});

	it("refuses a share that is not judged on verdicts, and one that does not say", () => {
		const off = newSettings();
		off.aggregation.params.use_verdict = false;
		expect(Object.keys(saveIssues(off))).toEqual([
			"settings.aggregation.params.use_verdict",
		]);
		const missing = newSettings();
		missing.aggregation.params = { avail_floor: 0.8 };
		expect(Object.keys(saveIssues(missing))).toEqual([
			"settings.aggregation.params.use_verdict",
		]);
	});

	it("keeps checking the share of answers needed", () => {
		const settings = newSettings();
		settings.aggregation.params.avail_floor = 2;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.aggregation.params.avail_floor",
		]);
	});

	it.each([0, 100, 37.5])("accepts a percentile of %s", (percentile) => {
		const settings = newSettings();
		settings.reduction.params.percentile = percentile;
		expect(saveIssues(settings)).toEqual({});
	});

	it.each([
		["above 100", 100.1],
		["below 0", -1],
		["a text", "90"],
		["null", null],
		["absent", undefined],
	])("places a percentile that is %s on reduction.params.percentile", (_name, percentile) => {
		const settings = newSettings();
		settings.reduction.params.percentile = percentile;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.reduction.params.percentile",
		]);
	});

	it("places an out-of-range p sent in the older form on percentile", () => {
		const settings = oldSettings();
		settings.reduction.params.p = 101;
		expect(Object.keys(saveIssues(settings))).toEqual([
			"settings.reduction.params.percentile",
		]);
	});

	it("refuses a __proto__ key in the older form instead of dropping it", () => {
		const body = JSON.parse(
			JSON.stringify(saveRequest(oldSettings())).replace(
				'"threshold":0.95',
				'"threshold":0.95,"__proto__":{"x":1}'
			)
		);
		expect(criteriaSaveRequestSchema.safeParse(body).success).toBe(false);
	});

	it("does not change the request it is given", () => {
		const request = deepFreeze(saveRequest(oldSettings()));
		expect(() => criteriaSaveRequestSchema.parse(request)).not.toThrow();
		expect(
			(request.settings as Record<string, any>).aggregation.params
		).toHaveProperty("threshold");
	});
});

// ---------------------------------------------------------------------------
// Labels and sources do not move for an older stored row
// ---------------------------------------------------------------------------

const COUNTERS = { rule: 4, reduction: 2, aggregation: 3 };

function storedRow(settings: unknown): StoredCriteria {
	return {
		settings,
		ruleVersion: COUNTERS.rule,
		reductionVersion: COUNTERS.reduction,
		aggregationVersion: COUNTERS.aggregation,
		revision: 7,
		state: "ACCEPTED",
	};
}

describe("a stored row in the older form", () => {
	it("is served in the new form with the labels it had", () => {
		const served = servedFromStored(storedRow(oldSettings()));
		expect(served.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.95 },
				version: "a3",
			},
			version: "a3",
		});
		expect(served.reduction?.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
		expect(served.reduction?.version).toBe("d2");
		expect(served.rule.version).toBe("r4");
	});

	it("is served the same as the same row stored in the new form", () => {
		expect(servedFromStored(storedRow(oldSettings()))).toEqual(
			servedFromStored(storedRow(newSettings()))
		);
	});

	it("does not move a label when it is saved again unchanged, in either form", () => {
		const previous = normaliseSettings(oldSettings()) as HealthCriteriaSettings;
		for (const request of [oldSettings(), newSettings()]) {
			const next = criteriaSaveRequestSchema.parse(
				saveRequest(request)
			).settings;
			expect(
				nextCounters({ counters: COUNTERS, settings: previous }, next)
			).toEqual(COUNTERS);
		}
	});

	it("moves only the aggregation's label when only the pass mark changes", () => {
		const previous = normaliseSettings(oldSettings()) as HealthCriteriaSettings;
		const changed = newSettings();
		changed.aggregation.rule.params.pass_values = 0.9;
		const next = criteriaSaveRequestSchema.parse(saveRequest(changed)).settings;
		expect(
			nextCounters({ counters: COUNTERS, settings: previous }, next)
		).toEqual({ ...COUNTERS, aggregation: 4 });
	});

	it("keeps every block as recommended against a recommendation in either form", () => {
		const entry = {
			name: "Panel Flatness Check",
			version: "2.1",
			scope: "panel",
			value: { type: "number" },
			recommended: {
				rule: newSettings().rule,
				reduction: oldSettings().reduction,
				aggregation: oldSettings().aggregation,
				window: "PT5M",
				valid_for: "PT30M",
			},
		};
		const check = normaliseRecommendation(entry as never);
		const settings = criteriaSaveRequestSchema.parse(
			saveRequest(oldSettings())
		).settings;
		const source = computeSource(settings, check, null);
		expect(source.kind).toBe("recommended");
		expect(source.aggregation).toBe("recommended");
		expect(source.reduction).toBe("recommended");
	});

	it("keeps each block's source when the check has left the list and nothing changed", () => {
		const previousSettings = normaliseSettings(
			oldSettings()
		) as HealthCriteriaSettings;
		const settings = criteriaSaveRequestSchema.parse(
			saveRequest(oldSettings())
		).settings;
		const source = computeSource(settings, null, {
			settings: previousSettings,
			source: {
				kind: "recommended",
				check_version: "2.1",
				rule: "recommended",
				timing: "recommended",
				reduction: "recommended",
				aggregation: "recommended",
			},
		});
		expect(source.kind).toBe("recommended");
		expect(source.aggregation).toBe("recommended");
	});

	it("matches a record that echoes the labels served, and a record in the older form", () => {
		const row = storedRow(oldSettings());
		const base = {
			check: { version: "2.1" },
			rule: { version: "r4" },
			reduction: { version: "d2" },
			aggregation: { version: "a3" },
			window: "PT5M",
			valid_for: "PT30M",
		};
		expect(echoAgainst(base, row).state).toBe("MATCH");
		expect(
			echoAgainst({ ...base, aggregation: { version: "a2" } }, row)
		).toMatchObject({
			state: "MISMATCH",
			differences: [{ field: "aggregation.version" }],
		});
	});
});
