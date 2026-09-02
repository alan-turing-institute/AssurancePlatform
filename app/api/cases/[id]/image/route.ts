import type { NextRequest } from "next/server";
import { JSON_BODY_LIMITS, parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { caseImageUploadSchema } from "@/lib/schemas/case-image";
import {
	getCaseImage,
	uploadCaseImage,
} from "@/lib/services/case-image-service";

/**
 * GET /api/cases/[id]/image
 * Fetches the screenshot image URL for a case.
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const result = await getCaseImage(userId, caseId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/image
 * Uploads a new screenshot for a case with throttling.
 * @response 413 - Payload too large
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const { image } = await parseJsonBody(request, caseImageUploadSchema, {
			maxBytes: JSON_BODY_LIMITS.caseImage,
		});

		const result = await uploadCaseImage(userId, caseId, image);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		if ("throttled" in result.data) {
			return apiSuccess({
				message: "Throttled",
				nextAllowedAt: result.data.nextAllowedAt,
			});
		}

		return apiSuccess({
			success: true,
			image: result.data.image,
			uploadedAt: result.data.uploadedAt,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
