import type { NextRequest } from "next/server";
import { apiErrorFromUnknown, requireAuth } from "@/lib/api-response";
import { mediaResponse } from "@/lib/media-response";
import { getCaseScreenshotMedia } from "@/lib/services/case-image-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/media/screenshot
 *
 * @description Streams the case's dashboard-card screenshot, access-checked
 * on every fetch. Outside the JSON envelope, like the SSE and health routes
 * — the response body is the image itself. No session returns the
 * standard `/api/cases` 401 before any lookup; a session without VIEW access
 * and a case with no screenshot both return an identical empty 404, so a
 * caller can never tell the two apart.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - The screenshot's bytes
 * @response 401 - Unauthorised
 * @response 404 - No access, or no screenshot stored
 * @auth bearer
 * @tag Cases
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const result = await getCaseScreenshotMedia(userId, caseId);
		return mediaResponse(result);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
