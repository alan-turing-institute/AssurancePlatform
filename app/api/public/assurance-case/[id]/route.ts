import type { NextRequest } from "next/server";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { getPublishedAssuranceCaseById } from "@/lib/services/case-study-service";
import { transformPublishedCaseForApi } from "@/lib/services/case-study-transforms";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/public/assurance-case/[id]
 * Get a published assurance case by ID (public access, no auth required)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;

		const result = await getPublishedAssuranceCaseById(id);

		if ("error" in result) {
			return apiError(notFound("Published assurance case"));
		}

		return apiSuccess(transformPublishedCaseForApi(result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
