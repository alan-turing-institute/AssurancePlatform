import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { validationError } from "@/lib/errors";
import { healthEvidenceItemSchema } from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	listHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { recomputeHealthScore } from "@/lib/services/health-scoring-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * The health plugin's machine ingestion endpoint (ADR 0002 v2 §3, DARTER
 * Interface C). Body = evidence-format-v0.1 exactly
 * (`docs/specs/evidence-format-v0.1.md`).
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
 * Returns the append-only evidence log for a claim, oldest first.
 *
 * @description Auth is EITHER a bearer token scoped `health:evidence:read`
 * OR a human session — either way the acting principal still needs case
 * access and the `tea.health` plugin must be enabled for them. Refuses with
 * a clean error (never a 500) when the plugin is unavailable/disabled.
 * @response 200 - `{ evidence: PluginHealthEvidence[] }`
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

		const result = await listHealthEvidence(userId, claimId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ evidence: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/machine/health/elements/[id]/evidence
 *
 * Appends one evidence-format-v0.1 item, recomputes the claim's health
 * score, and broadcasts the change over SSE.
 *
 * @description Machine-only (`requireApiToken("health:evidence:write")`).
 * Body must be evidence-format-v0.1 exactly — unknown top-level fields are
 * rejected, `provenance` keys are preserved verbatim. `claimId` in the body
 * MUST equal the path `[id]`; a mismatch is a 400 (never a silent
 * re-target). On success: the evidence is appended to the hash chain, the
 * score is recomputed and written to `PluginData` under `tea.health`, and
 * `tea.health/state-changed` is broadcast to the claim's case — emitted
 * only after both writes have committed, never from inside a transaction.
 * If scoring fails after a successful append, the evidence is still
 * durably recorded (append-only, already committed); no event is emitted
 * and the caller sees the scoring error — the next evidence append (or a
 * future recompute-only path) will retry the computation from the full log.
 * @response 201 - `{ evidence: PluginHealthEvidence, health: { score, lastEvaluatedAt, validityWindowSeconds } }`
 * @response 400 - Invalid body, or `claimId` doesn't match the path id
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 404 - Claim not found (covers non-existent, wrong element type, and no-access — same message, no enumeration oracle)
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/principal
 * @auth bearer
 * @tag Machine
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const principal = await requireApiToken(request, "health:evidence:write");
		const { id: claimId } = await params;

		const parsed = healthEvidenceItemSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		// Route-layer equality check (evidence-format-v0.1): path and body are
		// parsed separately, so this isn't expressible in the zod schema alone.
		if (parsed.data.claimId !== claimId) {
			return apiError(
				validationError("claimId must match the evidence path id")
			);
		}

		const appendResult = await appendHealthEvidence(principal.systemUserId, {
			claimId,
			metricName: parsed.data.metricName,
			value: parsed.data.value,
			threshold: parsed.data.threshold,
			verdict: parsed.data.verdict,
			oddDimensions: parsed.data.oddDimensions,
			sourceSystem: parsed.data.sourceSystem,
			provenance: parsed.data.provenance,
			evaluatedAt: parsed.data.evaluatedAt,
		});
		if ("error" in appendResult) {
			return apiError(serviceErrorToAppError(appendResult.error));
		}
		const { evidence, caseId } = appendResult.data;

		const scoreResult = await recomputeHealthScore(
			principal.systemUserId,
			claimId,
			caseId
		);
		if ("error" in scoreResult) {
			return apiError(serviceErrorToAppError(scoreResult.error));
		}

		// After both writes have committed — never inside either transaction,
		// never on a failed write (ADR 0002 v2 §2.5).
		emitSSEEvent("tea.health/state-changed", caseId, {
			claimId,
			health: scoreResult.data,
			integrationName: principal.integrationName,
		});

		return apiSuccess({ evidence, health: scoreResult.data }, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
