import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { handleHealthRecordAction } from "@/lib/health-route-helpers";
import { revocationRequestSchema } from "@/lib/schemas/health-evidence";
import { revokeHealthEvidence } from "@/lib/services/health-evidence-service";

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
export function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; recordId: string }> }
) {
	return handleHealthRecordAction(
		request,
		params,
		revocationRequestSchema,
		revokeHealthEvidence,
		(data, status) => apiSuccess({ revocation: data.revocation, status }, 201)
	);
}
