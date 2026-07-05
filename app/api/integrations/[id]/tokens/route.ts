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
 * Issues a new bearer token for an ACTIVE integration. The plaintext
 * secret is returned EXACTLY ONCE, here, in this response — it is never
 * persisted anywhere, never shown again, and never appears in
 * `GET /api/integrations` (which shows only the token's prefix and
 * timestamps). Owner-only.
 *
 * @description `expiresAt` is optional — omitted means the token never
 * expires on its own (revocation is the primary kill switch; see
 * `issueToken`'s doc comment in `integration-registry-service.ts`). When
 * provided it must be in the future.
 * @pathParam id - Integration ID (UUID)
 * @body { expiresAt?: string }
 * @response 201 - `{ secret: string, token: { id, tokenPrefix, createdAt, expiresAt } }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
 * @response 409 - The integration is not ACTIVE
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

		const parsed = issueTokenSchema.safeParse(
			await request.json().catch(() => ({}))
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const result = await issueToken(parsedId.data, userId, {
			expiresAt: parsed.data.expiresAt,
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
