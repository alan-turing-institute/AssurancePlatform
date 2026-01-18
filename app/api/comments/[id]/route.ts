import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";

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

type AuthResult =
	| { success: true; userId: string; username: string }
	| { success: false; response: NextResponse };

type CommentResult =
	| {
			success: true;
			comment: CommentWithElement;
			caseId: string;
			elementName: string | null;
	  }
	| { success: false; response: NextResponse };

/**
 * Validates session using the unified validateSession wrapper.
 * Returns userId and username to avoid duplicate session calls.
 */
async function validateAuth(): Promise<AuthResult> {
	const validated = await validateSession();

	if (!validated) {
		return {
			success: false,
			response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
		};
	}

	return {
		success: true,
		userId: validated.userId,
		username: validated.username || validated.email || "Someone",
	};
}

/**
 * Fetches a comment and validates the user has permission to modify it.
 */
async function getCommentWithPermission(
	commentId: string,
	userId: string
): Promise<CommentResult> {
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
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Comment not found" },
				{ status: 404 }
			),
		};
	}

	const caseId = comment.element?.caseId ?? comment.caseId;

	if (!caseId) {
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Comment not associated with a case" },
				{ status: 400 }
			),
		};
	}

	const isAuthor = comment.authorId === userId;
	const hasEditAccess = await canAccessCase({ userId, caseId }, "EDIT");

	if (!(isAuthor || hasEditAccess)) {
		return {
			success: false,
			response: NextResponse.json(
				{ error: "Permission denied" },
				{ status: 403 }
			),
		};
	}

	const elementName = comment.element?.name || comment.element?.description;
	return { success: true, comment, caseId, elementName: elementName ?? null };
}

/**
 * DELETE /api/comments/[id]
 * Deletes a comment by ID
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: commentId } = await params;

	const authResult = await validateAuth();
	if (!authResult.success) {
		return authResult.response;
	}

	try {
		const commentResult = await getCommentWithPermission(
			commentId,
			authResult.userId
		);
		if (!commentResult.success) {
			return commentResult.response;
		}

		const { prismaNew } = await import("@/lib/prisma");
		await prismaNew.comment.delete({ where: { id: commentId } });

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		emitSSEEvent(
			"comment:deleted",
			commentResult.caseId,
			{
				commentId,
				elementId: commentResult.comment.elementId,
				elementName: commentResult.elementName,
				username: authResult.username,
			},
			authResult.userId
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting comment:", error);
		return NextResponse.json(
			{ error: "Failed to delete comment" },
			{ status: 500 }
		);
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
	const { id: commentId } = await params;

	const authResult = await validateAuth();
	if (!authResult.success) {
		return authResult.response;
	}

	try {
		const body = await request.json();
		const { content } = body;

		const isValidContent =
			content && typeof content === "string" && content.trim() !== "";
		if (!isValidContent) {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		const commentResult = await getCommentWithPermission(
			commentId,
			authResult.userId
		);
		if (!commentResult.success) {
			return commentResult.response;
		}

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
		emitSSEEvent(
			"comment:updated",
			commentResult.caseId,
			{
				comment: response,
				elementId: commentResult.comment.elementId,
				elementName: commentResult.elementName,
				username: authResult.username,
			},
			authResult.userId
		);

		return NextResponse.json(response);
	} catch (error) {
		console.error("Error updating comment:", error);
		return NextResponse.json(
			{ error: "Failed to update comment" },
			{ status: 500 }
		);
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
	const { id: commentId } = await params;

	const authResult = await validateAuth();
	if (!authResult.success) {
		return authResult.response;
	}

	try {
		const body = await request.json();
		const { resolved } = body;

		if (typeof resolved !== "boolean") {
			return NextResponse.json(
				{ error: "resolved must be a boolean" },
				{ status: 400 }
			);
		}

		const commentResult = await getCommentWithPermission(
			commentId,
			authResult.userId
		);
		if (!commentResult.success) {
			return commentResult.response;
		}

		const { prismaNew } = await import("@/lib/prisma");

		const updateData = resolved
			? {
					resolved: true,
					resolvedById: authResult.userId,
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
		emitSSEEvent(
			"comment:updated",
			commentResult.caseId,
			{
				comment: response,
				elementId: commentResult.comment.elementId,
				elementName: commentResult.elementName,
				username: authResult.username,
			},
			authResult.userId
		);

		return NextResponse.json(response);
	} catch (error) {
		console.error("Error updating comment resolution:", error);
		return NextResponse.json(
			{ error: "Failed to update comment" },
			{ status: 500 }
		);
	}
}
