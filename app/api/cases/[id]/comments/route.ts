import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { createCommentSchema } from "@/lib/schemas/comment";
import {
	createCaseComment,
	fetchCaseComments,
} from "@/lib/services/comment-service";

/**
 * GET /api/cases/[id]/comments
 * Returns all case-level comments (notes) for a case.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;
		const result = await fetchCaseComments(caseId, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/comments
 * Creates a new case-level comment (note).
 * @response 413 - Payload too large
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const data = await parseJsonBody(request, createCommentSchema);

		const result = await createCaseComment(
			caseId,
			data.content,
			data.parentId ?? null,
			userId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
