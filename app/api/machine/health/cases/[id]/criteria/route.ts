import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { readCaseCriteriaForPipeline } from "@/lib/services/health-criteria-service";

/**
 * GET /api/machine/health/cases/[id]/criteria
 *
 * The evidence settings accepted for the claims of a case, for the pipeline
 * that runs the checks.
 *
 * @description Machine-only (`requireApiToken("health:criteria:read")`); the
 * token's system user needs VIEW on the case. Returns every accepted set of
 * settings in the case whose check came from the calling integration's own
 * check list, on claims that are not deleted; a second pipeline on the same
 * case gets only its own. Suggested and inactive settings are never returned.
 * Each item is `{ claim_ref, state, revision, check, rule, reduction?,
 * aggregation?, window, valid_for, source, accepted_at, updated_at }` with
 * version labels in place. Reading records when and which revision was read,
 * without changing `updated_at`.
 * @response 200 - `{ case_id, criteria: Item[] }`
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 403 - The `tea.health` plugin is not enabled for this integration
 * @response 404 - Case not found (a missing case and no access give the same message)
 * @auth bearer
 * @tag Machine
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const principal = await requireApiToken(request, "health:criteria:read");
		const caseId = (await params).id.toLowerCase();

		const result = await readCaseCriteriaForPipeline(principal, caseId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ case_id: caseId, criteria: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
