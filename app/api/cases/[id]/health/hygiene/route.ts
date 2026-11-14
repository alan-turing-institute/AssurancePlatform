import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { readHealthHygiene } from "@/lib/services/health-criteria-service";

/**
 * GET /api/cases/[id]/health/hygiene
 *
 * Three counts describing how the case's evidence is set up.
 *
 * @description Human session only; the session user needs VIEW on the case.
 * Each figure is `{ count, of }`. A claim's current result is the latest
 * result by timestamp that is not revoked. `claims_without_time_limit` counts
 * claims whose current result has no time limit, out of claims with a current
 * result. `checks_without_time_limit` counts checks with at least one such
 * claim, out of checks in use. `settings_as_recommended` counts accepted
 * settings that are exactly what the check recommends, out of accepted
 * settings.
 * @response 200 - `{ claims_without_time_limit, checks_without_time_limit, settings_as_recommended }`
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Case not found (a missing case and no access give the same message)
 * @auth SessionAuth
 * @tag Cases
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id } = await params;

		const result = await readHealthHygiene(session.userId, id.toLowerCase());
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
