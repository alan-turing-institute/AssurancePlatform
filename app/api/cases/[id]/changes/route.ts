import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { detectChanges } from "@/lib/services/change-detection-service";

/**
 * GET /api/cases/[id]/changes
 *
 * Detects changes between the current case content and its last published version.
 *
 * Query parameters:
 * - includeDetails: "true" to include change summary (addedElements, removedElements, modifiedElements)
 *
 * Returns:
 * {
 *   hasChanges: boolean;
 *   publishedAt: string | null;
 *   publishedId: string | null;
 *   changeSummary?: {
 *     addedElements: number;
 *     removedElements: number;
 *     modifiedElements: number;
 *   }
 * }
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		// Parse query parameters
		const url = new URL(request.url);
		const includeDetails = url.searchParams.get("includeDetails") === "true";

		const result = await detectChanges(userId, id, includeDetails);

		if (result === null) {
			return apiError(notFound("Case"));
		}

		return apiSuccess(result);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
