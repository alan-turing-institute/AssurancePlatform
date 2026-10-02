import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	buildHealthRecords,
	type HealthRecordFixture,
	withOverrides,
} from "@/src/__tests__/fixtures/health-records";
import {
	boundCheckRequestSchema,
	describeEvidenceIssues,
	healthEvidenceRecordSchema,
	revocationRequestSchema,
} from "../health-evidence";

const CLAIM_ID = randomUUID();
const records = buildHealthRecords(CLAIM_ID);

function parse(record: HealthRecordFixture) {
	return healthEvidenceRecordSchema.safeParse(record);
}

describe("healthEvidenceRecordSchema — accepted records", () => {
	it.each(
		Object.entries(records)
	)("accepts the %s fixture and stores it as received", (_name, record) => {
		const result = parse(record);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(record);
		}
	});

	it("stores a null value as absent", () => {
		const result = parse(withOverrides(records.indeterminate, { value: null }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect("value" in result.data).toBe(false);
		}
	});

	it("re-serialises the timestamp from the parsed date", () => {
		const result = parse(
			withOverrides(records.populationPass, {
				timestamp: "2026-01-01T00:00:00Z",
			})
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.timestamp).toBe("2026-01-01T00:00:00.000Z");
		}
	});

	it("keeps provenance keys beyond the recognised ones", () => {
		const record = withOverrides(records.populationPass, {
			provenance: {
				...(records.populationPass.provenance as object),
				custom_key: "kept",
			},
		});
		const result = parse(record);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.provenance.custom_key).toBe("kept");
		}
	});

	it("accepts a summary of 5,000 members", () => {
		const record = withOverrides(records.populationPass, {
			provenance: {
				...(records.populationPass.provenance as object),
				members: Array.from({ length: 5000 }, () => randomUUID()),
			},
		});
		expect(parse(record).success).toBe(true);
	});
});

describe("healthEvidenceRecordSchema — refused records", () => {
	const futureTimestamp = new Date(Date.now() + 10 * 60_000).toISOString();
	const provenance = records.populationPass.provenance as Record<
		string,
		unknown
	>;

	const refused: [string, HealthRecordFixture, string][] = [
		[
			"an unknown top-level field",
			withOverrides(records.populationPass, { record_hash: "x" }),
			"record_hash",
		],
		[
			"format_version other than 1.1",
			withOverrides(records.populationPass, { format_version: "0.1" }),
			"format_version",
		],
		[
			"no valid_for",
			withOverrides(records.populationPass, { valid_for: undefined }),
			"valid_for",
		],
		[
			"no value on a record that is not indeterminate",
			withOverrides(records.populationPass, { value: undefined }),
			"value",
		],
		[
			"an indeterminate record with no comment",
			withOverrides(records.indeterminate, { comment: undefined }),
			"comment",
		],
		[
			"a summary without members",
			withOverrides(records.populationPass, {
				provenance: { ...provenance, members: undefined },
			}),
			"provenance.members",
		],
		[
			"a summary with a subject",
			withOverrides(records.populationPass, {
				subject: { kind: "sensor", id: "S-1" },
			}),
			"subject",
		],
		[
			"a valid_while key missing from provenance",
			withOverrides(records.singleSubject, {
				valid_while: { not_in_provenance: "x" },
			}),
			"valid_while.not_in_provenance",
		],
		[
			"uncertainty without judged",
			withOverrides(records.singleSubject, { judged: undefined }),
			"judged",
		],
		[
			"a reduction kind outside the list",
			withOverrides(records.populationPass, {
				reduction: { kind: "mode", version: "d1" },
			}),
			"reduction.kind",
		],
		[
			"an aggregation kind outside the list",
			withOverrides(records.populationPass, {
				aggregation: { kind: "average", params: {}, version: "a1" },
			}),
			"aggregation.kind",
		],
		[
			"a rule missing the keys its kind needs",
			withOverrides(records.populationPass, {
				rule: { kind: "threshold", version: "r1" },
			}),
			"rule",
		],
		[
			"a window in months",
			withOverrides(records.populationPass, { window: "P1M" }),
			"window",
		],
		[
			"a valid_for in years",
			withOverrides(records.populationPass, { valid_for: "P1Y" }),
			"valid_for",
		],
		[
			"a timestamp more than five minutes ahead",
			withOverrides(records.populationPass, { timestamp: futureTimestamp }),
			"timestamp",
		],
		[
			"a summary whose uncertainty is predictive",
			withOverrides(records.populationPass, {
				uncertainty: {
					kind: "std",
					params: { std: 0.1 },
					method: "bootstrap",
					nature: "predictive",
				},
				judged: { statistic: "mean", method: "bootstrap", value: 1 },
			}),
			"uncertainty.nature",
		],
	];

	it.each(refused)("refuses %s, naming the field", (_label, record, field) => {
		const result = parse(record);
		expect(result.success).toBe(false);
		if (!result.success) {
			const { message, fieldErrors } = describeEvidenceIssues(result.error);
			expect(message).toContain(field);
			expect(Object.keys(fieldErrors).join(" ")).toContain(field);
		}
	});

	it("accepts a timestamp within the five-minute allowance", () => {
		const nearFuture = new Date(Date.now() + 2 * 60_000).toISOString();
		expect(
			parse(withOverrides(records.populationPass, { timestamp: nearFuture }))
				.success
		).toBe(true);
	});

	it("refuses a valid_while whose provenance value is not a string", () => {
		const record = withOverrides(records.singleSubject, {
			provenance: {
				...(records.singleSubject.provenance as object),
				twin_version: 2.3,
			},
		});
		expect(parse(record).success).toBe(false);
	});

	it("refuses more than 5,000 members", () => {
		const record = withOverrides(records.populationPass, {
			provenance: {
				...provenance,
				members: Array.from({ length: 5001 }, () => randomUUID()),
			},
		});
		expect(parse(record).success).toBe(false);
	});
});

describe("healthEvidenceRecordSchema — uncertainty", () => {
	const withUncertainty = (kind: string, params: Record<string, unknown>) =>
		withOverrides(records.singleSubject, {
			uncertainty: { kind, params, method: "bootstrap", nature: "predictive" },
		});

	it.each([
		["interval", { lower: 1, upper: 2 }],
		["std", { std: 0.2 }],
		["quantiles", { q: { "0.05": 1, "0.95": 3 } }],
		["probability", { p: 0.3 }],
	])("accepts a %s uncertainty with its parameters", (kind, params) => {
		expect(parse(withUncertainty(kind, params)).success).toBe(true);
	});

	it.each([
		["interval", { lower: 1 }],
		["std", { std: -1 }],
		["quantiles", { q: {} }],
		["quantiles", { q: { "0.5": "high" } }],
		["probability", { p: 1.5 }],
		["median", { m: 1 }],
	])("refuses a %s uncertainty with parameters %j", (kind, params) => {
		expect(parse(withUncertainty(kind, params)).success).toBe(false);
	});
});

describe("requests from a signed-in person", () => {
	it("requires a known cause and a reason for a revocation", () => {
		expect(
			revocationRequestSchema.safeParse({
				cause: "evidence-defect",
				reason: "Wrong run",
			}).success
		).toBe(true);
		expect(
			revocationRequestSchema.safeParse({ cause: "evidence-defect" }).success
		).toBe(false);
		expect(
			revocationRequestSchema.safeParse({ cause: "bored", reason: "x" }).success
		).toBe(false);
		expect(
			revocationRequestSchema.safeParse({ cause: "other", reason: "   " })
				.success
		).toBe(false);
	});

	it("requires a name and a reason to change the bound check", () => {
		expect(
			boundCheckRequestSchema.safeParse({
				name: "Other Check",
				reason: "Renamed",
			}).success
		).toBe(true);
		expect(boundCheckRequestSchema.safeParse({ name: "Other" }).success).toBe(
			false
		);
	});
});
