import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { suspendIntegration } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/suspend
 *
 * Suspends an ACTIVE integration (ACTIVE → SUSPENDED) — every token it has
 * issued stops authenticating for as long as it stays suspended, but
 * nothing is destroyed; `POST .../reactivate` reverses this. Owner-only.
 *
 * @description A REVOKED integration cannot be suspended (REVOKED is
 * terminal) — that request is a 409, not a silent status flip.
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The suspended integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
 * @response 409 - The integration is REVOKED (terminal — cannot be suspended)
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid integration id"));
		}

		const result = await suspendIntegration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
