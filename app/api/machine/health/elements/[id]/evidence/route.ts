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
 * Each item is `{ id, record, chain_sequence, record_hash,
 * previous_record_hash, created_by_id, created_at, expires_at, revocation,
 * echo_state, echo_differences, criteria_revision, thinned_before }`, where
 * `revocation` is the record's open revocation (`cause`, `reason`,
 * `revoked_at`, `revoked_by_name`) or null.
 * `echo_state` (`match`, `mismatch` or `undeclared`), `echo_differences` and
 * `criteria_revision` are the comparison with the claim's accepted evidence
 * settings that was made when the record arrived.
 * `thinned_before` is null, or the note the nightly thinning job left where it
 * removed passing results that repeated their neighbours exactly:
 * `{ removed_count, first_removed_at, first_removed_sequence,
 * last_removed_at, last_removed_sequence, rule_version, thinned_at }`.
 * The removed records sit between this one and the next older kept record, so
 * that record's hash is not this one's `previous_record_hash` there: the note
 * accounts for the break, and `previous_record_hash` still names the last
 * removed record's hash.
 * Every other link in the list matches.
 * In a `live=true` list a note can be missing when the kept record it belongs
 * to is not live.
 *
 * @description Returns a page of a claim's evidence log, newest first, for a bearer token with the `health:evidence:read` scope or a signed-in person with view access to the case; the caller also needs the Claim/Evidence Health plugin on, which an integration's account counts as unless the deployment withholds the plugin. `limit` (default 50, at most 200) sets the page size and `before` (a `chain_sequence`) returns only older records; `next_before` in the response is the value to pass as `before` for the next page, or null on the last page. With `live=true`, only records that are not revoked and not expired are returned.
 * @query limit - Page size, 1 to 200 (default 50)
 * @query before - Return only records with a lower chain_sequence
 * @query live - `true` to return only records that are not revoked and not expired
 * @response 200 - `{ evidence: Item[], next_before: number | null }`
 * @response 400 - Invalid `limit` or `before`
 * @response 401 - Unauthorised (no valid token or session)
 * @response 403 - The `tea.health` plugin is not on for the caller. A person turns it on in Settings; an integration's account counts as on unless the deployment withholds the plugin
 * @response 404 - Claim not found (covers non-existent, wrong element type and no access, with the same message)
 * @add 404
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
			live: query.data.live === "true",
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
 * Appends one evidence format 1.1 record to the claim's log and tells connected
 * editors that the claim's status changed.
 *
 * The body must be a format 1.1 record exactly.
 * Unknown top-level fields are rejected, and extra `provenance` keys are kept
 * as sent.
 * `claim_ref` in the body must equal the path `[id]`; a mismatch is a 400 and
 * is never retargeted.
 * The first record accepted for a claim binds the claim to its check, and a
 * record naming another check is refused with 422.
 * A repeated `record_id` is refused with 409.
 * The status change is announced only after the record has been stored.
 *
 * @description Appends one evidence format 1.1 record to a property claim's log and returns 201 with `{ record, status }`. Needs a bearer token with the `health:evidence:write` scope and Edit access to the claim's case, and the Claim/Evidence Health plugin on for the integration's account, which counts as opted in unless the deployment withholds the plugin. The body is the record, `claim_ref` must equal the path id, and unknown top-level fields are refused. The first record accepted binds the claim to its check; a record naming another check is refused with 422, and a repeated `record_id` with 409.
 * @response 201 - `{ record, status }`: the stored record and the claim's status (`verdict`, `stale`, `stale_reason`, `stale_since`, `expires_at`, `record_id`, `timestamp`, `bound_check`, `rejected_since_last_accept`, `mismatch`)
 * @response 400 - Invalid body (the field is named), or `claim_ref` does not match the path id
 * @response 401 - Unauthorised (missing, invalid or wrong-scope token)
 * @response 403 - The `tea.health` plugin is not on for the integration's account: the deployment withholds it
 * @response 404 - Claim not found (covers non-existent, wrong element type and no access, with the same message)
 * @response 409 - A record with this `record_id` already exists
 * @response 413 - Payload too large
 * @response 422 - The claim is bound to a different check
 * @add 404,409,422
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
