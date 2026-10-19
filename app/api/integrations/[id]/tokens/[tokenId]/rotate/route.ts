import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { rotateToken } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/tokens/[tokenId]/rotate
 *
 * Issues a replacement token and moves the old token's expiry to 24 hours from
 * now, or leaves it where it is if it already expires sooner.
 * Both tokens work during that overlap, so the client can switch without a
 * break.
 * The new secret is returned once, in this response.
 * The integration in the path must be the one the token belongs to; otherwise
 * the answer is the same 404 as for a token that does not exist.
 * Only the owner can rotate a token.
 *
 * @description Issues a replacement token (secret returned once) and limits the old token to a 24-hour overlap; a revoked token, or a token of an integration that is not active, is refused with 409.
 * @pathParam id - Integration ID (UUID), which must be the integration the token belongs to
 * @pathParam tokenId - Token ID (UUID)
 * @response 200 - `{ secret, token: { id, tokenPrefix, createdAt, expiresAt }, oldTokenId, overlapUntil }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Token not found (covers non-existent, not-owned, and belonging to a different integration than the path, with the same message)
 * @response 409 - The token is already revoked, or its integration is not active
 * @add 404,409
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(
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

		const result = await rotateToken(parsedTokenId.data, userId, {
			integrationId: parsedId.data,
		});
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			secret: result.data.newToken.secret,
			token: {
				id: result.data.newToken.apiToken.id,
				tokenPrefix: result.data.newToken.apiToken.tokenPrefix,
				createdAt: result.data.newToken.apiToken.createdAt,
				expiresAt: result.data.newToken.apiToken.expiresAt,
			},
			oldTokenId: result.data.oldTokenId,
			overlapUntil: result.data.overlapUntil,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
