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
 * Updates an integration's description and/or scopes. Owner-only — a
 * non-owner gets the exact same 404 as a nonexistent id (no enumeration
 * oracle; `getOwnedIntegrationOrError` in the service layer).
 *
 * @description At least one of `description`/`scopes` must be present.
 * `scopes` is validated against the closed vocabulary in
 * `lib/auth/scopes.ts` — an unknown scope is a 400.
 * @pathParam id - Integration ID (UUID)
 * @body { description?: string, scopes?: string[] }
 * @response 200 - The updated integration
 * @response 400 - Validation error (including an unknown scope)
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
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

		const parsed = updateIntegrationSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const result = await updateIntegration(
			parsedId.data,
			{ description: parsed.data.description, scopes: parsed.data.scopes },
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
 * Deletes an integration's registration outright — its dedicated system
 * user artefacts and every one of its tokens go with it (cascade), per
 * `deleteIntegrationRegistration`'s existing semantics, unchanged here.
 * Owner-only — a non-owner gets the exact same 404 as a nonexistent id (no
 * enumeration oracle; `getOwnedIntegrationOrError` in the service layer).
 *
 * @description Prefer `POST .../revoke` when the integration's own
 * accountability trail matters (it keeps the row, terminally revoked);
 * use this when a human owner needs the row itself gone, with no new
 * owner to reassign to (`deleteIntegrationRegistration`'s doc comment).
 * @pathParam id - Integration ID (UUID)
 * @response 200 - `{ success: true }`
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
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
