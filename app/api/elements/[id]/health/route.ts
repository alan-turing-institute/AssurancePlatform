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
import { readHealthState } from "@/lib/services/health-scoring-service";

/**
 * GET /api/elements/[id]/health
 *
 * The `tea.health` plugin's per-claim score read (ADR 0002 v2 §3) — the
 * `element-badge`/`element-panel` UI slots' data source for
 * `{ score, lastEvaluatedAt, validityWindowSeconds }`. Human session only,
 * mirroring the auth shape of sibling routes in `app/api/elements/[id]/*`
 * (comments, attach, detach, move) rather than the machine-token dual-auth
 * of `/api/machine/health/elements/[id]/evidence`: no integration needs to
 * read a derived score directly, only the evidence log it writes.
 *
 * @description Refuses with a clean error (never a 500) when `tea.health`
 * is unavailable/disabled for the session user, or when the element isn't a
 * claim this session can access. `health: null` (200, not an error) means
 * the claim exists and is accessible but has never been scored.
 * @response 200 - `{ health: { score, lastEvaluatedAt, validityWindowSeconds } | null }`
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

		const result = await readHealthState(session.userId, parsedId.data);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ health: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
