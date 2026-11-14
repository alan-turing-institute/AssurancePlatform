import { describe, expect, it } from "vitest";
import {
	buildHealthRecords,
	withOverrides,
} from "../../../src/__tests__/fixtures/health-records";
import { healthEvidenceRecordSchema } from "../health-evidence";

const CLAIM_ID = "00000000-0000-4000-8000-000000000001";

type Json = Record<string, any>;

const base = () => buildHealthRecords(CLAIM_ID).populationPass;

const rule = (extra: Json = {}): Json => ({
	kind: "threshold",
	direction: "maximize",
	params: { pass_values: 0.95 },
	version: "a1",
	...extra,
});

const recordWith = (aggregation: Json) =>
	withOverrides(base(), { aggregation });

function issuePaths(record: unknown): string[] {
	const result = healthEvidenceRecordSchema.safeParse(record);
	return result.success
		? []
		: result.error.issues.map((issue) => issue.path.join("."));
}

describe("a record's combining step", () => {
	it("keeps its own rule exactly as reported", () => {
		const aggregation = {
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: rule({ params: { pass_values: 0.95, marginal_values: 0.9 } }),
			version: "a1",
		};
		const parsed = healthEvidenceRecordSchema.parse(recordWith(aggregation));
		expect(parsed.aggregation).toEqual(aggregation);
	});

	it("still accepts a share that gives its pass mark in params.threshold", () => {
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { threshold: 0.95, use_verdict: true },
					version: "a1",
				})
			)
		).toEqual([]);
	});

	it("accepts a share that gives both", () => {
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { threshold: 0.5, use_verdict: true },
					rule: rule(),
					version: "a1",
				})
			)
		).toEqual([]);
	});

	it("refuses a share with neither a rule nor a pass mark, on the rule", () => {
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { use_verdict: true },
					version: "a1",
				})
			)
		).toEqual(["aggregation.rule"]);
	});

	it("refuses a pass mark in params outside 0 to 1 even when a rule is present", () => {
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { threshold: 1.5, use_verdict: true },
					rule: rule(),
					version: "a1",
				})
			)
		).toEqual(["aggregation.params.threshold"]);
	});

	it("refuses a rule without its version label", () => {
		const { version: _dropped, ...unlabelled } = rule();
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { use_verdict: true },
					rule: unlabelled,
					version: "a1",
				})
			)
		).toEqual(["aggregation.rule.version"]);
	});

	it("refuses a rule that lacks what its kind needs, on that field", () => {
		expect(
			issuePaths(
				recordWith({
					kind: "proportion",
					params: { use_verdict: true },
					rule: {
						kind: "threshold",
						params: { pass_values: 0.9 },
						version: "a1",
					},
					version: "a1",
				})
			)
		).toEqual(["aggregation.rule.direction"]);
	});

	it("refuses a __proto__ key in the rule's params instead of dropping it", () => {
		const record = JSON.parse(
			JSON.stringify(
				recordWith({
					kind: "proportion",
					params: { use_verdict: true },
					rule: rule(),
					version: "a1",
				})
			).replace('"pass_values":0.95', '"pass_values":0.95,"__proto__":{"x":1}')
		);
		expect(issuePaths(record).length).toBeGreaterThan(0);
	});

	it.each([
		"worst-of",
		"percentile",
	])("accepts a %s step with a rule that judges the combined result", (kind) => {
		expect(
			issuePaths(
				recordWith({
					kind,
					params: kind === "percentile" ? { percentile: 95 } : {},
					rule: rule({ direction: "minimize" }),
					version: "a1",
				})
			)
		).toEqual([]);
	});

	it.each([
		-1,
		101,
		"95",
		null,
	])("refuses a percentile step whose percentile is %j", (percentile) => {
		expect(
			issuePaths(
				recordWith({
					kind: "percentile",
					params: { percentile },
					version: "a1",
				})
			)
		).toEqual(["aggregation.params.percentile"]);
	});
});

describe("a record's reduction", () => {
	const reduction = (params: Json): Json => ({
		kind: "percentile",
		params,
		version: "d1",
	});

	it.each([
		["percentile", { percentile: 90 }],
		["p", { p: 90 }],
		["both", { percentile: 90, p: 50 }],
		["neither", {}],
	])("accepts a percentile given as %s", (_name, params) => {
		expect(
			issuePaths(withOverrides(base(), { reduction: reduction(params) }))
		).toEqual([]);
	});

	it("keeps the percentile as reported", () => {
		const parsed = healthEvidenceRecordSchema.parse(
			withOverrides(base(), {
				reduction: reduction({ percentile: 90, avail_floor: 0.8 }),
			})
		);
		expect(parsed.reduction?.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
	});
});
