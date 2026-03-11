import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { getPublishedCaseStudies } from "@/lib/services/case-study-service";
import { transformCaseStudiesForApi } from "@/lib/services/case-study-transforms";

/**
 * GET /api/public/case-studies
 * List all published case studies (public access, no auth required)
 */
export async function GET() {
	try {
		const result = await getPublishedCaseStudies();
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(transformCaseStudiesForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
