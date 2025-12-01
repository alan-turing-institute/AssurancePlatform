import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

type CommentWithElement = {
	id: string;
	authorId: string;
	content: string;
	createdAt: Date;
	caseId: string | null;
	element: { caseId: string } | null;
	author: { username: string };
};

type AuthResult =
	| { success: true; userId: string }
	| { success: false; response: NextResponse };

type CommentResult =
	| { success: true; comment: CommentWithElement; caseId: string }
	| { success: false; response: NextResponse };

/**
 * Validates session and refresh token for Prisma auth.
 */
async function validateAuth(): Promise<AuthResult> {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return {
			success: false,
			response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
		};
	}

	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);

	const validation = await validateRefreshToken(session.key);
	if (!validation.valid) {
		return {
			success: false,
			response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
		};
	}

	return { success: true, userId: validation.userId };
}

/**
 * Fetches a comment and validates the user has permission to modify it.
 */
async function getCommentWithPermission(
	commentId: string,
	userId: string
): Promise<CommentResult> {
	const { prismaNew } = await import("@/lib/prisma-new");
	const { canAccessCase } = await import("@/lib/permissions");

	const comment = await prismaNew.comment.findUnique({
		where: { id: commentId },
		include: {
			element: { select: { caseId: true } },
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

	return { success: true, comment, caseId };
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

	if (!USE_PRISMA_AUTH) {
		return NextResponse.json(
			{ error: "Use type-specific Django endpoints" },
			{ status: 501 }
		);
	}

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

		const { prismaNew } = await import("@/lib/prisma-new");
		await prismaNew.comment.delete({ where: { id: commentId } });

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

	if (!USE_PRISMA_AUTH) {
		return NextResponse.json(
			{ error: "Use type-specific Django endpoints" },
			{ status: 501 }
		);
	}

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

		const { prismaNew } = await import("@/lib/prisma-new");
		const updatedComment = await prismaNew.comment.update({
			where: { id: commentId },
			data: { content: content.trim() },
			include: { author: { select: { username: true } } },
		});

		return NextResponse.json({
			id: updatedComment.id,
			content: updatedComment.content,
			author: updatedComment.author.username,
			created_at: updatedComment.createdAt.toISOString(),
		});
	} catch (error) {
		console.error("Error updating comment:", error);
		return NextResponse.json(
			{ error: "Failed to update comment" },
			{ status: 500 }
		);
	}
}
