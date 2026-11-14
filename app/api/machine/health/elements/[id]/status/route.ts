import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { readHealthStatus } from "@/lib/services/health-status-service";

/**
 * GET /api/machine/health/elements/[id]/status
 *
 * One claim's health status, for a pipeline.
 *
 * The status is the one the session route returns, including `mismatch`:
 * null when the current result was judged with the accepted settings,
 * `{ state: "undeclared" }` when the claim has no accepted settings, and
 * `{ state: "mismatch", differences }` when the current result used other
 * settings than those accepted now.
 * A status belongs to the claim, so it is not limited to one integration's
 * checks.
 *
 * @description Returns one property claim's health status, which is null when the claim has no bound check and no record; its `mismatch` field is null when the current result was judged with the accepted settings, `{ state: "undeclared" }` when the claim has no accepted settings, and `{ state: "mismatch", differences }` when the current result used other settings than those accepted now. Needs a bearer token with the `health:evidence:read` scope, View access to the claim's case for the integration's account, and the Claim/Evidence Health plugin on for that account, which counts as opted in unless the deployment withholds the plugin.
 * @response 200 - `{ status }` (null when the claim has no bound check and no record)
 * @response 401 - Unauthorised (missing, invalid or wrong-scope token)
 * @response 403 - The `tea.health` plugin is not on for the integration's account: the deployment withholds it
 * @response 404 - Claim not found (covers a claim that does not exist, one of the wrong element type and one the integration cannot view, with the same message)
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
		const claimId = (await params).id.toLowerCase();

		const result = await readHealthStatus(principal.systemUserId, claimId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess({ status: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
