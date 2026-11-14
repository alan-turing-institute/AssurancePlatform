import type {
	HealthLiveEvidenceNode,
	HealthStatus,
} from "@/lib/plugins/health/health-types";
import type { HealthVerdict } from "@/lib/schemas/health-evidence";

/** A claim's status as the health route serves it: a fresh pass, with `overrides` applied. */
export function healthStatus(
	overrides: Partial<HealthStatus> = {}
): HealthStatus {
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
		mismatch: null,
		...overrides,
	};
}

/** The status of a claim bound to a check that has had no result yet. */
export function noResultYet(): HealthStatus {
	return healthStatus({
		verdict: null,
		record_id: null,
		timestamp: null,
		expires_at: null,
	});
}

/** The status of a claim whose every result has been withdrawn. */
export function everyResultWithdrawn(): HealthStatus {
	return healthStatus({
		verdict: null,
		stale: true,
		stale_reason: "all-revoked",
		stale_since: "2026-10-02T09:08:00.000Z",
		expires_at: null,
	});
}

/** A result that was current and has now expired, as the server reports it. */
export function expiredResult(verdict: HealthVerdict): HealthStatus {
	return healthStatus({
		verdict,
		stale: true,
		stale_reason: "expired",
		stale_since: "2026-10-02T09:08:00.000Z",
		expires_at: "2026-10-02T09:08:00.000Z",
	});
}

/** A result that was judged with settings other than the accepted ones. */
export function judgedWithOtherSettings(
	status: HealthStatus = healthStatus()
): HealthStatus {
	return { ...status, mismatch: { state: "mismatch", differences: [] } };
}

/** One item of the case's list of live evidence nodes: node E1 reporting on claim P1. */
export function liveNodeItem(
	overrides: Partial<HealthLiveEvidenceNode> = {}
): HealthLiveEvidenceNode {
	return {
		id: "node-1",
		name: "E1",
		claim_id: "claim-42",
		claim_name: "P1",
		status: healthStatus(),
		...overrides,
	};
}
