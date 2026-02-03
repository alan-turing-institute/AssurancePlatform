import {
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { getCasesAvailableForCaseStudy } from "@/lib/services/publish-service";

/**
 * GET /api/published-assurance-cases
 *
 * Returns assurance cases that can be linked to case studies.
 * Returns cases owned by the current user with
 * publishStatus in (READY_TO_PUBLISH, PUBLISHED).
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const cases = await getCasesAvailableForCaseStudy(userId);

		// Transform to API response format
		const response = cases.map((c) => ({
			id: c.id,
			name: c.name,
			description: c.description,
			publish_status: c.publishStatus,
			published_at: c.publishedAt?.toISOString() ?? null,
			marked_ready_at: c.markedReadyAt?.toISOString() ?? null,
			published_version_id: c.publishedVersionId,
		}));

		return apiSuccess(response);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
