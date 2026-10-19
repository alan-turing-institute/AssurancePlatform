import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { readClaimCriteriaForPipeline } from "@/lib/services/health-criteria-service";

/**
 * GET /api/machine/health/elements/[id]/criteria
 *
 * The evidence settings accepted for one claim, for the pipeline that runs
 * its check.
 *
 * Returns the claim's accepted settings when their check came from the
 * calling integration's own check list, in the item shape of the case route.
 * Suggested, inactive and another pipeline's settings give the same 404 as no
 * settings at all.
 * Reading records when and which revision was read, without changing
 * `updated_at`.
 *
 * @description Returns the evidence settings accepted for one property claim when their check came from the calling integration's own check list, in the item shape of the case route; suggested settings, inactive settings and another pipeline's settings give the same 404 as no settings at all, and reading records which revision was read. Needs a bearer token with the `health:criteria:read` scope, View access to the claim's case for the integration's account, and the Claim/Evidence Health plugin on for that account, which counts as opted in unless the deployment withholds the plugin.
 * @response 200 - One item, as in `GET /api/machine/health/cases/[id]/criteria`
 * @response 401 - Unauthorised (missing, invalid or wrong-scope token)
 * @response 403 - The `tea.health` plugin is not on for the integration's account: the deployment withholds it
 * @response 404 - Claim not found, or no accepted settings to serve
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
		const claimId = (await params).id.toLowerCase();

		const result = await readClaimCriteriaForPipeline(principal, claimId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
