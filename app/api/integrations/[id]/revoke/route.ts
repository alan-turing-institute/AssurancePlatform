import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { revokeIntegration } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/revoke
 *
 * Revokes an integration permanently (→ REVOKED) and, in the same
 * transaction, revokes every one of its currently-unrevoked tokens.
 * Terminal — there is no un-revoke (`reactivate` refuses a REVOKED
 * integration). Owner-only, audited.
 *
 * @pathParam id - Integration ID (UUID)
 * @response 200 - The revoked integration
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
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

		const result = await revokeIntegration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
