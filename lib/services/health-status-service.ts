import { logger } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
	type EchoDifference,
	echoAgainst,
} from "@/lib/schemas/health-criteria";
import type {
	HealthEvidenceRecord,
	HealthVerdict,
} from "@/lib/schemas/health-evidence";
import { guardCaseAccess } from "@/lib/services/health-claim-access";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import type { PluginHealthEvidenceVerdict } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "health-status-service" });

/**
 * A claim's health status, computed from its evidence log every time it is
 * read — nothing about status is stored as a fact. The inputs are the
 * records themselves (verdict, timestamp, validity, conditions) and their
 * revocations, so every viewer of a claim sees the same status.
 *
 * The current record is the one with the latest `timestamp` (ties broken by
 * arrival order) that is not revoked. Records may arrive out of order, so a
 * late backfill never displaces a later reading. The claim shows that
 * record's verdict, and is stale when the record has expired, when one of
 * its `valid_while` conditions no longer holds, or when every record it ever
 * received has been revoked.
 *
 * `mismatch` compares that record with the settings as they are now, not as
 * they were when it arrived, so editing or retiring the settings flags the
 * claim at once and the flag stays until a result judged with the current
 * settings arrives.
 *
 * Nothing about a claim's status is written to `PluginData`: a published
 * snapshot carries no `tea.health` entry.
 */

const PLUGIN_ID = "tea.health";

export type HealthStaleReason = "expired" | "condition" | "all-revoked";

/**
 * How the claim's current result compares with the evidence settings accepted
 * for the claim now. Null when there is no current result to compare.
 */
export type HealthMismatch =
	| { state: "undeclared" }
	| { state: "mismatch"; differences: EchoDifference[] };

export interface HealthStatus {
	bound_check: string | null;
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

const VERDICT_FROM_DB: Record<PluginHealthEvidenceVerdict, HealthVerdict> = {
	PASS: "pass",
	MARGINAL: "marginal",
	FAIL: "fail",
	INDETERMINATE: "indeterminate",
};

/** Evidence rows that are not currently revoked. */
const NOT_REVOKED = { revocations: { none: { reinstatedAt: null } } } as const;

/**
 * When `key` first stopped carrying `expected`: among live records in
 * `caseId` and `session` that carry the key, the earliest timestamp with a
 * differing value that is later than the latest record carrying the expected
 * value (or the earliest differing value at all when none carries it). Null
 * means the variable still has the expected value. Scoped to the case so a
 * session name used in another case cannot affect this one.
 */
async function variableMismatchSince(
	caseId: string,
	session: string,
	key: string,
	expected: string
): Promise<Date | null> {
	const rows = await prisma.$queryRaw<Array<{ since: Date | null }>>`
		WITH live AS (
			SELECT e.record->'provenance'->>${key}::text AS value, e.record_timestamp AS ts
			FROM plugin_health_evidence e
			JOIN assurance_elements ae ON ae.id = e.claim_id
			WHERE ae.case_id = ${caseId}
				AND ae.deleted_at IS NULL
				AND e.session = ${session}
				AND e.record->'provenance'->>${key}::text IS NOT NULL
				AND NOT EXISTS (
					SELECT 1 FROM plugin_health_revocations r
					WHERE r.evidence_id = e.id AND r.reinstated_at IS NULL
				)
		)
		SELECT min(ts) AS since FROM live
		WHERE value <> ${expected}
			AND ts > COALESCE(
				(SELECT max(ts) FROM live WHERE value = ${expected}),
				'-infinity'::timestamp
			)
	`;
	return rows[0]?.since ?? null;
}

/**
 * When the first violated `valid_while` condition began to differ, or null
 * if every condition still holds. With several violated conditions, the
 * earliest of their times is reported.
 */
async function conditionViolatedSince(
	caseId: string,
	session: string,
	validWhile: Record<string, string>
): Promise<Date | null> {
	const violated: Date[] = [];
	for (const [key, expected] of Object.entries(validWhile)) {
		const since = await variableMismatchSince(caseId, session, key, expected);
		if (since) {
			violated.push(since);
		}
	}
	if (violated.length === 0) {
		return null;
	}
	return new Date(Math.min(...violated.map((date) => date.getTime())));
}

function validWhileOf(record: unknown): Record<string, string> {
	const raw = (record as { valid_while?: unknown } | null)?.valid_while;
	if (typeof raw !== "object" || raw === null) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(raw).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string"
		)
	);
}

function mismatchOf(
	echo: ReturnType<typeof echoAgainst>
): HealthMismatch | null {
	if (echo.state === "UNDECLARED") {
		return { state: "undeclared" };
	}
	return echo.state === "MISMATCH" && echo.differences
		? { state: "mismatch", differences: echo.differences }
		: null;
}

/**
 * Computes `claimId`'s status at `now`. Returns null when the claim has
 * neither a bound check nor a record (no status, as opposed to a stale one).
 * A claim with a bound check but no record has a status with no verdict that
 * is not stale, so the bound check and refusal count are visible.
 * Performs no access check: callers have already established access.
 */
export async function computeHealthStatus(
	claimId: string,
	caseId: string,
	now: Date = new Date()
): Promise<HealthStatus | null> {
	const [state, current, anyRecord, criteria] = await Promise.all([
		prisma.pluginHealthClaimState.findUnique({ where: { claimId } }),
		prisma.pluginHealthEvidence.findFirst({
			where: { claimId, ...NOT_REVOKED },
			orderBy: [{ recordTimestamp: "desc" }, { chainSequence: "desc" }],
		}),
		prisma.pluginHealthEvidence.findFirst({
			where: { claimId },
			select: { id: true },
		}),
		prisma.pluginHealthCriteria.findUnique({ where: { claimId } }),
	]);
	if (!(anyRecord || state)) {
		return null;
	}
	const base = {
		bound_check: state?.boundCheckName ?? null,
		rejected_since_last_accept: state?.rejectedSinceLastAccept ?? 0,
		mismatch: null as HealthMismatch | null,
	};

	if (!(current || anyRecord)) {
		return {
			...base,
			verdict: null,
			stale: false,
			stale_reason: null,
			stale_since: null,
			expires_at: null,
			record_id: null,
			timestamp: null,
		};
	}

	if (!current) {
		const latestRevocation = await prisma.pluginHealthRevocation.findFirst({
			where: { evidence: { claimId }, reinstatedAt: null },
			orderBy: { revokedAt: "desc" },
			select: { revokedAt: true },
		});
		return {
			...base,
			verdict: null,
			stale: true,
			stale_reason: "all-revoked",
			stale_since: latestRevocation?.revokedAt.toISOString() ?? null,
			expires_at: null,
			record_id: null,
			timestamp: null,
		};
	}

	const echo = echoAgainst(
		current.record as unknown as HealthEvidenceRecord,
		criteria
	);
	const common = {
		...base,
		mismatch: mismatchOf(echo),
		verdict: VERDICT_FROM_DB[current.verdict],
		expires_at: current.expiresAt?.toISOString() ?? null,
		record_id: current.recordId,
		timestamp: current.recordTimestamp.toISOString(),
	};

	if (current.expiresAt && current.expiresAt < now) {
		return {
			...common,
			stale: true,
			stale_reason: "expired",
			stale_since: current.expiresAt.toISOString(),
		};
	}

	const validWhile = validWhileOf(current.record);
	if (Object.keys(validWhile).length > 0) {
		const since = await conditionViolatedSince(
			caseId,
			current.session,
			validWhile
		);
		if (since) {
			return {
				...common,
				stale: true,
				stale_reason: "condition",
				stale_since: since.toISOString(),
			};
		}
	}

	return { ...common, stale: false, stale_reason: null, stale_since: null };
}

/**
 * A single generic message for every reason this read can fail to resolve a
 * claim — doesn't exist, is soft-deleted, isn't a `PROPERTY_CLAIM`, or the
 * caller lacks case access — so the message reveals nothing about what
 * exists elsewhere on the platform.
 */
const CLAIM_NOT_FOUND = "Claim not found";

/**
 * Reads one claim's current status for a signed-in person. Returns
 * `{ data: null }` (not an error) for a claim that has never had a record
 * accepted.
 *
 * Enablement is checked FIRST, before the element lookup runs: the lookup
 * queries `assuranceElement` directly with no case-permission check of its
 * own, so running it before enablement would let a user who has switched
 * the plugin off tell real element ids from fabricated ones by the error
 * that comes back. A disabled plugin refuses every id identically.
 */
export async function readHealthStatus(
	actingUserId: string,
	claimId: string
): ServiceResult<HealthStatus | null> {
	const enablement = await assertPluginEnabledForUser(PLUGIN_ID, actingUserId);
	if ("error" in enablement) {
		return { error: enablement.error };
	}

	try {
		const element = await prisma.assuranceElement.findUnique({
			where: { id: claimId },
			select: { caseId: true, deletedAt: true, elementType: true },
		});
		if (
			!element ||
			element.deletedAt ||
			element.elementType !== "PROPERTY_CLAIM"
		) {
			return { error: CLAIM_NOT_FOUND };
		}
		const hasAccess = await canAccessCase(
			{ userId: actingUserId, caseId: element.caseId },
			"VIEW"
		);
		if (!hasAccess) {
			return { error: CLAIM_NOT_FOUND };
		}
		return { data: await computeHealthStatus(claimId, element.caseId) };
	} catch (error) {
		log.error("Failed to read health status", { error });
		return { error: "Failed to read health status" };
	}
}

export interface HealthCaseStatus {
	claim_ref: string;
	status: HealthStatus;
}

/**
 * The status of every claim in `caseId` that has one (a bound check or at
 * least one record), for a signed-in person or a machine principal. Requires
 * VIEW-level case access; a missing case and an inaccessible one give the
 * same error.
 */
export async function readHealthStatusesForCase(
	actingUserId: string,
	caseId: string
): ServiceResult<HealthCaseStatus[]> {
	const guard = await guardCaseAccess(actingUserId, caseId, "VIEW");
	if ("error" in guard) {
		return { error: guard.error };
	}
	try {
		const claims = await prisma.assuranceElement.findMany({
			where: {
				caseId,
				deletedAt: null,
				elementType: "PROPERTY_CLAIM",
				OR: [
					{ pluginHealthClaimState: { isNot: null } },
					{ pluginHealthEvidence: { some: {} } },
				],
			},
			select: { id: true },
			orderBy: { createdAt: "asc" },
		});
		const statuses: HealthCaseStatus[] = [];
		for (const claim of claims) {
			const status = await computeHealthStatus(claim.id, caseId);
			if (status) {
				statuses.push({ claim_ref: claim.id, status });
			}
		}
		return { data: statuses };
	} catch (error) {
		log.error("Failed to read health statuses", { error });
		return { error: "Failed to read health status" };
	}
}
