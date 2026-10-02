import type { NextRequest } from "next/server";
import { readJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { validationError } from "@/lib/errors";
import { announceHealthChange } from "@/lib/health-route-helpers";
import {
	describeEvidenceIssues,
	evidenceListQuerySchema,
	healthEvidenceRecordSchema,
} from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	listHealthEvidence,
} from "@/lib/services/health-evidence-service";

/**
 * The health plugin's machine ingestion endpoint. The body is an evidence
 * format 1.1 record.
 */

const BEARER_PREFIX = "Bearer ";

/**
 * GET's dual auth mode: a bearer token routes exclusively through
 * `requireApiToken` (no session fallback on a bad/malformed token — failing
 * closed here, rather than silently trying the session next, avoids a
 * confusing "invalid token but somehow still worked" path). Absence of an
 * `authorization` header routes through the human session instead. Either
 * way the returned id is just a `userId` as far as `listHealthEvidence` is
 * concerned — case access and plugin enablement are checked identically
 * for both (see `health-evidence-service.ts`'s `guardClaimAccess`).
 */
async function resolveReadPrincipalUserId(
	request: NextRequest
): Promise<string> {
	const header = request.headers.get("authorization");
	if (header?.startsWith(BEARER_PREFIX)) {
		const principal = await requireApiToken(request, "health:evidence:read");
		return principal.systemUserId;
	}
	const session = await requireAuthSession();
	return session.userId;
}

/**
 * GET /api/machine/health/elements/[id]/evidence
 *
 * Returns one page of the claim's evidence log, newest first.
 *
 * @description Auth is EITHER a bearer token scoped `health:evidence:read`
 * OR a human session — either way the acting principal still needs case
 * access and the `tea.health` plugin must be enabled for them. Each item is
 * `{ id, record, chain_sequence, record_hash, previous_record_hash,
 * created_by_id, created_at, expires_at, revocation }`, where `revocation`
 * is the record's open revocation (`cause`, `reason`, `revoked_at`,
 * `revoked_by_name`) or null. `limit` (default 50, at most 200) sets the page
 * size; `before` is a `chain_sequence`, returning only older records.
 * `next_before` is the value to pass as `before` for the next page, or null
 * on the last page.
 * @query limit - Page size, 1 to 200 (default 50)
 * @query before - Return only records with a lower chain_sequence
 * @response 200 - `{ evidence: Item[], next_before: number | null }`
 * @response 400 - Invalid `limit` or `before`
 * @response 401 - Unauthorised (no valid token or session)
 * @response 404 - Claim not found (covers non-existent, wrong element type, and no-access — same message, no enumeration oracle)
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/principal
 * @auth bearer,SessionAuth
 * @tag Machine
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: claimId } = await params;
		const userId = await resolveReadPrincipalUserId(request);

		const query = evidenceListQuerySchema.safeParse(
			Object.fromEntries(request.nextUrl.searchParams)
		);
		if (!query.success) {
			return apiError(
				validationError(describeEvidenceIssues(query.error).message)
			);
		}

		const result = await listHealthEvidence(userId, claimId, {
			limit: query.data.limit,
			before: query.data.before,
		});
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			evidence: result.data.items,
			next_before: result.data.nextBefore,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/machine/health/elements/[id]/evidence
 *
 * Appends one evidence format 1.1 record, and broadcasts the change over SSE.
 *
 * @description Machine-only (`requireApiToken("health:evidence:write")`).
 * Body must be a format 1.1 record exactly — unknown top-level fields are
 * rejected, extra `provenance` keys are preserved verbatim. `claim_ref` in
 * the body MUST equal the path `[id]`; a mismatch is a 400 (never a silent
 * re-target). The first record accepted for a claim binds the claim to its
 * check; a record naming another check is refused with 422. A repeated
 * `record_id` is refused with 409. On success the record is appended to the
 * hash chain and `tea.health/state-changed` is broadcast to the claim's case
 * — emitted only after the write has committed, never from inside a
 * transaction.
 * @response 201 - `{ record, status }`: the stored record and the claim's status (`verdict`, `stale`, `stale_reason`, `stale_since`, `expires_at`, `record_id`, `timestamp`, `bound_check`, `rejected_since_last_accept`)
 * @response 400 - Invalid body (the field is named), or `claim_ref` doesn't match the path id
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 404 - Claim not found (covers non-existent, wrong element type, and no-access — same message, no enumeration oracle)
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/principal
 * @response 409 - A record with this `record_id` already exists
 * @response 413 - Payload too large
 * @response 422 - The claim is bound to a different check
 * @auth bearer
 * @tag Machine
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const principal = await requireApiToken(request, "health:evidence:write");
		const { id } = await params;
		const claimId = id.toLowerCase();

		const parsed = healthEvidenceRecordSchema.safeParse(
			await readJsonBody(request)
		);
		if (!parsed.success) {
			const { message, fieldErrors } = describeEvidenceIssues(parsed.error);
			return apiError(validationError(message, fieldErrors));
		}
		const record = parsed.data;

		// Route-layer equality check: path and body are parsed separately, so
		// this isn't expressible in the zod schema alone.
		if (record.claim_ref !== claimId) {
			return apiError(
				validationError("claim_ref must match the evidence path id", {
					claim_ref: "must match the evidence path id",
				})
			);
		}

		const appendResult = await appendHealthEvidence(
			principal.systemUserId,
			claimId,
			record
		);
		if ("error" in appendResult) {
			return apiError(serviceErrorToAppError(appendResult.error));
		}
		const { caseId } = appendResult.data;

		// After the write has committed — never inside the transaction, never
		// on a failed write.
		const status = await announceHealthChange(claimId, caseId, {
			integrationName: principal.integrationName,
		});

		return apiSuccess({ record: appendResult.data.record, status }, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
