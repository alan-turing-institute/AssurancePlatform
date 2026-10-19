import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { readHealthStatusesForCase } from "@/lib/services/health-status-service";

/**
 * GET /api/machine/health/cases/[id]/status
 *
 * The health status of every claim in a case that has one, for a pipeline.
 *
 * Each entry is `{ claim_ref, status }`, where `status` is the object the
 * element status route returns, including `mismatch`.
 * Claims with no bound check and no record are left out.
 *
 * @description Returns the health status of every property claim in a case that has a bound check or at least one record, as `{ claim_ref, status }` entries; claims with neither are left out. Needs a bearer token with the `health:evidence:read` scope, View access to the case for the integration's account, and the Claim/Evidence Health plugin on for that account, which counts as opted in unless the deployment withholds the plugin.
 * @response 200 - `{ case_id, statuses: [{ claim_ref, status }] }`
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
		const principal = await requireApiToken(request, "health:evidence:read");
		const caseId = (await params).id.toLowerCase();

		const result = await readHealthStatusesForCase(
			principal.systemUserId,
			caseId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ case_id: caseId, statuses: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
