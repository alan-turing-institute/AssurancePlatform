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
 * integration, not the path `[id]`. The path `[id]` IS still checked,
 * though, for a different reason: a `tokenId` that exists and is owned by
 * the caller but actually belongs to a DIFFERENT integration the caller
 * also owns is rejected with the exact same generic 404 as a nonexistent
 * `tokenId` (deviation-5 fix, work item 2 — no enumeration oracle, and no
 * cross-integration token operations via a mismatched path).
 *
 * @pathParam id - Integration ID (UUID) — checked against the token's OWN integration; a mismatch is a 404 identical to a nonexistent tokenId
 * @pathParam tokenId - Token ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Token not found (covers non-existent, not-owned, and belonging to a different integration than the path — same message)
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
