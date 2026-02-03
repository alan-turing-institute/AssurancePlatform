import { apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { getPublishedCaseStudies } from "@/lib/services/case-study-service";
import { transformCaseStudiesForApi } from "@/lib/services/case-study-transforms";

/**
 * GET /api/public/case-studies
 * List all published case studies (public access, no auth required)
 */
export async function GET() {
	try {
		const caseStudies = await getPublishedCaseStudies();
		return apiSuccess(transformCaseStudiesForApi(caseStudies));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
