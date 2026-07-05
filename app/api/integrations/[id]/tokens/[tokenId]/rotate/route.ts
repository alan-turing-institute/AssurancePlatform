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
 * Issues a replacement token and brings the old token's expiry forward to
 * a short overlap window (both authenticate during it — see
 * `TOKEN_ROTATION_OVERLAP_MS` in `integration-registry-service.ts`). The
 * new plaintext secret is returned EXACTLY ONCE, here. Owner-only —
 * ownership rides the token's OWN integration, not the path `[id]`
 * (`rotateToken` doesn't take the path integration id as a parameter).
 *
 * @description Refuses a token that is already revoked, or whose
 * integration isn't ACTIVE.
 * @pathParam id - Integration ID (UUID) — informational; not itself checked against the token's integration
 * @pathParam tokenId - Token ID (UUID)
 * @response 200 - `{ secret, token: { id, tokenPrefix, createdAt, expiresAt }, oldTokenId, overlapUntil }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Token not found (covers non-existent and not-owned — same message)
 * @response 409 - The token is already revoked, or its integration isn't ACTIVE
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

		const result = await rotateToken(parsedTokenId.data, userId);
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
