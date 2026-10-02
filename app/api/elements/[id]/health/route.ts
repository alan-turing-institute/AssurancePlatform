import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { readHealthStatus } from "@/lib/services/health-status-service";

/**
 * GET /api/elements/[id]/health
 *
 * The `tea.health` plugin's per-claim status read — the data source for the
 * `element-badge` and `element-panel` UI slots. Human session only: no
 * integration needs a derived status directly, only the evidence log it
 * writes. The status is computed from the claim's evidence on every call,
 * so every viewer of a claim gets the same answer.
 *
 * @description Refuses with a clean error (never a 500) when `tea.health`
 * is unavailable/disabled for the session user, or when the element isn't a
 * claim this session can access. `status: null` (200, not an error) means
 * the claim exists and is accessible but has never had a record accepted.
 * @response 200 - `{ status: { verdict, stale, stale_reason, stale_since, expires_at, record_id, timestamp, bound_check, rejected_since_last_accept } | null }`
 * @response 400 - `id` is not a UUID
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (covers non-existent, soft-deleted, and no-access — same message, no enumeration oracle)
 * @auth SessionAuth
 * @tag Elements
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid element id"));
		}

		const result = await readHealthStatus(session.userId, parsedId.data);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ status: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
