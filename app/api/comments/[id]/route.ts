import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
} from "@/lib/api-response";
import { forbidden, notFound, validationError } from "@/lib/errors";

type CommentWithElement = {
	id: string;
	authorId: string;
	content: string;
	createdAt: Date;
	caseId: string | null;
	elementId: string | null;
	element: {
		caseId: string;
		name: string | null;
		description: string | null;
	} | null;
	author: { username: string };
};

type CommentPermissionResult = {
	comment: CommentWithElement;
	caseId: string;
	elementName: string | null;
};

/**
 * Fetches a comment and validates the user has permission to modify it.
 * Throws an AppError on failure.
 */
async function getCommentWithPermission(
	commentId: string,
	userId: string
): Promise<CommentPermissionResult> {
	const { prismaNew } = await import("@/lib/prisma");
	const { canAccessCase } = await import("@/lib/permissions");

	const comment = await prismaNew.comment.findUnique({
		where: { id: commentId },
		include: {
			element: { select: { caseId: true, name: true, description: true } },
			author: { select: { username: true } },
		},
	});

	if (!comment) {
		throw notFound("Comment");
	}

	const caseId = comment.element?.caseId ?? comment.caseId;

	if (!caseId) {
		throw validationError("Comment not associated with a case");
	}

	const isAuthor = comment.authorId === userId;
	const hasEditAccess = await canAccessCase({ userId, caseId }, "EDIT");

	if (!(isAuthor || hasEditAccess)) {
		throw forbidden();
	}

	const elementName = comment.element?.name || comment.element?.description;
	return { comment, caseId, elementName: elementName ?? null };
}

/**
 * DELETE /api/comments/[id]
 * Deletes a comment by ID
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: commentId } = await params;

		const { comment, caseId, elementName } = await getCommentWithPermission(
			commentId,
			session.userId
		);

		const { prismaNew } = await import("@/lib/prisma");
		await prismaNew.comment.delete({ where: { id: commentId } });

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username || session.email || "Someone";
		emitSSEEvent(
			"comment:deleted",
			caseId,
			{
				commentId,
				elementId: comment.elementId,
				elementName,
				username,
			},
			session.userId
		);

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/comments/[id]
 * Updates a comment by ID
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

		const { comment, caseId, elementName } = await getCommentWithPermission(
			commentId,
			session.userId
		);

		const { prismaNew } = await import("@/lib/prisma");
		const updatedComment = await prismaNew.comment.update({
			where: { id: commentId },
			data: { content: content.trim() },
			include: { author: { select: { username: true } } },
		});

		const response = {
			id: updatedComment.id,
			content: updatedComment.content,
			author: updatedComment.author.username,
			created_at: updatedComment.createdAt.toISOString(),
		};

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username || session.email || "Someone";
		emitSSEEvent(
			"comment:updated",
			caseId,
			{
				comment: response,
				elementId: comment.elementId,
				elementName,
				username,
			},
			session.userId
		);

		return apiSuccess(response);
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

		const { comment, caseId, elementName } = await getCommentWithPermission(
			commentId,
			session.userId
		);

		const { prismaNew } = await import("@/lib/prisma");

		const updateData = resolved
			? {
					resolved: true,
					resolvedById: session.userId,
					resolvedAt: new Date(),
				}
			: {
					resolved: false,
					resolvedById: null,
					resolvedAt: null,
				};

		const updatedComment = await prismaNew.comment.update({
			where: { id: commentId },
			data: updateData,
			include: {
				author: { select: { username: true } },
				resolvedBy: { select: { username: true } },
			},
		});

		const response = {
			id: updatedComment.id,
			content: updatedComment.content,
			author: updatedComment.author.username,
			authorId: updatedComment.authorId,
			created_at: updatedComment.createdAt.toISOString(),
			updated_at: updatedComment.updatedAt.toISOString(),
			resolved: updatedComment.resolved,
			resolvedBy: updatedComment.resolvedBy?.username ?? null,
			resolvedAt: updatedComment.resolvedAt?.toISOString() ?? null,
		};

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username || session.email || "Someone";
		emitSSEEvent(
			"comment:updated",
			caseId,
			{
				comment: response,
				elementId: comment.elementId,
				elementName,
				username,
			},
			session.userId
		);

		return apiSuccess(response);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
