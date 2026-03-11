import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		let body: { image?: string };
		try {
			body = await request.json();
		} catch {
			return apiError(validationError("Invalid request body"));
		}

		const { image } = body;
		if (!image) {
			return apiError(validationError("Missing image data"));
		}

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
