import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { updateAssuranceCaseSchema } from "@/lib/schemas/assurance-case";
import {
	fetchCaseFromPrisma,
	updateCaseWithPrisma,
} from "@/lib/services/case-fetch-service";

/**
 * Get an assurance case by ID
 *
 * @description Retrieves the full case structure including goals, strategies,
 * property claims, evidence, and comments. Requires VIEW permission.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - Full case data with nested elements
 * @response 401 - Unauthorised
 * @response 404 - Case not found or no access
 * @auth bearer
 * @tag Cases
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const data = await fetchCaseFromPrisma(id, userId);
		return apiSuccess(data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * Update case metadata
 *
 * @description Updates the name, description, or colour profile of a case.
 * Requires EDIT permission on the case.
 *
 * @pathParam id - Case ID (UUID)
 * @body { name?, description?, colourProfile?, layoutDirection? }
 * @response 200 - Updated case data
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @auth bearer
 * @tag Cases
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const raw = await request.json();
		const parsed = updateAssuranceCaseSchema.safeParse(raw);
		if (!parsed.success) {
			throw validationError(parsed.error.errors[0]?.message ?? "Invalid input");
		}
		const data = await updateCaseWithPrisma(id, userId, parsed.data);
		return apiSuccess(data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * Delete an assurance case (soft-delete)
 *
 * @description Moves a case to trash (soft-delete). Cases remain in trash for 30 days
 * before automatic purge. Requires ADMIN permission on the case.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - { success: true }
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (ADMIN required)
 * @response 404 - Case not found or already deleted
 * @auth bearer
 * @tag Cases
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const { softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);

		const result = await softDeleteCase(userId, id);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
