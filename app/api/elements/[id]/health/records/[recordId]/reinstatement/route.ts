import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { handleHealthRecordAction } from "@/lib/health-route-helpers";
import { reinstatementRequestSchema } from "@/lib/schemas/health-evidence";
import { reinstateHealthEvidence } from "@/lib/services/health-evidence-service";

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
export function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; recordId: string }> }
) {
	return handleHealthRecordAction(
		request,
		params,
		reinstatementRequestSchema,
		reinstateHealthEvidence,
		(_data, status) => apiSuccess({ status })
	);
}
