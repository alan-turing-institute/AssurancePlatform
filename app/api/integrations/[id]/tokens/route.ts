import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { issueTokenSchema } from "@/lib/schemas/integration";
import { issueToken } from "@/lib/services/integration-registry-service";

/**
 * POST /api/integrations/[id]/tokens
 *
 * Issues a bearer token for an active integration.
 * The secret is returned once, in this response; it is never stored or shown
 * again, and listings show only the token's prefix and timestamps.
 * `expiresAt` is optional.
 * Without it the token does not expire on its own and stays valid until it is
 * revoked or rotated.
 * With it, the time must be in the future.
 * Only the owner can issue a token.
 *
 * @description Issues a bearer token for an active integration and returns its secret once; the token does not expire unless `expiresAt` is given.
 * @pathParam id - Integration ID (UUID)
 * @body { expiresAt?: string }
 * @response 201 - `{ secret: string, token: { id, tokenPrefix, createdAt, expiresAt } }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @response 409 - The integration is not active
 * @response 413 - Payload too large
 * @add 404,409
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid integration id"));
		}

		const data = await parseJsonBody(request, issueTokenSchema, {
			emptyBodyAs: {},
		});

		const result = await issueToken(parsedId.data, userId, {
			expiresAt: data.expiresAt,
		});
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(
			{
				secret: result.data.secret,
				token: {
					id: result.data.apiToken.id,
					tokenPrefix: result.data.apiToken.tokenPrefix,
					createdAt: result.data.apiToken.createdAt,
					expiresAt: result.data.apiToken.expiresAt,
				},
			},
			201
		);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
