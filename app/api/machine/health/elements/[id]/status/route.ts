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
 * @description Machine-only (`requireApiToken("health:evidence:read")`); the
 * token's system user needs VIEW on the claim's case. The status is the one
 * the session route returns, including `mismatch`: null when the current
 * result was judged with the accepted settings, `{ state: "undeclared" }` when
 * the claim has no accepted settings, and `{ state: "mismatch", differences }`
 * when the current result used other settings than those accepted now. A
 * status belongs to the claim, so it is not limited to one integration's
 * checks.
 * @response 200 - `{ status }` (null when the claim has no bound check and no record)
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 403 - The `tea.health` plugin is not enabled for this integration
 * @response 404 - Claim not found (covers non-existent, wrong element type, and no-access — same message, no enumeration oracle)
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
