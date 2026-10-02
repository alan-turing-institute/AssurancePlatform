import type { HealthEvidenceLogItem, HealthStatus } from "../health-types";

const CLAIM_ID = "7acd824e-0000-4000-8000-000000000001";

export function status(overrides: Partial<HealthStatus> = {}): HealthStatus {
	return {
		bound_check: "Sensor Range Checker",
		rejected_since_last_accept: 0,
		verdict: "pass",
		expires_at: new Date(Date.now() + 3_600_000).toISOString(),
		record_id: "e0bbe873-0000-4000-8000-000000000001",
		timestamp: new Date(Date.now() - 60_000).toISOString(),
		stale: false,
		stale_reason: null,
		stale_since: null,
		...overrides,
	};
}

type Record1 = HealthEvidenceLogItem["record"];

/** A population summary record in the stored shape, with optional overrides. */
export function record(overrides: Partial<Record1> = {}): Record1 {
	return {
		format_version: "1.1",
		record_id: "e0bbe873-0000-4000-8000-000000000001",
		timestamp: "2026-10-02T08:08:00.000Z",
		claim_ref: CLAIM_ID,
		check: {
			name: "Sensor Range Checker",
			version: "1.2",
			scope: "sensor",
			params: { region: "ALL" },
		},
		rule: { kind: "identity", version: "r1" },
		reduction: {
			kind: "mean",
			params: { avail_floor: 0.8 },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.8, marginal_values: 0.5 },
				version: "d1",
			},
			version: "d1",
		},
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.95 },
			version: "a1",
		},
		verdict: "pass",
		window: "PT1M",
		valid_for: "PT1H",
		provenance: {
			session: "RUN-A",
			pipeline_version: "0.4.0",
			run: "offline",
			members: ["c64e4e2a-0000-4000-8000-000000000001"],
			failed_subjects: [{ kind: "sensor", id: "S-204" }],
		},
		comment: "PASS: 206, MARGINAL: 3, FAIL: 3",
		value: { number: 0.97, unit: "ratio" },
		...overrides,
	};
}

export function item(
	overrides: Partial<HealthEvidenceLogItem> = {},
	recordOverrides: Partial<Record1> = {}
): HealthEvidenceLogItem {
	const stored = record(recordOverrides);
	return {
		id: `row-${stored.record_id}`,
		record: stored,
		chain_sequence: 1,
		record_hash: "hash-1",
		previous_record_hash: null,
		created_by_id: "user-1",
		created_at: "2026-10-02T08:08:01.000Z",
		expires_at: "2026-10-02T09:08:00.000Z",
		revocation: null,
		...overrides,
	};
}
