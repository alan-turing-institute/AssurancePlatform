import type { NextRequest } from "next/server";
import { apiErrorFromUnknown, requireAuth } from "@/lib/api-response";
import { mediaResponse } from "@/lib/media-response";
import { getCaseFeatureImageMedia } from "@/lib/services/case-information-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/media/feature
 *
 * @description Streams the case-information record's feature image,
 * access-checked on every fetch. Outside the JSON envelope, like the SSE
 * and health routes — the response body is the image itself. No session
 * returns the standard `/api/cases` 401 before any lookup; a session
 * without VIEW access and a case with no feature image both return an
 * identical empty 404, so a caller can never tell the two apart.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - The feature image's bytes
 * @response 401 - Unauthorised
 * @response 404 - No access, or no feature image stored
 * @auth bearer
 * @tag Cases
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const result = await getCaseFeatureImageMedia(userId, caseId);
		return mediaResponse(result, {
			ifNoneMatch: request.headers.get("if-none-match"),
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
