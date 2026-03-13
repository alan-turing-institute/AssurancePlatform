import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { getPublishedCaseStudyById } from "@/lib/services/case-study-service";
import { transformCaseStudyForApi } from "@/lib/services/case-study-transforms";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/public/case-studies/[id]
 * Get a specific published case study (public access, no auth required)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const caseStudyId = Number.parseInt(id, 10);

		if (Number.isNaN(caseStudyId)) {
			return apiError(validationError("Invalid case study ID"));
		}

		const result = await getPublishedCaseStudyById(caseStudyId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(transformCaseStudyForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
