import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import {
	announceHealthChange,
	criteriaFailure,
	parseHealthBody,
} from "@/lib/health-route-helpers";
import { uuidSchema } from "@/lib/schemas/base";
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
 * arrives that was judged with accepted settings.
 * @body { reason }
 * @response 200 - The same body as `GET /api/elements/[id]/health/criteria`, after the change
 * @response 400 - Invalid body, or no reason for accepted settings
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message), or the claim has no settings
 * @response 409 - The settings are already inactive
 * @auth SessionAuth
 * @tag Elements
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id } = await params;
		const claimId = uuidSchema.safeParse(id.toLowerCase());
		if (!claimId.success) {
			return apiError(validationError("Invalid element id"));
		}
		const body = await parseHealthBody(
			request,
			criteriaRetirementRequestSchema
		);

		const result = await retireCriteria(session.userId, claimId.data, body);
		if ("error" in result || "invalid" in result) {
			return criteriaFailure(result);
		}

		await announceHealthChange(claimId.data, result.data.caseId);
		return apiSuccess(result.data.view);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
