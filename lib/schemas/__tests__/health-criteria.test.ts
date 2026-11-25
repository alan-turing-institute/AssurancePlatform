import { describe, expect, it } from "vitest";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "../../../src/__tests__/fixtures/health-checks";
import { type HealthCheck, healthCheckListSchema } from "../health-checks";
import {
	blockIssues,
	checkListIssues,
	compareEcho,
	computeSource,
	criteriaRetirementRequestSchema,
	criteriaSaveRequestSchema,
	echoAgainst,
	type HealthCriteriaSettings,
	healthCriteriaSettingsSchema,
	issuesToFieldErrors,
	nextCounters,
	normaliseSettings,
	type SettingsSource,
	servedFromStored,
	servedSettings,
	timingIssues,
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

/** A share-of-subjects aggregation in the current form, with its pass mark as a rule. */
function shareAggregation(
	passMark: unknown,
	params: Record<string, unknown> = { use_verdict: true }
) {
	return {
		kind: "proportion",
		params,
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: passMark },
		},
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
		) =>
			itemSettings({
				aggregation: { ...shareAggregation(0.9, params), kind },
			});
		expect(
			fieldErrorsFor(aggregation({ percentile: 90 }, "percentile"))[
				"aggregation.kind"
			]
		).toBe("must be proportion");
		expect(
			fieldErrorsFor(aggregation({ use_verdict: false }))[
				"aggregation.params.use_verdict"
			]
		).toBe("must be true");
		expect(
			fieldErrorsFor(
				aggregation({ use_verdict: true, marginal_threshold: 0.8 })
			)["aggregation.params.marginal_threshold"]
		).toContain("not available");
	});

	it("judges the share by its own threshold rule: present, a maximize threshold, a pass mark from 0 to 1, no marginal mark yet", () => {
		const errors = (aggregation: unknown) =>
			fieldErrorsFor(itemSettings({ aggregation }));
		const noRule = { kind: "proportion", params: { use_verdict: true } };
		expect(errors(noRule)["aggregation.rule"]).toBe("is required");
		const withRule = (rule: unknown) => ({ ...noRule, rule });
		expect(
			errors(withRule({ kind: "band", params: { pass_values: [0, 1] } }))[
				"aggregation.rule.kind"
			]
		).toBe("must be threshold");
		expect(
			errors(
				withRule({
					kind: "threshold",
					direction: "minimize",
					params: { pass_values: 0.5 },
				})
			)["aggregation.rule.direction"]
		).toBe("must be maximize");
		for (const passMark of [1.01, -0.01, "0.9"]) {
			expect(
				errors(shareAggregation(passMark))[
					"aggregation.rule.params.pass_values"
				],
				String(passMark)
			).toBe("must be a number from 0 to 1");
		}
		for (const passMark of [0, 0.5, 1]) {
			expect(errors(shareAggregation(passMark)), String(passMark)).toEqual({});
		}
		expect(
			errors({
				...noRule,
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9, marginal_values: 0.8 },
				},
			})["aggregation.rule.params.marginal_values"]
		).toContain("not available");
		expect(
			errors({
				...shareAggregation(0.9),
				params: { threshold: 0.9, use_verdict: true },
			})["aggregation.params.threshold"]
		).toContain("not available");
	});

	it("reads a percentile reduction's percentile from percentile", () => {
		const reduction = (params: Record<string, unknown>) =>
			itemSettings({
				reduction: { kind: "percentile", params, rule: itemSettings().rule },
			});
		expect(
			fieldErrorsFor(reduction({ percentile: 95 }))[
				"reduction.params.percentile"
			]
		).toBeUndefined();
		expect(
			fieldErrorsFor(reduction({ percentile: 101 }))[
				"reduction.params.percentile"
			]
		).toContain("0 to 100");
		expect(
			fieldErrorsFor(reduction({}))["reduction.params.percentile"]
		).toContain("0 to 100");
	});

	it("refuses a p beside the percentile, so a row never carries both", () => {
		const settings = itemSettings({
			reduction: {
				kind: "percentile",
				params: { percentile: 95, p: 90 },
				rule: itemSettings().rule,
			},
		});
		expect(fieldErrorsFor(settings)["reduction.params.p"]).toBe(
			"is not available in evidence settings"
		);
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
				aggregation: shareAggregation(0.9),
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
			aggregation: shareAggregation(0.9),
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

	it("gives the aggregation's rule the aggregation's label", () => {
		const served = servedSettings(settings(), {
			rule: 3,
			reduction: 2,
			aggregation: 5,
		});
		expect(served.aggregation?.rule?.version).toBe("a5");
		expect(served.aggregation?.rule?.params?.pass_values).toBe(0.95);
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

	it("compares the window and the validity as lengths of time, so the same length in other units is not an edit", () => {
		const source = computeSource(
			parsedSettings(itemSettings({ window: "PT60S", valid_for: "PT300S" })),
			itemCheck,
			null
		);
		expect(source.timing).toBe("recommended");
		expect(source.kind).toBe("recommended");
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

	it("treats two unreadable lengths as the same only when their text is the same", () => {
		const open = servedSettings(
			parsedSettings(itemSettings({ valid_for: "indefinite" })),
			{ rule: 3, reduction: 2, aggregation: 1 }
		);
		expect(compareEcho(echoed({ valid_for: "indefinite" }), open)).toEqual([]);
		expect(
			compareEcho(echoed({ valid_for: "forever" }), open).map(
				(difference) => difference.field
			)
		).toEqual(["valid_for"]);
	});

	it("reports nothing about a reduction or aggregation that neither side uses", () => {
		const wholeSystem = servedSettings(
			parsedSettings({
				check: { name: systemCheck.name, version: systemCheck.version },
				...systemCheck.recommended,
			}),
			{ rule: 3, reduction: 0, aggregation: 0 }
		);
		const record = {
			check: { version: systemCheck.version },
			rule: { version: "r3" },
			window: "PT10M",
			valid_for: "PT1H",
		};
		expect(compareEcho(record, wholeSystem)).toEqual([]);
	});

	const storedRow = (state: "SUGGESTED" | "ACCEPTED" | "INACTIVE") => ({
		settings: itemSettings(),
		ruleVersion: 3,
		reductionVersion: 2,
		aggregationVersion: 1,
		revision: 7,
		state,
	});

	it.each([
		["no stored row", null],
		["a suggested row", storedRow("SUGGESTED")],
		["an inactive row", storedRow("INACTIVE")],
	])("declares nothing for %s", (_name, row) => {
		expect(echoAgainst(echoed(), row)).toEqual({
			state: "UNDECLARED",
			differences: null,
			revision: null,
		});
	});

	it("matches or mismatches a record against an accepted row, with the row's revision", () => {
		const matched = echoAgainst(echoed(), storedRow("ACCEPTED"));
		expect(matched.state).toBe("MATCH");
		expect(matched.differences).toBeNull();
		expect(matched.revision).toBe(7);
		const mismatched = echoAgainst(
			echoed({ window: "PT2M" }),
			storedRow("ACCEPTED")
		);
		expect(mismatched.state).toBe("MISMATCH");
		expect(
			mismatched.differences?.map((difference) => difference.field)
		).toEqual(["window"]);
		expect(mismatched.revision).toBe(7);
	});
});

describe("settings in an older form", () => {
	const olderReduction = {
		kind: "percentile",
		params: { p: 95, avail_floor: 0.8 },
		rule: (itemSettings().reduction as { rule: unknown }).rule,
	};
	const older = (overrides: Record<string, unknown> = {}) => ({
		...itemSettings(),
		reduction: olderReduction,
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
		},
		...overrides,
	});

	it("turns a share's params.threshold into the aggregation's own rule and p into percentile", () => {
		const converted = normaliseSettings(older()) as Record<string, any>;
		expect(converted.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.9 },
			},
		});
		expect(converted.reduction.params).toEqual({
			percentile: 95,
			avail_floor: 0.8,
		});
		expect(normaliseSettings(converted)).toEqual(converted);
	});

	it("leaves alone what it does not recognise, whatever the shape", () => {
		const odd: unknown[] = [
			null,
			5,
			"text",
			[],
			{},
			{ aggregation: null, reduction: 3 },
			{ aggregation: { kind: "proportion", params: "x" } },
			{ aggregation: { kind: "worst-of", params: { threshold: 0.9 } } },
			{ reduction: { kind: "mean", params: { p: 95 } } },
			{ reduction: { kind: "percentile", params: { p: 95, percentile: 90 } } },
			{
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9 },
					rule: { kind: "threshold", direction: "maximize" },
				},
			},
		];
		for (const value of odd) {
			expect(normaliseSettings(value), JSON.stringify(value)).toBe(value);
		}
	});

	it("converts a save request before checking it, and reports a bad pass mark at its new field", () => {
		const body = (settings: unknown) => ({
			integration_id: "7acd824e-0000-4000-8000-000000000001",
			settings,
			accept: true,
		});
		const parsed = criteriaSaveRequestSchema.parse(body(older()));
		expect(parsed.settings.aggregation?.rule?.params?.pass_values).toBe(0.9);
		expect(parsed.settings.aggregation?.params).not.toHaveProperty("threshold");
		expect(parsed.settings.reduction?.params?.percentile).toBe(95);
		const refused = criteriaSaveRequestSchema.safeParse(
			body(
				older({
					aggregation: {
						kind: "proportion",
						params: { threshold: 1.5, use_verdict: true },
					},
				})
			)
		);
		expect(refused.success).toBe(false);
		expect(
			refused.error?.issues.map((issue) => issue.path.join("."))
		).toContain("settings.aggregation.rule.params.pass_values");
	});

	it("serves a stored older row in the current form with its labels unchanged, and a re-save of it moves no label", () => {
		const row = {
			settings: older(),
			ruleVersion: 2,
			reductionVersion: 3,
			aggregationVersion: 4,
			revision: 5,
			state: "ACCEPTED" as const,
		};
		const served = servedFromStored(row);
		expect(served.rule.version).toBe("r2");
		expect(served.reduction?.version).toBe("d3");
		expect(served.reduction?.params?.percentile).toBe(95);
		expect(served.aggregation?.version).toBe("a4");
		expect(served.aggregation?.rule?.version).toBe("a4");
		expect(served.aggregation?.params).not.toHaveProperty("threshold");
		const previous = {
			counters: { rule: 2, reduction: 3, aggregation: 4 },
			settings: normaliseSettings(row.settings as never),
		};
		const resaved = criteriaSaveRequestSchema.parse({
			integration_id: "7acd824e-0000-4000-8000-000000000001",
			settings: row.settings,
			accept: true,
		}).settings;
		expect(nextCounters(previous, resaved)).toEqual(previous.counters);
	});
});

const PAIR_ORDER = "must be a [low, high] pair with low not above high";
const CONTAIN = "must contain the pass_values band";
const FRACTION = "must be a number from 0 to 1";
const NOT_AVAILABLE = "is not available in evidence settings";

/** The messages the settings schema reports at one dotted path. */
function issuesAt(settings: Record<string, unknown>, path: string): string[] {
	const parsed = parse(settings);
	if (parsed.success) {
		return [];
	}
	return parsed.error.issues
		.filter((issue) => issue.path.join(".") === path)
		.map((issue) => issue.message);
}

/** A check with the given extra fields, as a pipeline would publish it. */
function customCheck(extra: Record<string, unknown>): HealthCheck {
	const found = healthCheckListSchema.parse({
		pipeline: "p",
		checks: [
			{
				name: "Probe Check",
				version: "1",
				scope: "item",
				value: { type: "boolean" },
				...extra,
			},
		],
	}).checks[0];
	if (!found) {
		throw new Error("no probe check");
	}
	return found;
}

const probeBlock = { name: "Probe Check", version: "1" };

describe("check block text", () => {
	it.each([
		"name",
		"version",
		"scope",
	])("names the %s field when it is empty", (field) => {
		const check = { ...probeBlock, scope: "item", [field]: "" };
		expect(issuesAt(itemSettings({ check }), `check.${field}`)).toContain(
			`${field} is required`
		);
	});
});

describe("rule limits", () => {
	const thresholdLimit = (
		direction: string | undefined,
		pass: unknown,
		marginal: unknown
	) =>
		issuesAt(
			itemSettings({
				rule: {
					kind: "threshold",
					...(direction && { direction }),
					params: { pass_values: pass, marginal_values: marginal },
				},
			}),
			"rule.params.marginal_values"
		);
	const above = "must lie on the failing side of pass_values (above it)";
	const below = "must lie on the failing side of pass_values (below it)";

	it.each([
		["minimize", 0.5, 0.5, [above]],
		["maximize", 0.5, 0.5, [below]],
		["minimize", 0.5, 0.2, [above]],
		["maximize", 0.5, 0.8, [below]],
		["minimize", 0.5, 1, []],
		["maximize", 0.5, 0.2, []],
		[undefined, 0.5, 1, []],
		["minimize", "5", "1", ["must be a number"]],
		["minimize", 5, "1", ["must be a number"]],
		["maximize", "0", 1, []],
	] as [
		string | undefined,
		unknown,
		unknown,
		string[],
	][])("threshold %s with pass %s and marginal %s reports %j", (direction, pass, marginal, expected) => {
		expect(thresholdLimit(direction, pass, marginal)).toEqual(expected);
	});

	it("does not judge a pass limit that is not a finite number", () => {
		const issues = blockIssues({
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: Number.POSITIVE_INFINITY, marginal_values: 5 },
			},
		});
		expect(
			issues.filter(
				(issue) => issue.path.join(".") === "rule.params.marginal_values"
			)
		).toEqual([]);
	});

	const bandLimit = (
		pass: number[],
		marginal: number[] | undefined,
		path: string
	) =>
		issuesAt(
			itemSettings({
				rule: {
					kind: "band",
					params: {
						pass_values: pass,
						...(marginal && { marginal_values: marginal }),
					},
				},
			}),
			path
		);

	it.each([
		[[3, 2], undefined, "rule.params.pass_values", [PAIR_ORDER]],
		[[2, 2], [2, 2], "rule.params.pass_values", []],
		[[2, 2], [2, 2], "rule.params.marginal_values", []],
		[[1, 2], [3, 2], "rule.params.marginal_values", [PAIR_ORDER]],
		[[1, 2], [1, 3], "rule.params.marginal_values", []],
		[[1, 2], [0, 1], "rule.params.marginal_values", [CONTAIN]],
		[[1, 2], [0, 2], "rule.params.marginal_values", []],
		[[2, 2], [3, 5], "rule.params.marginal_values", [CONTAIN]],
		[[3, 2], [4, 6], "rule.params.marginal_values", []],
		[
			[3, 2, 1],
			undefined,
			"rule.params.pass_values",
			["must be a [low, high] pair of numbers"],
		],
	] as [
		number[],
		number[] | undefined,
		string,
		string[],
	][])("band pass %j with marginal %j reports %j at %s", (pass, marginal, path, expected) => {
		expect(bandLimit(pass, marginal, path)).toEqual(expected);
	});

	it("uses a direction only on a threshold rule, and judges limits only for their own kind", () => {
		const identity = (params: Record<string, unknown>) =>
			itemSettings({
				rule: { kind: "identity", direction: "maximize", params },
			});
		const withLimits = identity({ pass_values: 0.5, marginal_values: 0.8 });
		expect(issuesAt(withLimits, "rule.direction")).toEqual([
			"is only used by a threshold rule",
		]);
		expect(issuesAt(withLimits, "rule.params.marginal_values")).toEqual([]);
		expect(
			issuesAt(identity({ pass_values: [3, 2] }), "rule.params.pass_values")
		).toEqual([]);
	});
});

describe("reduction parameters", () => {
	const reduction = (reductionBlock: Record<string, unknown>) =>
		itemSettings({ reduction: reductionBlock });

	it("leaves a p that stands alone for the older-form conversion", () => {
		expect(
			issuesAt(
				reduction({ kind: "percentile", params: { p: 90 } }),
				"reduction.params.p"
			)
		).toEqual([]);
	});

	it.each([
		[-0.1, [FRACTION]],
		[1.1, [FRACTION]],
		["0.5", [FRACTION]],
		[0, []],
		[0.5, []],
		[1, []],
	] as [
		unknown,
		string[],
	][])("availability floor %j reports %j", (floor, expected) => {
		expect(
			issuesAt(
				reduction({ kind: "last", params: { avail_floor: floor } }),
				"reduction.params.avail_floor"
			)
		).toEqual(expected);
	});

	it("accepts a band rule for the reduction and refuses an identity rule", () => {
		const withRule = (rule: unknown) =>
			issuesAt(reduction({ kind: "mean", rule }), "reduction.rule.kind");
		expect(withRule({ kind: "band", params: { pass_values: [1, 2] } })).toEqual(
			[]
		);
		expect(withRule({ kind: "identity" })).toEqual([
			"must be threshold or band",
		]);
	});
});

describe("share aggregation reports", () => {
	const noRule = { kind: "proportion", params: { use_verdict: true } };

	it.each([
		[
			shareAggregation(0.9, { use_verdict: true, threshold: 2 }),
			"params.threshold",
			[NOT_AVAILABLE],
		],
		[
			shareAggregation(0.9, { use_verdict: true, marginal_threshold: 2 }),
			"params.marginal_threshold",
			[NOT_AVAILABLE],
		],
		[noRule, "rule", ["is required"]],
		[
			shareAggregation(0.9, { use_verdict: true, avail_floor: 2 }),
			"params.avail_floor",
			[FRACTION],
		],
		[
			shareAggregation(0.9, { use_verdict: "yes" }),
			"params.use_verdict",
			["must be true or false"],
		],
		[
			shareAggregation(0.9, {}),
			"params.use_verdict",
			["is required and must be true"],
		],
		[
			{ ...noRule, rule: { kind: "threshold", params: { pass_values: 0.9 } } },
			"rule.direction",
			["is required"],
		],
	] as [
		unknown,
		string,
		string[],
	][])("aggregation %j at %s", (aggregation, path, expected) => {
		expect(
			issuesAt(itemSettings({ aggregation }), `aggregation.${path}`)
		).toEqual(expected);
	});
});

describe("durations and stored text in settings", () => {
	const lines = (blocks: Parameters<typeof timingIssues>[0]) =>
		timingIssues(blocks).map(
			(issue) => `${issue.path.join(".")}: ${issue.message}`
		);

	it("checks only the durations that are present", () => {
		expect(lines({ valid_for: "PT5M" })).toEqual([]);
		expect(lines({ window: "PT1M" })).toEqual([]);
		expect(lines({ window: "soon" })).toEqual([
			"window: is not a valid duration",
		]);
		expect(lines({ valid_for: "soon" })).toEqual([
			'valid_for: must be "indefinite" or a valid duration',
		]);
	});

	it("reports text a database cannot store at its own path", () => {
		const parsed = parse(
			itemSettings({
				check: {
					name: itemCheck.name,
					version: itemCheck.version,
					params: { camera_line: "bad\u0000text" },
				},
			})
		);
		const issue = parsed.error?.issues[0];
		expect(issue?.path.join(".")).toBe("check.params.camera_line");
	});
});

describe("request fields", () => {
	const saveBody = {
		integration_id: "7acd824e-0000-4000-8000-000000000001",
		settings: itemSettings(),
		accept: true,
	};

	it.each([
		"accept",
		"add_evidence_node",
		"update_evidence_node_text",
	])("says %s must be true or false", (field) => {
		const result = criteriaSaveRequestSchema.safeParse({
			...saveBody,
			[field]: "yes",
		});
		const issue = result.error?.issues.find(
			(item) => item.path.join(".") === field
		);
		expect(issue?.message).toBe("must be true or false");
	});

	it("accepts keep or remove for the live node and refuses anything else", () => {
		for (const choice of ["keep", "remove"]) {
			const parsed = criteriaRetirementRequestSchema.safeParse({
				reason: "no longer needed",
				evidence_node: choice,
			});
			expect(parsed.data?.evidence_node).toBe(choice);
			expect(parsed.data?.reason).toBe("no longer needed");
		}
		const refused = criteriaRetirementRequestSchema.safeParse({
			evidence_node: "delete",
		});
		const issue = refused.error?.issues[0];
		expect(issue?.path.join(".")).toBe("evidence_node");
		expect(issue?.message).toBe("must be keep or remove");
	});
});

describe("settings against a check, further", () => {
	const reductionError = (reduction: Record<string, unknown>, rule?: unknown) =>
		fieldErrorsFor(itemSettings({ reduction, ...(rule ? { rule } : {}) }))[
			"reduction.rule"
		];

	it.each([
		["sum", {}],
		["median", {}],
		["percentile", { percentile: 90 }],
	] as [
		string,
		Record<string, unknown>,
	][])("requires the reduction's own rule for a %s of several readings", (kind, params) => {
		expect(reductionError({ kind, params })).toBe(
			`is required: an identity rule cannot judge the ${kind} of several readings`
		);
	});

	it("also requires it when a membership rule meets an averaging reduction", () => {
		const errors = fieldErrorsFor(
			itemSettings({
				rule: { kind: "membership", params: { pass_values: ["a"] } },
				reduction: { kind: "mean" },
			}),
			numericCheck
		);
		expect(errors["reduction.rule"]).toBe(
			"is required: a membership rule cannot judge the mean of several readings"
		);
	});

	it("names a text check's rule kind in words", () => {
		const textCheck = customCheck({ value: { type: "string" } });
		const errors = fieldErrorsFor(
			{
				check: probeBlock,
				rule: { kind: "identity" },
				aggregation: shareAggregation(0.9),
				window: "PT1M",
				valid_for: "PT5M",
			},
			textCheck
		);
		expect(errors["rule.kind"]).toBe(
			"a text check is judged by a membership rule, not identity"
		);
	});

	it("does not fail on settings that name no rule when a recommendation is judged in part", () => {
		expect(checkListIssues({}, itemCheck, true)).toEqual([]);
	});

	it("keys an issue with no path under the settings as a whole", () => {
		expect(issuesToFieldErrors([{ path: [], message: "is bad" }])).toEqual({
			"(settings)": "is bad",
		});
	});

	const probe = customCheck({
		params: { strict: true, wait: "PT5M", label: "x" },
	});
	const paramError = (key: string, value: unknown) =>
		fieldErrorsFor(
			{
				check: { ...probeBlock, params: { [key]: value } },
				rule: { kind: "identity" },
				aggregation: shareAggregation(0.9),
				window: "PT1M",
				valid_for: "PT5M",
			},
			probe
		)[`check.params.${key}`];

	it.each([
		["strict", "yes", "must be a value of type boolean"],
		["strict", false, undefined],
		["wait", "soon", "must be a value of type duration"],
		["wait", 300, "must be a value of type duration"],
		["wait", ["PT10M"], "must be a value of type duration"],
		["wait", "PT10M", undefined],
	] as [
		string,
		unknown,
		string | undefined,
	][])("setting %s given %j reports %s", (key, value, expected) => {
		expect(paramError(key, value)).toBe(expected);
	});

	it("reports a setting of an unknown type or an enum without choices rather than failing", () => {
		const odd = {
			...itemCheck,
			params: [
				{ key: "mode", label: "Mode", type: "mystery" },
				{ key: "pick", label: "Pick", type: "enum" },
			],
		} as unknown as HealthCheck;
		const errors = issuesToFieldErrors(
			checkListIssues(
				{ check: { ...probeBlock, params: { mode: "x", pick: "a" } } },
				odd,
				true
			)
		);
		expect(errors["check.params.mode"]).toBeTypeOf("string");
		expect(errors["check.params.pick"]).toBeTypeOf("string");
	});
});

describe("where blocks came from, further", () => {
	const settingsFor = (overrides: Record<string, unknown> = {}) =>
		parsedSettings(itemSettings(overrides));
	const labels = (over: Partial<SettingsSource> = {}): SettingsSource => ({
		kind: "edited",
		check_version: "0.3",
		check_params: "recommended",
		rule: "recommended",
		reduction: "recommended",
		aggregation: "recommended",
		timing: "recommended",
		...over,
	});
	const changedRule = { kind: "identity", params: { x: 1 } };

	it("marks a block that differs from the recommendation as edited", () => {
		const source = computeSource(
			settingsFor({ rule: changedRule }),
			itemCheck,
			null
		);
		expect(source.rule).toBe("edited");
		expect(source.reduction).toBe("recommended");
	});

	it("marks a recommended block that the settings leave out as edited", () => {
		const { reduction: _reduction, ...rest } = itemSettings();
		const source = computeSource(parsedSettings(rest), itemCheck, null);
		expect(source.reduction).toBe("edited");
		expect(source.kind).toBe("edited");
	});

	it.each([[{ window: "PT1M" }], [{ valid_for: "PT5M" }]] as [
		Record<string, string>,
	][])("treats timing as edited when the check recommends only %j", (timing) => {
		const check = customCheck({
			recommended: { rule: { kind: "identity" }, ...timing },
		});
		const source = computeSource(
			settingsFor({ check: probeBlock }),
			check,
			null
		);
		expect(source.timing).toBe("edited");
	});

	it("is edited overall when some blocks follow the recommendation and others are by hand", () => {
		const check = customCheck({
			recommended: {
				rule: { kind: "identity" },
				window: "PT1M",
				valid_for: "PT5M",
			},
		});
		const source = computeSource(
			settingsFor({ check: probeBlock }),
			check,
			null
		);
		expect(source.reduction).toBe("hand");
		expect(source.rule).toBe("recommended");
		expect(source.kind).toBe("edited");
	});

	it("leaves out check settings that are empty or absent when the check names none", () => {
		const check = customCheck({
			recommended: { rule: { kind: "identity" } },
		});
		for (const params of [undefined, {}]) {
			const source = computeSource(
				settingsFor({ check: { ...probeBlock, params } }),
				check,
				null
			);
			expect(source).not.toHaveProperty("check_params");
		}
	});

	it("calls every block by hand when there is neither a check nor a previous save", () => {
		expect(computeSource(settingsFor(), null, null)).toEqual(
			labels({
				kind: "hand",
				check_params: "hand",
				rule: "hand",
				reduction: "hand",
				aggregation: "hand",
				timing: "hand",
			})
		);
	});

	it("keeps the earlier label of a block that has not changed since the previous save", () => {
		const previous = {
			settings: settingsFor(),
			source: labels({ rule: "edited", aggregation: "hand" }),
		};
		expect(computeSource(settingsFor(), null, previous)).toMatchObject({
			rule: "edited",
			reduction: "recommended",
			aggregation: "hand",
			timing: "recommended",
		});
	});

	it.each([
		["recommended", "edited"],
		["edited", "edited"],
		["hand", "hand"],
	] as const)("labels a changed block that was %s as %s", (earlier, expected) => {
		const previous = {
			settings: settingsFor(),
			source: labels({ rule: earlier }),
		};
		const source = computeSource(
			settingsFor({ rule: changedRule }),
			null,
			previous
		);
		expect(source.rule).toBe(expected);
	});

	it("leaves out a block the new save no longer has", () => {
		const { reduction: _reduction, ...rest } = itemSettings();
		const previous = { settings: settingsFor(), source: labels() };
		const source = computeSource(parsedSettings(rest), null, previous);
		expect(source).not.toHaveProperty("reduction");
	});

	it("falls back to by hand for a block the previous label did not record", () => {
		// A stored label from an older save can lack the rule and timing keys.
		const previous = {
			settings: settingsFor(),
			source: {
				kind: "edited",
				check_version: "0.3",
			} as unknown as SettingsSource,
		};
		const source = computeSource(settingsFor(), null, previous);
		expect(source.rule).toBe("hand");
		expect(source.timing).toBe("hand");
	});
});

describe("type surface", () => {
	it("keeps the settings type free of version labels", () => {
		const settings: HealthCriteriaSettings = parsedSettings(itemSettings());
		expect(settings.rule).not.toHaveProperty("version");
	});
});
