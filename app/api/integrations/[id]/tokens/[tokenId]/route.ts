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
 * Revokes one token at once, with no overlap.
 * The integration in the path must be the one the token belongs to; otherwise
 * the answer is the same 404 as for a token that does not exist.
 * Only the owner can revoke a token.
 *
 * @description Revokes a single token immediately; revoking a token that is already revoked is a 409.
 * @pathParam id - Integration ID (UUID), which must be the integration the token belongs to
 * @pathParam tokenId - Token ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Token not found (covers non-existent, not-owned, and belonging to a different integration than the path, with the same message)
 * @response 409 - The token is already revoked
 * @add 404,409
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

		const result = await revokeToken(parsedTokenId.data, userId, {
			integrationId: parsedId.data,
		});
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
