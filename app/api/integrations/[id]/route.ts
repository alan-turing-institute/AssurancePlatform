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
import { updateIntegrationSchema } from "@/lib/schemas/integration";
import {
	deleteIntegrationRegistration,
	updateIntegration,
} from "@/lib/services/integration-registry-service";

/**
 * PATCH /api/integrations/[id]
 *
 * Updates an integration's description, its scopes, or both.
 * The scopes sent replace the existing list, so send every scope the
 * integration should hold.
 * Only the owner can update an integration; anyone else gets the same 404 as
 * for an id that does not exist.
 *
 * @description Updates an integration's description and/or scopes (at least one is required); the scopes sent replace the existing list, and an unknown scope is a 400.
 * @pathParam id - Integration ID (UUID)
 * @body { description?: string, scopes?: string[] }
 * @response 200 - The updated integration
 * @response 400 - Validation error (including an unknown scope)
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @response 413 - Payload too large
 * @add 404
 * @auth SessionAuth
 * @tag Integrations
 */
export async function PATCH(
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

		const data = await parseJsonBody(request, updateIntegrationSchema);

		const result = await updateIntegration(
			parsedId.data,
			{ description: data.description, scopes: data.scopes },
			userId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ integration: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/integrations/[id]
 *
 * Deletes an integration with its account and every one of its tokens.
 * Evidence the integration already sent stays in the log, but the record of
 * who sent it no longer resolves to an account.
 * Revoking the integration with `POST .../revoke` keeps the account, so that
 * record stays resolvable.
 * Only the owner can delete an integration; anyone else gets the same 404 as
 * for an id that does not exist.
 *
 * @description Deletes an integration with its account and tokens; revoke it instead when the record of who sent its evidence must stay resolvable.
 * @pathParam id - Integration ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @add 404
 * @auth SessionAuth
 * @tag Integrations
 */
export async function DELETE(
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

		const result = await deleteIntegrationRegistration(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
