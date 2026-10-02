import { describe, expect, it } from "vitest";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "../../../src/__tests__/fixtures/health-checks";
import { healthCheckListSchema } from "../health-checks";
import {
	checkListIssues,
	compareEcho,
	computeSource,
	criteriaRetirementRequestSchema,
	criteriaSaveRequestSchema,
	type HealthCriteriaSettings,
	healthCriteriaSettingsSchema,
	issuesToFieldErrors,
	nextCounters,
	servedSettings,
} from "../health-criteria";

const checks = healthCheckListSchema.parse(buildHealthCheckList()).checks;
const checkNamed = (name: string) => {
	const found = checks.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no fixture check ${name}`);
	}
	return found;
};
const itemCheck = checkNamed(ITEM_CHECK_NAME);
const numericCheck = checkNamed(NUMERIC_CHECK_NAME);
const systemCheck = checkNamed(SYSTEM_CHECK_NAME);

/** The item check's recommendation as complete settings. */
function itemSettings(
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	const { recommended } = itemCheck;
	return {
		check: {
			name: itemCheck.name,
			version: itemCheck.version,
			scope: "item",
			params: { camera_line: "ALL" },
		},
		...recommended,
		...overrides,
	};
}

function parse(settings: Record<string, unknown>) {
	return healthCriteriaSettingsSchema.safeParse(settings);
}

/** Field errors from the shape checks and then the check-list checks. */
function fieldErrorsFor(
	settings: Record<string, unknown>,
	check = itemCheck
): Record<string, string> {
	const parsed = parse(settings);
	if (!parsed.success) {
		return Object.fromEntries(
			parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])
		);
	}
	return issuesToFieldErrors(checkListIssues(parsed.data, check));
}

function parsedSettings(settings: Record<string, unknown>) {
	return healthCriteriaSettingsSchema.parse(settings);
}

describe("settings schema", () => {
	it("accepts a check's recommendation as complete settings", () => {
		expect(parse(itemSettings()).success).toBe(true);
		expect(fieldErrorsFor(itemSettings())).toEqual({});
	});

	it("refuses the direction target and a rule kind the check's value cannot use", () => {
		expect(
			fieldErrorsFor(
				itemSettings({ rule: { kind: "threshold", direction: "target" } }),
				numericCheck
			)["rule.direction"]
		).toContain("target");
		expect(
			fieldErrorsFor(
				itemSettings({
					rule: { kind: "band", params: { pass_values: [1, 2] } },
				})
			)["rule.kind"]
		).toBeDefined();
	});

	it("refuses an aggregation other than proportion, use_verdict false and a marginal threshold", () => {
		const aggregation = (
			params: Record<string, unknown>,
			kind = "proportion"
		) => itemSettings({ aggregation: { kind, params } });
		expect(
			fieldErrorsFor(aggregation({ percentile: 90 }, "percentile"))[
				"aggregation.kind"
			]
		).toBe("must be proportion");
		expect(
			fieldErrorsFor(aggregation({ threshold: 0.9, use_verdict: false }))[
				"aggregation.params.use_verdict"
			]
		).toBe("must be true");
		expect(
			fieldErrorsFor(
				aggregation({
					threshold: 0.9,
					use_verdict: true,
					marginal_threshold: 0.8,
				})
			)["aggregation.params.marginal_threshold"]
		).toContain("not available");
	});

	it("refuses fields the server owns and durations in months, years or over 100 years", () => {
		expect(parse(itemSettings({ source: { kind: "hand" } })).success).toBe(
			false
		);
		expect(parse(itemSettings({ window: "P1M" })).success).toBe(false);
		expect(parse(itemSettings({ valid_for: "P101Y" })).success).toBe(false);
		expect(parse(itemSettings({ valid_for: "P40000D" })).success).toBe(false);
		expect(parse(itemSettings({ valid_for: "indefinite" })).success).toBe(true);
	});

	it("requires a window for every check", () => {
		const { window: _window, ...withoutWindow } = itemSettings();
		expect(parse(withoutWindow).success).toBe(false);
	});

	it("refuses text a database cannot store", () => {
		expect(
			parse(
				itemSettings({
					check: {
						name: itemCheck.name,
						version: itemCheck.version,
						params: { camera_line: "bad\u0000text" },
					},
				})
			).success
		).toBe(false);
	});

	it("puts a marginal limit on the failing side of the pass limit", () => {
		const threshold = (direction: string, pass: number, marginal: number) =>
			fieldErrorsFor(
				itemSettings({
					rule: {
						kind: "threshold",
						direction,
						params: { pass_values: pass, marginal_values: marginal },
					},
				}),
				numericCheck
			)["rule.params.marginal_values"];
		expect(threshold("minimize", 0.5, 1)).toBeUndefined();
		expect(threshold("minimize", 0.5, 0.2)).toContain("failing side");
		expect(threshold("maximize", 0.5, 0.2)).toBeUndefined();
		expect(threshold("maximize", 0.5, 0.8)).toContain("failing side");
	});

	it("requires a marginal band to contain the pass band", () => {
		const band = (pass: number[], marginal: number[]) =>
			fieldErrorsFor(
				itemSettings({
					rule: {
						kind: "band",
						params: { pass_values: pass, marginal_values: marginal },
					},
				}),
				numericCheck
			)["rule.params.marginal_values"];
		expect(band([1, 2], [0, 3])).toBeUndefined();
		expect(band([1, 2], [1.5, 3])).toContain("contain");
	});
});

describe("settings against a check", () => {
	it("refuses a rule that does not fit the value type", () => {
		expect(
			fieldErrorsFor(
				itemSettings({
					rule: { kind: "membership", params: { pass_values: ["a"] } },
				})
			)["rule.kind"]
		).toContain("identity");
		expect(
			fieldErrorsFor(
				{
					check: { name: numericCheck.name, version: numericCheck.version },
					rule: { kind: "identity" },
					aggregation: numericCheck.recommended?.aggregation,
					window: "PT5M",
					valid_for: "PT30M",
				},
				numericCheck
			)["rule.kind"]
		).toContain("threshold");
	});

	it("refuses a reduction or aggregation on a whole-system check", () => {
		const errors = fieldErrorsFor(
			{
				check: { name: systemCheck.name, version: systemCheck.version },
				...systemCheck.recommended,
				reduction: { kind: "last" },
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: true },
				},
			},
			systemCheck
		);
		expect(errors.reduction).toContain("whole-system");
		expect(errors.aggregation).toContain("whole-system");
		expect(
			fieldErrorsFor(
				{
					check: { name: systemCheck.name, version: systemCheck.version },
					...systemCheck.recommended,
				},
				systemCheck
			)
		).toEqual({});
	});

	it("requires an aggregation on every other check", () => {
		const { aggregation: _aggregation, ...rest } = itemSettings();
		expect(fieldErrorsFor(rest).aggregation).toBe("is required");
	});

	it("requires the reduction's own rule when a yes-or-no rule meets an averaging reduction", () => {
		const reduction = (kind: string, withRule: boolean) =>
			fieldErrorsFor(
				itemSettings({
					reduction: {
						kind,
						...(withRule && {
							rule: {
								kind: "threshold",
								direction: "maximize",
								params: { pass_values: 0.8 },
							},
						}),
					},
				})
			)["reduction.rule"];
		expect(reduction("mean", false)).toBe(
			"is required: an identity rule cannot judge the mean of several readings"
		);
		expect(reduction("mean", true)).toBeUndefined();
		expect(reduction("last", false)).toBeUndefined();
	});

	it("names the rule kind a check is judged by, with the right article", () => {
		expect(
			fieldErrorsFor(
				itemSettings({
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 1 },
					},
				})
			)["rule.kind"]
		).toBe("a yes-or-no check is judged by an identity rule, not threshold");
		expect(
			fieldErrorsFor(
				{
					check: { name: numericCheck.name, version: numericCheck.version },
					...numericCheck.recommended,
					rule: { kind: "identity" },
				},
				numericCheck
			)["rule.kind"]
		).toBe(
			"a numeric check is judged by a threshold or band or membership rule, not identity"
		);
	});

	it("lowercases the integration id in a save request", () => {
		const parsed = criteriaSaveRequestSchema.parse({
			integration_id: "7ACD824E-0000-4000-8000-0000000000AA",
			settings: itemSettings(),
			accept: true,
		});
		expect(parsed.integration_id).toBe("7acd824e-0000-4000-8000-0000000000aa");
	});

	it("refuses a prototype key in a check's own settings, at any depth", () => {
		const bag = (json: string) =>
			parse(
				itemSettings({
					check: JSON.parse(
						`{"name":"${itemCheck.name}","version":"${itemCheck.version}","params":${json}}`
					),
				})
			);
		for (const [json, field] of [
			['{"__proto__":"x"}', "check.params.__proto__"],
			['{"a":{"__proto__":{"b":1}}}', "check.params.a.__proto__"],
		] as const) {
			const result = bag(json);
			expect(result.success).toBe(false);
			expect(
				result.success
					? []
					: result.error.issues.map((issue) => issue.path.join("."))
			).toEqual([field]);
		}
	});

	it("refuses a check setting the check does not describe, or of the wrong type", () => {
		const params = (value: Record<string, unknown>) =>
			fieldErrorsFor(
				itemSettings({
					check: {
						name: itemCheck.name,
						version: itemCheck.version,
						params: value,
					},
				})
			);
		expect(params({ nonsense: 1 })["check.params.nonsense"]).toContain(
			"describes"
		);
		expect(params({ camera_line: 3 })["check.params.camera_line"]).toContain(
			"string"
		);
		const tolerance = (value: unknown) =>
			fieldErrorsFor(
				{
					check: {
						name: numericCheck.name,
						version: numericCheck.version,
						params: { tolerance_profile: value },
					},
					...numericCheck.recommended,
				},
				numericCheck
			)["check.params.tolerance_profile"];
		expect(tolerance("strict")).toBeUndefined();
		expect(tolerance("loose")).toBe("must be one of standard, strict");
	});

	it("refuses any reduction on a check that returns text", () => {
		const textCheck = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				{
					name: "Label Text Check",
					version: "1",
					scope: "item",
					value: { type: "string" },
				},
			],
		}).checks[0];
		if (!textCheck) {
			throw new Error("no text check");
		}
		const settings = {
			check: { name: textCheck.name, version: textCheck.version },
			rule: { kind: "membership", params: { pass_values: ["ok"] } },
			reduction: { kind: "last" },
			aggregation: {
				kind: "proportion",
				params: { threshold: 0.9, use_verdict: true },
			},
			window: "PT1M",
			valid_for: "PT5M",
		};
		expect(fieldErrorsFor(settings, textCheck).reduction).toContain("text");
		const { reduction: _reduction, ...without } = settings;
		expect(fieldErrorsFor(without, textCheck)).toEqual({});
	});

	it("refuses a check scope that differs from the list's, and a date-and-time check", () => {
		expect(
			fieldErrorsFor(
				itemSettings({
					check: {
						name: itemCheck.name,
						version: itemCheck.version,
						scope: "region",
					},
				})
			)["check.scope"]
		).toContain("item");
		const timeCheck = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				{
					name: "Clock Check",
					version: "1",
					scope: "item",
					value: { type: "datetime" },
				},
			],
		}).checks[0];
		if (!timeCheck) {
			throw new Error("no clock check");
		}
		expect(fieldErrorsFor(itemSettings(), timeCheck)["rule.kind"]).toContain(
			"date and time"
		);
	});
});

describe("request schemas", () => {
	it("refuses a body that carries a field the server sets", () => {
		const body = {
			integration_id: "7acd824e-0000-4000-8000-000000000001",
			settings: itemSettings(),
			accept: true,
		};
		expect(criteriaSaveRequestSchema.safeParse(body).success).toBe(true);
		expect(
			criteriaSaveRequestSchema.safeParse({ ...body, source: {} }).success
		).toBe(false);
		expect(
			criteriaSaveRequestSchema.safeParse({ ...body, accept: "yes" }).success
		).toBe(false);
		expect(
			criteriaRetirementRequestSchema.safeParse({ reason: "  " }).success
		).toBe(false);
		expect(criteriaRetirementRequestSchema.safeParse({}).success).toBe(true);
	});
});

describe("version counters", () => {
	const settings = (overrides: Record<string, unknown> = {}) =>
		parsedSettings(itemSettings(overrides));
	const first = nextCounters(null, settings());

	it("starts every present block at 1 and leaves an absent one at 0", () => {
		expect(first).toEqual({ rule: 1, reduction: 1, aggregation: 1 });
		const { reduction: _reduction, ...rest } = itemSettings();
		expect(nextCounters(null, parsedSettings(rest))).toEqual({
			rule: 1,
			reduction: 0,
			aggregation: 1,
		});
	});

	it("raises only the counter of the block that changed", () => {
		const changed = settings({ rule: { kind: "identity", params: { x: 1 } } });
		expect(
			nextCounters({ counters: first, settings: settings() }, changed)
		).toEqual({ rule: 2, reduction: 1, aggregation: 1 });
	});

	it("raises none when only the check's own version or settings change", () => {
		const other = settings({
			check: {
				name: itemCheck.name,
				version: "9.9",
				params: { camera_line: "B" },
			},
		});
		expect(
			nextCounters({ counters: first, settings: settings() }, other)
		).toEqual(first);
	});

	it("raises all three when the check's name changes", () => {
		const other = settings({
			check: { name: "Another Check", version: "1" },
		});
		expect(
			nextCounters({ counters: first, settings: settings() }, other)
		).toEqual({ rule: 2, reduction: 2, aggregation: 2 });
	});

	it("keeps an absent block's counter and counts adding it back as a change", () => {
		const { reduction: _reduction, ...rest } = itemSettings();
		const without = parsedSettings(rest);
		const afterRemoval = nextCounters(
			{ counters: first, settings: settings() },
			without
		);
		expect(afterRemoval.reduction).toBe(1);
		expect(
			nextCounters({ counters: afterRemoval, settings: without }, settings())
				.reduction
		).toBe(2);
	});

	it("puts the labels in place and gives the reduction's rule the reduction's label", () => {
		const served = servedSettings(settings(), {
			rule: 3,
			reduction: 2,
			aggregation: 5,
		});
		expect(served.rule.version).toBe("r3");
		expect(served.reduction?.version).toBe("d2");
		expect(served.reduction?.rule?.version).toBe("d2");
		expect(served.aggregation?.version).toBe("a5");
	});
});

describe("where each block came from", () => {
	it("is recommended throughout when a recommendation is accepted unchanged", () => {
		expect(
			computeSource(parsedSettings(itemSettings()), itemCheck, null)
		).toEqual({
			kind: "recommended",
			check_version: "0.3",
			check_params: "recommended",
			rule: "recommended",
			reduction: "recommended",
			aggregation: "recommended",
			timing: "recommended",
		});
	});

	it("marks only the block with a changed number as edited", () => {
		const source = computeSource(
			parsedSettings(itemSettings({ window: "PT2M" })),
			itemCheck,
			null
		);
		expect(source.timing).toBe("edited");
		expect(source.rule).toBe("recommended");
		expect(source.kind).toBe("edited");
	});

	it("calls a block written by hand when the check recommends none", () => {
		const bare = healthCheckListSchema.parse({
			pipeline: "p",
			checks: [
				{
					name: "Plain Check",
					version: "1",
					scope: "environment",
					value: { type: "number" },
				},
			],
		}).checks[0];
		if (!bare) {
			throw new Error("no plain check");
		}
		const source = computeSource(
			parsedSettings({
				check: { name: bare.name, version: bare.version },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 1 },
				},
				window: "PT1M",
				valid_for: "PT5M",
			}),
			bare,
			null
		);
		expect(source).toEqual({
			kind: "hand",
			check_version: "1",
			rule: "hand",
			timing: "hand",
		});
	});
});

describe("echo check", () => {
	const declared = servedSettings(parsedSettings(itemSettings()), {
		rule: 3,
		reduction: 2,
		aggregation: 1,
	});
	const echoed = (overrides: Record<string, unknown> = {}) => ({
		check: { version: "0.3", params: { camera_line: "ALL" } },
		rule: { version: "r3" },
		reduction: { version: "d2" },
		aggregation: { version: "a1" },
		window: "PT1M",
		valid_for: "PT5M",
		...overrides,
	});

	it("finds no difference in a record that echoes the settings", () => {
		expect(compareEcho(echoed(), declared)).toEqual([]);
	});

	it("compares durations as lengths of time", () => {
		expect(
			compareEcho(echoed({ window: "PT60S", valid_for: "PT300S" }), declared)
		).toEqual([]);
		expect(compareEcho(echoed({ window: "PT2M" }), declared)).toEqual([
			{ field: "window", declared: "PT1M", used: "PT2M" },
		]);
	});

	it("lists each difference by field", () => {
		expect(
			compareEcho(
				echoed({
					check: { version: "0.2", params: { camera_line: "B" } },
					rule: { version: "r2" },
					aggregation: { version: "a2" },
					valid_for: "indefinite",
				}),
				declared
			)
		).toEqual([
			{ field: "check.version", declared: "0.3", used: "0.2" },
			{
				field: "check.params",
				declared: { camera_line: "ALL" },
				used: { camera_line: "B" },
			},
			{ field: "rule.version", declared: "r3", used: "r2" },
			{ field: "aggregation.version", declared: "a1", used: "a2" },
			{ field: "valid_for", declared: "PT5M", used: "indefinite" },
		]);
	});

	it("reports a reduction or aggregation present on one side only", () => {
		expect(compareEcho(echoed({ reduction: undefined }), declared)).toEqual([
			{ field: "reduction", declared: "d2", used: null },
		]);
		const noAggregation = servedSettings(
			parsedSettings({
				...itemSettings(),
				aggregation: undefined,
			}),
			{ rule: 3, reduction: 2, aggregation: 1 }
		);
		expect(compareEcho(echoed(), noAggregation)).toEqual([
			{ field: "aggregation", declared: null, used: "a1" },
		]);
	});

	it("treats absent check settings as an empty set and fills in no defaults", () => {
		const bare = servedSettings(
			parsedSettings(
				itemSettings({ check: { name: itemCheck.name, version: "0.3" } })
			),
			{ rule: 3, reduction: 2, aggregation: 1 }
		);
		expect(compareEcho(echoed({ check: { version: "0.3" } }), bare)).toEqual(
			[]
		);
		expect(
			compareEcho(echoed({ check: { version: "0.3", params: {} } }), bare)
		).toEqual([]);
		expect(compareEcho(echoed(), bare)).toEqual([
			{ field: "check.params", declared: {}, used: { camera_line: "ALL" } },
		]);
	});
});

describe("type surface", () => {
	it("keeps the settings type free of version labels", () => {
		const settings: HealthCriteriaSettings = parsedSettings(itemSettings());
		expect(settings.rule).not.toHaveProperty("version");
	});
});
