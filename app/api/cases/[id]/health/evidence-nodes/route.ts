import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { readLiveEvidenceNodesForCase } from "@/lib/services/health-status-service";

/**
 * GET /api/cases/[id]/health/evidence-nodes
 *
 * The case's live evidence nodes.
 *
 * @description Human session only; the session user needs VIEW on the case.
 * A node is live when its claim's evidence settings are accepted, the node is
 * in place under the claim (not in the trash, not in the sandbox, not a
 * defeater, still linked to the claim) and the claim is not in the trash.
 * Each item holds the node's `id` and `name`, the claim's `claim_id` and
 * `claim_name`, and `status`, the claim's current status as
 * `GET /api/elements/[id]/health` returns it.
 * @response 200 - `[{ id, name, claim_id, claim_name, status }]`
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
		const userId = await requireAuth();
		const { id } = await params;

		const result = await readLiveEvidenceNodesForCase(userId, id.toLowerCase());
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
