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
import { reinstatementRequestSchema } from "@/lib/schemas/health-evidence";
import { reinstateHealthEvidence } from "@/lib/services/health-evidence-service";
import { refreshHealthSummary } from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * POST /api/elements/[id]/health/records/[recordId]/reinstatement
 *
 * Puts a revoked evidence record back into its claim's status. The
 * revocation is kept, closed with who reinstated the record, when and why.
 *
 * @description Human session only — a machine token cannot reinstate. The
 * session user needs EDIT on the claim's case. `[recordId]` is the record's
 * own `record_id`. `reason` is required free text.
 * @body { reason }
 * @response 200 - `{ status }`
 * @response 400 - Invalid ids or body
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim or record not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The record is not revoked
 * @auth SessionAuth
 * @tag Elements
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; recordId: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id, recordId } = await params;

		const claimId = uuidSchema.safeParse(id);
		const parsedRecordId = uuidSchema.safeParse(recordId);
		if (!(claimId.success && parsedRecordId.success)) {
			return apiError(validationError("Invalid element or record id"));
		}
		const body = await parseJsonBody(request, reinstatementRequestSchema);

		const result = await reinstateHealthEvidence(
			session.userId,
			claimId.data,
			parsedRecordId.data,
			body
		);
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
