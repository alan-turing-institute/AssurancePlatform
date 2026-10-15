import type { NextRequest } from "next/server";
import { apiErrorFromUnknown } from "@/lib/api-response";
import {
	answerCriteriaChange,
	parseHealthBody,
	requireClaimRequest,
} from "@/lib/health-route-helpers";
import { criteriaRetirementRequestSchema } from "@/lib/schemas/health-criteria";
import { retireCriteria } from "@/lib/services/health-criteria-service";

/**
 * POST /api/elements/[id]/health/criteria/retirement
 *
 * Stops the use of a claim's evidence settings.
 *
 * @description Human session only. The session user needs EDIT on the claim's
 * case. Accepted settings are retired and a reason is required; a suggestion
 * is discarded and the reason is optional. Both leave the settings inactive,
 * add a history entry, and keep the revision number and version counters, so
 * setting up again continues from them. The claim is flagged until a result
 * arrives that was judged with accepted settings. `evidence_node` says what
 * happens to the claim's live evidence node: `keep` (the default) leaves it as
 * ordinary evidence, so accepting again reuses it; `remove` trashes it, or
 * only removes this claim's link to it when it supports another claim too.
 * The choice does nothing when the claim has no live node.
 * @body { reason, evidence_node? }
 * @response 200 - The same body as `GET /api/elements/[id]/health/criteria`, after the change
 * @response 400 - Invalid body, or no reason for accepted settings
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message), or the claim has no settings
 * @response 409 - The settings are already inactive, or the case changed while saving
 * @auth SessionAuth
 * @tag Elements
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, username, claimId } = await requireClaimRequest(params);
		const body = await parseHealthBody(
			request,
			criteriaRetirementRequestSchema
		);

		const result = await retireCriteria(userId, claimId, body);
		return await answerCriteriaChange(result, claimId, { userId, username });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
