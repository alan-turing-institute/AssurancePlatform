import type {
	HealthEvidenceRecord,
	HealthVerdict,
} from "@/lib/schemas/health-evidence";

export type HealthStaleReason = "all-revoked" | "condition" | "expired";

/**
 * A claim's status as returned by `GET /api/elements/[id]/health`
 * (`{ status }`). `verdict` is null when the claim is bound to a check but
 * has no record yet, and when every record has been withdrawn; the two are
 * told apart by `stale` and `stale_reason`.
 */
export interface HealthStatus {
	bound_check: string;
	expires_at: string | null;
	record_id: string | null;
	rejected_since_last_accept: number;
	stale: boolean;
	stale_reason: HealthStaleReason | null;
	stale_since: string | null;
	timestamp: string | null;
	verdict: HealthVerdict | null;
}

export type HealthRevocationCause =
	| "binding-defect"
	| "duplicate"
	| "evidence-defect"
	| "other"
	| "superseded";

/** The open revocation on a record, as the evidence list returns it. */
export interface HealthRevocation {
	cause: HealthRevocationCause;
	reason: string;
	revoked_at: string;
	revoked_by_name: string | null;
}

/** One item of `GET /api/machine/health/elements/[id]/evidence`, newest first. */
export interface HealthEvidenceLogItem {
	chain_sequence: number;
	created_at: string;
	created_by_id: string;
	expires_at: string | null;
	id: string;
	previous_record_hash: string | null;
	record: HealthEvidenceRecord;
	record_hash: string;
	revocation: HealthRevocation | null;
}

export interface HealthEvidencePage {
	evidence: HealthEvidenceLogItem[];
	next_before: number | null;
}
