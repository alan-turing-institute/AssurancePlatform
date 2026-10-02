import { randomUUID } from "node:crypto";

/**
 * Six evidence format 1.1 records covering the shapes the health plugin
 * accepts, with invented, domain-neutral names. Each call builds fresh
 * `record_id`s and timestamps (a few minutes in the past, so they are never
 * ahead of the server clock) for the claim named by `claimId`.
 *
 * Records are plain objects in the wire (snake_case) shape, so a test can
 * post one as it is or override fields first with `withOverrides`.
 */

export const HEALTH_RECORD_NAMES = [
	"populationPass",
	"wholeSystem",
	"marginalSummary",
	"failingSummary",
	"indeterminate",
	"singleSubject",
] as const;

export type HealthRecordName = (typeof HEALTH_RECORD_NAMES)[number];
export type HealthRecordFixture = Record<string, unknown>;

/** The check every summary and the indeterminate record in the set names. */
export const SUMMARY_CHECK_NAME = "Sensor Range Checker";

const minutesAgo = (minutes: number): string =>
	new Date(Date.now() - minutes * 60_000).toISOString();

const memberIds = (count: number): string[] =>
	Array.from({ length: count }, () => randomUUID());

const sensorCheck = {
	name: SUMMARY_CHECK_NAME,
	version: "1.2",
	scope: "sensor",
	params: { region: "ALL" },
};

const sensorRule = { kind: "identity", version: "r1" };

const sensorReduction = {
	kind: "mean",
	params: { avail_floor: 0.8 },
	rule: {
		kind: "threshold",
		direction: "maximize",
		params: { pass_values: 0.8, marginal_values: 0.5 },
		version: "d1",
	},
	version: "d1",
};

const sensorAggregation = {
	kind: "proportion",
	params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
	version: "a1",
};

export function buildHealthRecords(
	claimId: string
): Record<HealthRecordName, HealthRecordFixture> {
	const base = (timestampMinutesAgo: number) => ({
		format_version: "1.1",
		record_id: randomUUID(),
		timestamp: minutesAgo(timestampMinutesAgo),
		claim_ref: claimId,
	});

	return {
		// A population summary that passes.
		populationPass: {
			...base(3),
			check: sensorCheck,
			rule: sensorRule,
			reduction: sensorReduction,
			aggregation: sensorAggregation,
			window: "PT1M",
			value: { number: 0.97, unit: "ratio" },
			verdict: "pass",
			valid_for: "PT1H",
			provenance: {
				twin_version: "2.3",
				session: "RUN-A",
				scenario: "SC-01",
				pipeline_version: "0.4.0",
				run: "offline",
				members: memberIds(3),
				failed_subjects: [{ kind: "sensor", id: "S-204" }],
			},
			comment: "PASS: 206, MARGINAL: 3, FAIL: 3",
		},

		// A whole-system record: no aggregation, a boolean reading.
		wholeSystem: {
			...base(3),
			check: {
				name: "Forecast Availability Checker",
				version: "0.1",
				scope: "environment",
			},
			rule: sensorRule,
			window: "PT1M",
			value: true,
			verdict: "pass",
			valid_for: "PT1H",
			provenance: {
				twin_version: "2.3",
				session: "RUN-A",
				pipeline_version: "0.4.0",
				run: "offline",
				members: memberIds(1),
			},
			comment: "Forecast field exists.",
		},

		// A marginal summary.
		marginalSummary: {
			...base(2),
			check: sensorCheck,
			rule: sensorRule,
			reduction: sensorReduction,
			aggregation: sensorAggregation,
			window: "PT1M",
			value: { number: 0.9, unit: "ratio" },
			verdict: "marginal",
			valid_for: "PT1H",
			provenance: {
				session: "RUN-A",
				pipeline_version: "0.4.0",
				run: "https://ci.example.org/runs/17",
				members: memberIds(20),
			},
			comment: "PASS: 18, MARGINAL: 2, FAIL: 0",
		},

		// A failing summary that names the subjects that failed.
		failingSummary: {
			...base(1),
			check: sensorCheck,
			rule: sensorRule,
			reduction: sensorReduction,
			aggregation: sensorAggregation,
			window: "PT1M",
			value: { number: 0.6, unit: "ratio" },
			verdict: "fail",
			valid_for: "PT1H",
			provenance: {
				session: "RUN-A",
				pipeline_version: "0.4.0",
				run: "offline",
				members: memberIds(10),
				failed_subjects: [
					{ kind: "sensor", id: "S-017" },
					{ kind: "sensor", id: "S-018" },
					{ kind: "sensor", id: "S-031" },
					{ kind: "sensor", id: "S-040" },
				],
			},
			comment: "PASS: 6, MARGINAL: 0, FAIL: 4",
		},

		// An indeterminate record: no value, and a comment saying why.
		indeterminate: {
			...base(1),
			check: sensorCheck,
			rule: sensorRule,
			window: "PT1M",
			verdict: "indeterminate",
			valid_for: "PT1H",
			provenance: {
				session: "RUN-A",
				pipeline_version: "0.4.0",
				run: "offline",
				members: memberIds(1),
			},
			comment: "Inapplicable: no sensors were active in the window.",
		},

		// One subject, with uncertainty, the statistic that was judged, and a
		// condition that ends its validity when the twin version changes.
		singleSubject: {
			...base(2),
			check: {
				name: "Unit Drift Checker",
				version: "2.0",
				scope: "unit",
			},
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: { pass_values: 0.5, marginal_values: 1 },
				version: "r4",
			},
			window: "PT5M",
			value: { number: 0.31, unit: "mm" },
			verdict: "pass",
			valid_for: "P1D",
			valid_while: { twin_version: "2.3" },
			uncertainty: {
				kind: "interval",
				params: { lower: 0.22, upper: 0.4 },
				level: 0.95,
				method: "bootstrap",
				validated: true,
				nature: "predictive",
			},
			judged: { statistic: "mean", method: "bootstrap", value: 0.31 },
			subject: { kind: "unit", id: "U-7" },
			provenance: {
				twin_version: "2.3",
				session: "RUN-A",
				pipeline_version: "0.4.0",
				run: "offline",
			},
			comment: "Drift within tolerance.",
		},
	};
}

/** Returns a copy of `record` with `overrides` applied at the top level (use `undefined` to remove a field). */
export function withOverrides(
	record: HealthRecordFixture,
	overrides: Record<string, unknown>
): HealthRecordFixture {
	const copy: HealthRecordFixture = { ...record, ...overrides };
	for (const key of Object.keys(copy)) {
		if (copy[key] === undefined) {
			delete copy[key];
		}
	}
	return copy;
}
