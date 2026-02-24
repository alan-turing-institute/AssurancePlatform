import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
		const comments = await fetchCaseComments(caseId, userId);
		return apiSuccess(comments);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/cases/[id]/comments
 * Creates a new case-level comment (note).
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const body = await request.json();
		const { content, parentId } = body;

		if (!content || typeof content !== "string" || content.trim() === "") {
			return apiError(validationError("Content is required"));
		}

		const comment = await createCaseComment(
			caseId,
			content,
			parentId ?? null,
			userId
		);
		return apiSuccess(comment, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
