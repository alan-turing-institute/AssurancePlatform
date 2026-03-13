import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const body = await request.json();
		const parsed = createCommentSchema.safeParse(body);
		if (!parsed.success) {
			throw validationError(parsed.error.issues[0]?.message ?? "Invalid input");
		}

		const result = await createCaseComment(
			caseId,
			parsed.data.content,
			parsed.data.parentId ?? null,
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
