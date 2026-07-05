import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { revokeToken } from "@/lib/services/integration-registry-service";

/**
 * DELETE /api/integrations/[id]/tokens/[tokenId]
 *
 * Revokes a single token immediately — no grace period (unlike rotation's
 * overlap window). Owner-only — ownership rides the token's OWN
 * integration, not the path `[id]` (`revokeToken` doesn't take the path
 * integration id as a parameter).
 *
 * @pathParam id - Integration ID (UUID) — informational; not itself checked against the token's integration
 * @pathParam tokenId - Token ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Token not found (covers non-existent and not-owned — same message)
 * @response 409 - The token is already revoked
 * @auth SessionAuth
 * @tag Integrations
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; tokenId: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id, tokenId } = await params;

		const parsedId = uuidSchema.safeParse(id);
		const parsedTokenId = uuidSchema.safeParse(tokenId);
		if (!(parsedId.success && parsedTokenId.success)) {
			return apiError(validationError("Invalid id"));
		}

		const result = await revokeToken(parsedTokenId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
