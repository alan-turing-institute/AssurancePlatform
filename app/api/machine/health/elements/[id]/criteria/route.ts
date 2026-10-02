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
 * @description Machine-only (`requireApiToken("health:criteria:read")`); the
 * token's system user needs VIEW on the claim's case. Returns the claim's
 * accepted settings when their check came from the calling integration's own
 * check list, in the item shape of the case route. Suggested, inactive and
 * another pipeline's settings give the same 404 as no settings at all.
 * Reading records when and which revision was read, without changing
 * `updated_at`.
 * @response 200 - One item, as in `GET /api/machine/health/cases/[id]/criteria`
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 403 - The `tea.health` plugin is not enabled for this integration
 * @response 404 - Claim not found, or no accepted settings to serve
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
