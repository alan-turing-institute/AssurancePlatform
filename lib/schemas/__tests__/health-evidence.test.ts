import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	buildHealthRecords,
	type HealthRecordFixture,
	withOverrides,
} from "@/src/__tests__/fixtures/health-records";
import {
	boundCheckRequestSchema,
	describeEvidenceIssues,
	evidenceListQuerySchema,
	healthEvidenceRecordSchema,
	reinstatementRequestSchema,
	revocationRequestSchema,
} from "../health-evidence";

const CLAIM_ID = randomUUID();
const records = buildHealthRecords(CLAIM_ID);

function parse(record: HealthRecordFixture) {
	return healthEvidenceRecordSchema.safeParse(record);
}

function firstIssuePath(record: HealthRecordFixture): string | undefined {
	const result = parse(record);
	return result.success
		? undefined
		: Object.keys(describeEvidenceIssues(result.error).fieldErrors)[0];
}

describe("healthEvidenceRecordSchema — strings Postgres cannot store", () => {
	it.each([
		["a NUL in a comment", { comment: "a\u0000b" }, "comment"],
		["a lone surrogate in a comment", { comment: "a\ud800b" }, "comment"],
		[
			"a NUL in a nested provenance value",
			{
				provenance: {
					...(records.populationPass.provenance as Record<string, unknown>),
					extra: { deep: ["ok", "x\u0000"] },
				},
			},
			"provenance.extra.deep.1",
		],
		[
			"a NUL in a provenance key",
			{
				provenance: {
					...(records.populationPass.provenance as Record<string, unknown>),
					"bad\u0000key": "x",
				},
			},
			"provenance.bad\u0000key",
		],
		[
			"a lone low surrogate in a payload key",
			{ payload: { "k\udc00": 1 } },
			"payload.k\udc00",
		],
	])("refuses %s, naming the path", (_name, overrides, path) => {
		expect(
			firstIssuePath(withOverrides(records.populationPass, overrides))
		).toBe(path);
	});

	it("accepts a well-formed surrogate pair", () => {
		expect(
			parse(withOverrides(records.populationPass, { comment: "ok \u{1F600}" }))
				.success
		).toBe(true);
	});

	it("refuses a NUL in the reason and name of a session request", () => {
		expect(
			revocationRequestSchema.safeParse({ cause: "other", reason: "a\u0000" })
				.success
		).toBe(false);
		expect(
			boundCheckRequestSchema.safeParse({ name: "a\ud800", reason: "r" })
				.success
		).toBe(false);
	});
});

describe("healthEvidenceRecordSchema — identifiers and check text", () => {
	it("stores record_id and claim_ref in lower case", () => {
		const result = parse(
			withOverrides(records.populationPass, {
				record_id: String(records.populationPass.record_id).toUpperCase(),
				claim_ref: CLAIM_ID.toUpperCase(),
			})
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.record_id).toBe(records.populationPass.record_id);
			expect(result.data.claim_ref).toBe(CLAIM_ID);
		}
	});

	it.each([
		"name",
		"version",
		"scope",
	])("refuses a check %s with edge whitespace, naming the field", (field) => {
		const check = {
			...(records.populationPass.check as Record<string, unknown>),
			[field]: " padded ",
		};
		expect(
			firstIssuePath(withOverrides(records.populationPass, { check }))
		).toBe(`check.${field}`);
	});
});

describe("healthEvidenceRecordSchema — durations", () => {
	it.each([
		"window",
		"valid_for",
	])("refuses an absurd %s, naming the field", (field) => {
		expect(
			firstIssuePath(
				withOverrides(records.populationPass, { [field]: "P99999999W" })
			)
		).toBe(field);
	});
});

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

// ---------------------------------------------------------------------------
// Messages, limits and stored shape of a record
// ---------------------------------------------------------------------------

const pop = records.populationPass;
const single = records.singleSubject;
const whole = records.wholeSystem;
const indeterminateRecord = records.indeterminate;

const UNSTORABLE = "must not contain a NUL character or an unpaired surrogate";
const FIELDS = ["name", "version", "scope"] as const;

function asObject(value: unknown): Record<string, unknown> {
	return value as Record<string, unknown>;
}

/** `record` with `patch` merged into its object field `key`. */
function withNested(
	record: HealthRecordFixture,
	key: string,
	patch: Record<string, unknown>
): HealthRecordFixture {
	return withOverrides(record, {
		[key]: { ...asObject(record[key]), ...patch },
	});
}

function fieldMessages(record: HealthRecordFixture): Record<string, string> {
	const result = parse(record);
	return result.success ? {} : describeEvidenceIssues(result.error).fieldErrors;
}

function issueCodes(record: HealthRecordFixture): string[] {
	const result = parse(record);
	return result.success ? [] : result.error.issues.map((issue) => issue.code);
}

function requestMessage(
	schema: z.ZodType,
	input: unknown,
	path: string
): string | undefined {
	const result = schema.safeParse(input);
	return result.success
		? undefined
		: result.error.issues.find((issue) => issue.path.join(".") === path)
				?.message;
}

const repeat = (length: number) => "a".repeat(length);

/** Strings that fill `count` extra provenance keys. */
function extraKeys(count: number, prefix = "extra"): Record<string, string> {
	return Object.fromEntries(
		Array.from({ length: count }, (_, i) => [`${prefix}${i}`, "v"])
	);
}

const nestedArrays = (levels: number): unknown =>
	Array.from({ length: levels }).reduce<unknown>((inner) => [inner], "x");

const checkFieldCases: [string, HealthRecordFixture, string, string][] =
	FIELDS.flatMap((field) => [
		[
			`an empty check ${field}`,
			withNested(pop, "check", { [field]: "" }),
			`check.${field}`,
			`${field} is required`,
		],
		[
			`a check ${field} with edge whitespace`,
			withNested(pop, "check", { [field]: "x " }),
			`check.${field}`,
			`${field} must not start or end with whitespace`,
		],
	]);

const namedFieldCases: [string, HealthRecordFixture, string, string][] = [
	...checkFieldCases,
	[
		"a check name over 200 characters",
		withNested(pop, "check", { name: repeat(201) }),
		"check.name",
		"name must be at most 200 characters",
	],
	[
		"an empty subject kind",
		withNested(single, "subject", { kind: "" }),
		"subject.kind",
		"kind is required",
	],
	[
		"an empty subject id",
		withNested(single, "subject", { id: "" }),
		"subject.id",
		"id is required",
	],
	[
		"an empty failed subject kind",
		withNested(pop, "provenance", {
			failed_subjects: [{ kind: "", id: "x" }],
		}),
		"provenance.failed_subjects.0.kind",
		"kind is required",
	],
	[
		"an empty failed subject id",
		withNested(pop, "provenance", {
			failed_subjects: [{ kind: "x", id: "" }],
		}),
		"provenance.failed_subjects.0.id",
		"id is required",
	],
	[
		"an empty judged statistic",
		withNested(single, "judged", { statistic: "" }),
		"judged.statistic",
		"statistic is required",
	],
	[
		"an empty judged method",
		withNested(single, "judged", { method: "" }),
		"judged.method",
		"method is required",
	],
	[
		"an empty uncertainty method",
		withNested(single, "uncertainty", { method: "" }),
		"uncertainty.method",
		"method is required",
	],
	[
		"an empty session",
		withNested(pop, "provenance", { session: "" }),
		"provenance.session",
		"session is required",
	],
	[
		"an empty pipeline_version",
		withNested(pop, "provenance", { pipeline_version: "" }),
		"provenance.pipeline_version",
		"pipeline_version is required",
	],
];

describe("healthEvidenceRecordSchema — messages for text fields", () => {
	it.each(namedFieldCases)("reports %s", (_label, record, path, message) => {
		expect(fieldMessages(record)[path]).toBe(message);
	});
});

const tooManyEntries = "must have at most 5000 entries";

const valueMessageCases: [string, HealthRecordFixture, string, string][] = [
	[
		"a value that is no accepted shape",
		withOverrides(pop, { value: {} }),
		"value",
		"must be a boolean, a string, {number, unit} or null",
	],
	[
		"a verdict outside the list",
		withOverrides(pop, { verdict: "great" }),
		"verdict",
		"must be one of pass, marginal, fail, indeterminate",
	],
	[
		"a format_version other than 1.1",
		withOverrides(pop, { format_version: "0.1" }),
		"format_version",
		'must be "1.1"',
	],
	[
		"a timestamp that is not a date",
		withOverrides(pop, { timestamp: "tomorrow" }),
		"timestamp",
		"must be an ISO 8601 UTC timestamp",
	],
	[
		"a timestamp ten minutes ahead",
		withOverrides(pop, {
			timestamp: new Date(Date.now() + 10 * 60_000).toISOString(),
		}),
		"timestamp",
		"must not be more than five minutes ahead of the server clock",
	],
	[
		"a comment over 2000 characters",
		withOverrides(pop, { comment: repeat(2001) }),
		"comment",
		"must be at most 2000 characters",
	],
	[
		"a comment with a NUL",
		withOverrides(pop, { comment: "a\u0000" }),
		"comment",
		UNSTORABLE,
	],
	[
		"a provenance key with a NUL",
		withNested(pop, "provenance", { "a\u0000": "x" }),
		"provenance.a\u0000",
		`key ${UNSTORABLE}`,
	],
	[
		"more than 5,000 members",
		withNested(pop, "provenance", {
			members: Array.from({ length: 5001 }, () => randomUUID()),
		}),
		"provenance.members",
		tooManyEntries,
	],
	[
		"more than 5,000 failed subjects",
		withNested(pop, "provenance", {
			failed_subjects: Array.from({ length: 5001 }, () => ({
				kind: "k",
				id: "i",
			})),
		}),
		"provenance.failed_subjects",
		tooManyEntries,
	],
	[
		"more than 40 provenance keys",
		withNested(whole, "provenance", extraKeys(36)),
		"provenance",
		"must have at most 40 keys",
	],
	[
		"a payload over 16 KiB",
		withOverrides(pop, { payload: { k: repeat(16 * 1024 - 7) } }),
		"payload",
		"must serialize to at most 16384 bytes",
	],
	[
		"a valid_while with more than 20 keys",
		withNested(
			withOverrides(single, { valid_while: extraKeys(21) }),
			"provenance",
			extraKeys(21)
		),
		"valid_while",
		"must have at most 20 keys",
	],
	[
		"a valid_while value that is not text",
		withOverrides(single, { valid_while: { twin_version: 5 } }),
		"valid_while.twin_version",
		"must be a string",
	],
];

describe("healthEvidenceRecordSchema — messages for values, time and size", () => {
	it.each(valueMessageCases)("reports %s", (_label, record, path, message) => {
		expect(fieldMessages(record)[path]).toBe(message);
	});

	it("counts a record's 40 provenance keys, a 16 KiB payload and 20 valid_while keys as within the limits", () => {
		expect(parse(withNested(whole, "provenance", extraKeys(35))).success).toBe(
			true
		);
		expect(
			parse(withOverrides(pop, { payload: { k: repeat(16 * 1024 - 8) } }))
				.success
		).toBe(true);
		expect(
			parse(
				withNested(
					withOverrides(single, { valid_while: extraKeys(20) }),
					"provenance",
					extraKeys(20)
				)
			).success
		).toBe(true);
	});

	it("accepts a payload key of 200 characters and refuses 201", () => {
		const payload = (length: number) =>
			withOverrides(pop, { payload: { [repeat(length)]: 1 } });
		expect(parse(payload(200)).success).toBe(true);
		expect(parse(payload(201)).success).toBe(false);
	});

	it("accepts text of 500 characters in a value and a judged value and refuses 501", () => {
		const valued = (length: number) =>
			withOverrides(pop, { value: repeat(length) });
		const judged = (length: number) =>
			withNested(single, "judged", { value: repeat(length) });
		expect(parse(valued(500)).success).toBe(true);
		expect(parse(valued(501)).success).toBe(false);
		expect(parse(judged(500)).success).toBe(true);
		expect(parse(judged(501)).success).toBe(false);
	});

	it("accepts a comment of 2000 characters and a name of 200", () => {
		expect(parse(withOverrides(pop, { comment: repeat(2000) })).success).toBe(
			true
		);
		expect(parse(withNested(pop, "check", { name: repeat(200) })).success).toBe(
			true
		);
	});

	it("accepts provenance values nested three arrays deep and refuses four", () => {
		const nested = (levels: number) =>
			withNested(pop, "provenance", { deep: nestedArrays(levels) });
		expect(parse(nested(3)).success).toBe(true);
		expect(parse(nested(4)).success).toBe(false);
	});

	it("reports a custom issue for text a database cannot store", () => {
		expect(issueCodes(withOverrides(pop, { comment: "a\u0000" }))).toEqual([
			"custom",
		]);
		expect(
			issueCodes(withNested(pop, "provenance", { "a\u0000": "x" }))
		).toEqual(["custom"]);
	});

	it("reports an unstorable string inside a list with the position as a number", () => {
		const result = parse(
			withNested(pop, "provenance", { deep: ["ok", "x\u0000"] })
		);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["provenance", "deep", 1]);
		}
	});
});

describe("healthEvidenceRecordSchema — the five-minute allowance", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("accepts a timestamp exactly five minutes ahead and refuses one a millisecond later", () => {
		const at = (offsetMs: number) =>
			withOverrides(pop, {
				timestamp: new Date(Date.now() + offsetMs).toISOString(),
			});
		expect(parse(at(300_000)).success).toBe(true);
		expect(parse(at(300_001)).success).toBe(false);
	});
});

const uncertaintyCases: [string, string, Record<string, unknown>][] = [
	["interval", "interval", { lower: 1 }],
	["interval", "interval", { lower: "1", upper: 2 }],
	["std", "std", { std: -1 }],
	["std", "std", { std: "0.2" }],
	["quantiles", "quantiles", { q: null }],
	["quantiles", "quantiles", { q: [1] }],
	["quantiles", "quantiles", { q: {} }],
	["quantiles", "quantiles", { q: { "0.5": 1, "0.9": "x" } }],
	["probability", "probability", { p: "0.5" }],
	["probability", "probability", { p: -0.1 }],
	["probability", "probability", { p: 1.1 }],
	["probability", "probability", {}],
];

const uncertaintyMessages: Record<string, string> = {
	interval: "must carry numeric lower and upper for an interval",
	std: "must carry a non-negative numeric std",
	quantiles: "must carry q, an object of numeric quantiles",
	probability: "must carry p, a number from 0 to 1",
};

describe("healthEvidenceRecordSchema — uncertainty messages and limits", () => {
	const withKind = (kind: string, params: Record<string, unknown>) =>
		withNested(single, "uncertainty", { kind, params });

	it.each(
		uncertaintyCases
	)("reports what a %s uncertainty needs for parameters %j", (kind, _k, params) => {
		expect(fieldMessages(withKind(kind, params))["uncertainty.params"]).toBe(
			uncertaintyMessages[kind]
		);
		expect(issueCodes(withKind(kind, params))).toEqual(["custom"]);
	});

	it.each([
		["probability", { p: 0 }],
		["probability", { p: 1 }],
		["quantiles", { q: { "0.1": 0, "0.9": 5 } }],
	])("accepts a %s uncertainty with parameters %j", (kind, params) => {
		expect(parse(withKind(kind, params)).success).toBe(true);
	});

	it("refuses a parameter that is not a finite number", () => {
		expect(
			parse(withKind("interval", { lower: Number.POSITIVE_INFINITY, upper: 2 }))
				.success
		).toBe(false);
	});

	it.each([
		["kind", "median", "must be one of interval, std, quantiles, probability"],
		["level", 0, "must be greater than 0"],
		["level", 1.5, "must be at most 1"],
		["nature", "other", "must be predictive or sampling"],
	])("reports an uncertainty %s of %j", (field, value, message) => {
		expect(
			fieldMessages(withNested(single, "uncertainty", { [field]: value }))[
				`uncertainty.${field}`
			]
		).toBe(message);
	});

	it.each([
		["level", 1],
		["level", 0.5],
		["nature", "sampling"],
	])("accepts an uncertainty %s of %j", (field, value) => {
		expect(
			parse(withNested(single, "uncertainty", { [field]: value })).success
		).toBe(true);
	});
});

describe("healthEvidenceRecordSchema — consistency messages", () => {
	const summaryUncertainty = (nature: string) =>
		withOverrides(pop, {
			uncertainty: {
				kind: "std",
				params: { std: 0.1 },
				method: "bootstrap",
				nature,
			},
			judged: { statistic: "mean", method: "bootstrap", value: 1 },
		});

	const cases: [string, HealthRecordFixture, string, string][] = [
		[
			"a summary with no members",
			withNested(pop, "provenance", { members: [] }),
			"provenance.members",
			"is required and must not be empty on a summary (a record with an aggregation)",
		],
		[
			"a summary with a subject",
			withOverrides(pop, { subject: { kind: "sensor", id: "S-1" } }),
			"subject",
			"is not accepted on a summary (a record with an aggregation)",
		],
		[
			"a summary whose uncertainty is predictive",
			summaryUncertainty("predictive"),
			"uncertainty.nature",
			"must be sampling on a summary",
		],
		[
			"a valid_while key missing from provenance",
			withOverrides(single, { valid_while: { absent: "x" } }),
			"valid_while.absent",
			"must name a key present in provenance",
		],
		[
			"a valid_while key whose provenance value is not text",
			withOverrides(withNested(single, "provenance", { gauge: 5 }), {
				valid_while: { gauge: "x" },
			}),
			"valid_while.gauge",
			"must name a provenance key whose value is a string",
		],
		[
			"a null value on a verdict that is not indeterminate",
			withOverrides(pop, { value: null }),
			"value",
			"is required unless the verdict is indeterminate",
		],
		[
			"an indeterminate verdict with a blank comment",
			withOverrides(indeterminateRecord, { comment: "   " }),
			"comment",
			"is required when the verdict is indeterminate",
		],
		[
			"uncertainty without judged",
			withOverrides(single, { judged: undefined }),
			"judged",
			"is required when uncertainty is present",
		],
	];

	it.each(cases)("reports %s", (_label, record, path, message) => {
		expect(fieldMessages(record)[path]).toBe(message);
		expect(issueCodes(record)).toEqual(["custom"]);
	});

	it("accepts a summary whose uncertainty is sampling", () => {
		expect(parse(summaryUncertainty("sampling")).success).toBe(true);
	});

	it("leaves out the value of a record that has none", () => {
		const result = parse(
			withOverrides(indeterminateRecord, { value: undefined })
		);
		expect(result.success).toBe(true);
		if (result.success) {
			expect("value" in result.data).toBe(false);
		}
	});
});

describe("describeEvidenceIssues", () => {
	it("names an unknown field at the top and nested, as not recognised", () => {
		const fields = fieldMessages(
			withNested(withOverrides(pop, { record_hash: "x" }), "check", {
				colour: "red",
			})
		);
		expect(fields.record_hash).toBe("is not a recognised field");
		expect(fields["check.colour"]).toBe("is not a recognised field");
	});

	it("names the whole record when the problem is not in a field", () => {
		const result = healthEvidenceRecordSchema.safeParse("text");
		expect(result.success).toBe(false);
		if (!result.success) {
			const { message, fieldErrors } = describeEvidenceIssues(result.error);
			expect(Object.keys(fieldErrors)).toEqual(["(record)"]);
			expect(message.startsWith("(record): ")).toBe(true);
		}
	});

	it("falls back to a general message when an error carries no issues", () => {
		const described = describeEvidenceIssues(new z.ZodError([]));
		expect(described).toEqual({
			message: "(record): Invalid record",
			fieldErrors: {},
		});
	});
});

describe("requests from a signed-in person — messages", () => {
	const requestCases: [string, z.ZodType, unknown, string, string][] = [
		[
			"a reason with a NUL",
			revocationRequestSchema,
			{ cause: "other", reason: "a\u0000" },
			"reason",
			UNSTORABLE,
		],
		[
			"an empty reason",
			revocationRequestSchema,
			{ cause: "other", reason: "" },
			"reason",
			"reason is required",
		],
		[
			"a reason over 2000 characters",
			revocationRequestSchema,
			{ cause: "other", reason: repeat(2001) },
			"reason",
			"reason must be at most 2000 characters",
		],
		[
			"an unknown cause",
			revocationRequestSchema,
			{ cause: "bored", reason: "x" },
			"cause",
			"cause must be one of evidence-defect, binding-defect, duplicate, superseded, other",
		],
		[
			"a name with a NUL",
			boundCheckRequestSchema,
			{ name: "a\u0000", reason: "x" },
			"name",
			UNSTORABLE,
		],
		[
			"an empty name",
			boundCheckRequestSchema,
			{ name: "  ", reason: "x" },
			"name",
			"name is required",
		],
		[
			"a name over 200 characters",
			boundCheckRequestSchema,
			{ name: repeat(201), reason: "x" },
			"name",
			"name must be at most 200 characters",
		],
	];

	it.each(
		requestCases
	)("reports %s", (_label, schema, input, path, message) => {
		expect(requestMessage(schema, input, path)).toBe(message);
	});

	it("trims the bound check's name", () => {
		const result = boundCheckRequestSchema.safeParse({
			name: "  Other Check ",
			reason: "x",
		});
		expect(result.success && result.data.name).toBe("Other Check");
	});

	it("requires a reason to reinstate and refuses other fields", () => {
		expect(reinstatementRequestSchema.safeParse({ reason: "ok" }).success).toBe(
			true
		);
		expect(reinstatementRequestSchema.safeParse({}).success).toBe(false);
		expect(reinstatementRequestSchema.safeParse({ reason: " " }).success).toBe(
			false
		);
		expect(
			reinstatementRequestSchema.safeParse({ reason: "ok", extra: 1 }).success
		).toBe(false);
	});
});

describe("evidenceListQuerySchema", () => {
	it("turns text parameters into numbers", () => {
		const result = evidenceListQuerySchema.safeParse({
			limit: "5",
			before: "9",
			live: "true",
		});
		expect(result.success && result.data).toEqual({
			limit: 5,
			before: 9,
			live: "true",
		});
	});

	it.each([
		[{ limit: "1" }],
		[{ limit: "200" }],
		[{ before: "1" }],
		[{ live: "false" }],
		[{}],
	])("accepts %j", (query) => {
		expect(evidenceListQuerySchema.safeParse(query).success).toBe(true);
	});

	it.each([
		[{ limit: "0" }],
		[{ limit: "201" }],
		[{ limit: "1.5" }],
		[{ before: "0" }],
		[{ live: "yes" }],
		[{ page: "2" }],
	])("refuses %j", (query) => {
		expect(evidenceListQuerySchema.safeParse(query).success).toBe(false);
	});
});
