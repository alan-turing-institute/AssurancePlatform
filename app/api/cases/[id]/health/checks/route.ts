import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { listCaseCheckLists } from "@/lib/services/health-check-catalogue-service";

/**
 * GET /api/cases/[id]/health/checks
 *
 * The checks a person can set up for this case's claims.
 *
 * @description Human session only; the session user needs VIEW on the case.
 * Returns the check lists of the active integrations whose system user has
 * EDIT on the case, each as `{ integration: { id, name }, pipeline,
 * published_at, checks }`. A check holds its name, version, description,
 * scope, value type, the settings it describes and any recommended settings.
 * @response 200 - `[{ integration, pipeline, published_at, checks }]`
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

		const result = await listCaseCheckLists(session.userId, id.toLowerCase());
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
