import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
		return apiSuccess(result);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/comments/[id]
 * Updates a comment by ID.
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;
		const body = await request.json();
		const { content } = body;

		const isValidContent =
			content && typeof content === "string" && content.trim() !== "";
		if (!isValidContent) {
			return apiError(validationError("Content is required"));
		}

		const result = await updateComment(commentId, content, session);
		return apiSuccess(result);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PATCH /api/comments/[id]
 * Resolves or unresolves a comment thread.
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;
		const body = await request.json();
		const { resolved } = body;

		if (typeof resolved !== "boolean") {
			return apiError(validationError("resolved must be a boolean"));
		}

		const result = await resolveComment(commentId, resolved, session);
		return apiSuccess(result);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
