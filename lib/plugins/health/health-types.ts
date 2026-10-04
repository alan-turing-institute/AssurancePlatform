import type { HealthCheck } from "@/lib/schemas/health-checks";
import type {
	ServedSettings,
	SettingsSource,
} from "@/lib/schemas/health-criteria";
import type {
	HealthEvidenceRecord,
	HealthVerdict,
} from "@/lib/schemas/health-evidence";

/** One way a result differed from the evidence settings accepted for its claim. */
export interface HealthEchoDifference {
	declared: unknown;
	field: string;
	used: unknown;
}

export type HealthEchoState = "match" | "mismatch" | "undeclared";

/**
 * How the claim's current result compares with the settings accepted for the
 * claim now; null when there is no current result to compare.
 */
export type HealthMismatch =
	| { state: "undeclared" }
	| { state: "mismatch"; differences: HealthEchoDifference[] };

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
	mismatch: HealthMismatch | null;
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
	criteria_revision: number | null;
	echo_differences: HealthEchoDifference[] | null;
	echo_state: HealthEchoState;
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

export type HealthCriteriaState = "accepted" | "inactive" | "suggested";

/** A claim's stored settings as `GET /api/elements/[id]/health/criteria` returns them, with version labels. */
export type HealthCriteriaView = ServedSettings & {
	accepted_at: string | null;
	revision: number;
	source: SettingsSource;
	state: HealthCriteriaState;
	updated_at: string;
};

export type HealthCheckOffer = "current" | "newer-version" | "not-offered";

export type HealthCriteriaAction =
	| "accepted"
	| "discarded"
	| "edited"
	| "retired"
	| "suggested";

/** The body of `GET` and `PUT /api/elements/[id]/health/criteria`. */
export interface HealthCriteriaResponse {
	accepted_by: { name: string; owns_integration: boolean } | null;
	/** The check's entry in the check list when the check was last found there. */
	check_description: HealthCheck | null;
	check_offer: HealthCheckOffer | null;
	criteria: HealthCriteriaView | null;
	integration: { id: string; name: string } | null;
	last_change: {
		action: HealthCriteriaAction;
		at: string;
		by_name: string;
		reason: string | null;
	} | null;
	latest_result: {
		differences: HealthEchoDifference[];
		record_id: string;
	} | null;
	pipeline_read: { at: string; revision: number | null } | null;
}

/** One item of `GET /api/cases/[id]/health/checks`: the checks a pipeline offers for the case. */
export interface HealthCheckListOffer {
	checks: HealthCheck[];
	integration: { id: string; name: string };
	pipeline: string;
	published_at: string;
}
