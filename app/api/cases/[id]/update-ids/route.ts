import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { resetIdentifiers } from "@/lib/services/identifier-service";

/**
 * POST /api/cases/[id]/update-ids
 * Resets all element identifiers (names) with hierarchical naming for property claims.
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const result = await resetIdentifiers(caseId, userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ message: "Identifiers reset successfully" });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
