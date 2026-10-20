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
 * Returns every accepted set of settings in the case whose check came from
 * the calling integration's own check list, on claims that are not deleted.
 * A second pipeline on the same case gets only its own.
 * Suggested and inactive settings are never returned.
 * Each item is `{ claim_ref, state, revision, check, rule, reduction?,
 * aggregation?, window, valid_for, source, accepted_at, updated_at }` with
 * version labels in place.
 * The `aggregation` is `{ kind, params, rule, version }`: its pass mark is
 * `rule.params.pass_values`, and both the aggregation and its rule carry the
 * aggregation's label.
 * A percentile reduction's percentile is `reduction.params.percentile`.
 * Settings stored in an earlier form are served in this form with the same
 * labels.
 * Reading records when and which revision was read, without changing
 * `updated_at`.
 *
 * @description Returns the evidence settings accepted for the claims of a case whose checks came from the calling integration's own check list, which are the settings its pipeline should judge results against; settings that are only suggested or are inactive are never returned, and reading records which revision was read. Each aggregation carries its own `rule` with the pass mark in `rule.params.pass_values`, and a percentile reduction's percentile is `reduction.params.percentile`. Needs a bearer token with the `health:criteria:read` scope, View access to the case for the integration's account, and the Claim/Evidence Health plugin on for that account, which counts as opted in unless the deployment withholds the plugin.
 * @response 200 - `{ case_id, criteria: Item[] }`
 * @response 401 - Unauthorised (missing, invalid or wrong-scope token)
 * @response 403 - The `tea.health` plugin is not on for the integration's account: the deployment withholds it
 * @response 404 - Case not found (a missing case and no access give the same message)
 * @add 404
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
