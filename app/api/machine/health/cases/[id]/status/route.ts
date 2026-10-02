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
 * @description Machine-only (`requireApiToken("health:evidence:read")`); the
 * token's system user needs VIEW on the case. Each entry is
 * `{ claim_ref, status }` with the status object of the element route,
 * including `mismatch`. Claims with no bound check and no record are left out.
 * @response 200 - `{ case_id, statuses: [{ claim_ref, status }] }`
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
