import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import {
	resolveCommentSchema,
	updateCommentSchema,
} from "@/lib/schemas/comment";
import {
	deleteComment,
	resolveComment,
	updateComment,
} from "@/lib/services/comment-service";

/**
 * DELETE /api/comments/[id]
 * Deletes a comment by ID.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;
		const result = await deleteComment(commentId, session);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/comments/[id]
 * Updates a comment by ID.
 * @response 413 - Payload too large
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;
		const data = await parseJsonBody(request, updateCommentSchema);

		const result = await updateComment(commentId, data.content, session);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PATCH /api/comments/[id]
 * Resolves or unresolves a comment thread.
 * @response 413 - Payload too large
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;
		const data = await parseJsonBody(request, resolveCommentSchema);

		const result = await resolveComment(commentId, data.resolved, session);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
