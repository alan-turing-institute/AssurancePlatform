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
import { revocationRequestSchema } from "@/lib/schemas/health-evidence";
import { revokeHealthEvidence } from "@/lib/services/health-evidence-service";
import { refreshHealthSummary } from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * POST /api/elements/[id]/health/records/[recordId]/revocation
 *
 * Withdraws one evidence record from its claim's status. The record stays
 * in the log, marked revoked, and keeps its place in the hash chain.
 *
 * @description Human session only — a machine token cannot revoke. The
 * session user needs EDIT on the claim's case. `[recordId]` is the record's
 * own `record_id`. `cause` is one of `evidence-defect`, `binding-defect`,
 * `duplicate`, `superseded`, `other`; `reason` is required free text.
 * @body { cause, reason }
 * @response 201 - `{ revocation: { cause, reason, revoked_at, revoked_by_name }, status }`
 * @response 400 - Invalid ids or body
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim or record not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The record is already revoked
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
		const body = await parseJsonBody(request, revocationRequestSchema);

		const result = await revokeHealthEvidence(
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

		return apiSuccess({ revocation: result.data.revocation, status }, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
