import type { NextRequest } from "next/server";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { boundCheckRequestSchema } from "@/lib/schemas/health-evidence";
import { changeBoundCheck } from "@/lib/services/health-evidence-service";
import { refreshHealthSummary } from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * PUT /api/elements/[id]/health/bound-check
 *
 * Changes the one check a claim accepts evidence from, and records the
 * change with the person and their reason. Records naming the new check are
 * accepted from then on; records naming the old one are refused.
 *
 * @description Human session only — a machine token cannot change the
 * binding. The session user needs EDIT on the claim's case. `reason` is
 * required free text.
 * @body { name, reason }
 * @response 200 - `{ status }` (null when the claim has no accepted record yet)
 * @response 400 - Invalid id or body
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The claim is already bound to that check
 * @auth SessionAuth
 * @tag Elements
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id } = await params;

		const claimId = uuidSchema.safeParse(id);
		if (!claimId.success) {
			return apiError(validationError("Invalid element id"));
		}
		const body = await parseJsonBody(request, boundCheckRequestSchema);

		const result = await changeBoundCheck(session.userId, claimId.data, body);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		const status = await refreshHealthSummary(
			session.userId,
			claimId.data,
			result.data.caseId
		);
		emitSSEEvent("tea.health/state-changed", result.data.caseId, {
			claimId: claimId.data,
			status,
		});

		return apiSuccess({ status });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
