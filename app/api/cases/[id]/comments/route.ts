import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";

type CommentResponse = {
	id: string;
	content: string;
	author: string;
	authorId?: string;
	created_at: string;
	updated_at?: string;
	parentId?: string | null;
	replies?: CommentResponse[];
	resolved?: boolean;
	resolvedBy?: string | null;
	resolvedAt?: string | null;
};

type PrismaComment = {
	id: string;
	content: string;
	authorId: string;
	createdAt: Date;
	updatedAt: Date;
	parentCommentId: string | null;
	resolved: boolean;
	resolvedAt: Date | null;
	author: { username: string };
	resolvedBy: { username: string } | null;
};

/**
 * Transforms a Prisma comment to the API response format.
 */
function toCommentResponse(comment: PrismaComment): CommentResponse {
	return {
		id: comment.id,
		content: comment.content,
		author: comment.author.username,
		authorId: comment.authorId,
		created_at: comment.createdAt.toISOString(),
		updated_at: comment.updatedAt.toISOString(),
		parentId: comment.parentCommentId,
		replies: [],
		resolved: comment.resolved,
		resolvedBy: comment.resolvedBy?.username ?? null,
		resolvedAt: comment.resolvedAt?.toISOString() ?? null,
	};
}

/**
 * Builds a threaded comment tree from a flat list of comments.
 */
function buildCommentTree(comments: PrismaComment[]): CommentResponse[] {
	const commentMap = new Map<string, CommentResponse>();
	const topLevelComments: CommentResponse[] = [];

	// First pass: create all comment objects
	for (const comment of comments) {
		commentMap.set(comment.id, toCommentResponse(comment));
	}

	// Second pass: build the tree structure
	for (const comment of comments) {
		const commentResponse = commentMap.get(comment.id);
		if (!commentResponse) {
			continue;
		}

		if (comment.parentCommentId) {
			const parent = commentMap.get(comment.parentCommentId);
			parent?.replies?.push(commentResponse);
		} else {
			topLevelComments.push(commentResponse);
		}
	}

	// Sort top-level comments newest first
	topLevelComments.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	return topLevelComments;
}

/**
 * Fetches comments using Prisma and returns threaded results.
 */
async function fetchPrismaComments(
	caseId: string,
	userId: string
): Promise<NextResponse> {
	const { prismaNew } = await import("@/lib/prisma");
	const { getCasePermission } = await import("@/lib/permissions");

	const permissionResult = await getCasePermission({
		userId,
		caseId,
	});

	if (!permissionResult.hasAccess) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const allComments = await prismaNew.comment.findMany({
		where: { caseId, elementId: null },
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	return NextResponse.json(buildCommentTree(allComments));
}

/**
 * GET /api/cases/[id]/comments
 * Returns all case-level comments (notes) for a case.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;

	return fetchPrismaComments(caseId, validated.userId);
}

/**
 * Creates a comment using Prisma.
 */
async function createPrismaComment(
	caseId: string,
	content: string,
	parentId: string | null,
	userId: string
): Promise<NextResponse> {
	const { prismaNew } = await import("@/lib/prisma");
	const { getCasePermission, hasPermissionLevel } = await import(
		"@/lib/permissions"
	);

	const permissionResult = await getCasePermission({
		userId,
		caseId,
	});

	const canComment =
		permissionResult.hasAccess &&
		permissionResult.permission &&
		hasPermissionLevel(permissionResult.permission, "COMMENT");

	if (!canComment) {
		return NextResponse.json({ error: "Permission denied" }, { status: 403 });
	}

	const comment = await prismaNew.comment.create({
		data: {
			caseId,
			authorId: userId,
			content: content.trim(),
			parentCommentId: parentId,
		},
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
	});

	const response: CommentResponse = {
		id: comment.id,
		content: comment.content,
		author: comment.author.username,
		authorId: comment.authorId,
		created_at: comment.createdAt.toISOString(),
		updated_at: comment.updatedAt.toISOString(),
		parentId: comment.parentCommentId,
		replies: [],
		resolved: comment.resolved,
		resolvedBy: comment.resolvedBy?.username ?? null,
		resolvedAt: comment.resolvedAt?.toISOString() ?? null,
	};

	// Emit SSE event for real-time updates
	const { emitSSEEvent } = await import(
		"@/lib/services/sse-connection-manager"
	);
	emitSSEEvent("comment:created", caseId, { comment: response }, userId);

	return NextResponse.json(response, { status: 201 });
}

/**
 * POST /api/cases/[id]/comments
 * Creates a new case-level comment (note).
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { id: caseId } = await params;

	try {
		const body = await request.json();
		const { content, parentId } = body;

		if (!content || typeof content !== "string" || content.trim() === "") {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		return createPrismaComment(
			caseId,
			content,
			parentId ?? null,
			validated.userId
		);
	} catch (error) {
		console.error("Error creating comment:", error);
		return NextResponse.json(
			{ error: "Failed to create comment" },
			{ status: 500 }
		);
	}
}
