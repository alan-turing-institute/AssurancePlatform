import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

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
 * GET /api/elements/[id]/comments
 * Gets all comments for an element with threading support
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { prismaNew } = await import("@/lib/prisma-new");
		const { canAccessCase } = await import("@/lib/permissions");

		// Get the element to find its case
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		if (!element) {
			return NextResponse.json({ error: "Element not found" }, { status: 404 });
		}

		// Check user has at least VIEW access to the case
		const hasAccess = await canAccessCase(
			{ userId: session.user.id, caseId: element.caseId },
			"VIEW"
		);

		if (!hasAccess) {
			return NextResponse.json({ error: "Permission denied" }, { status: 403 });
		}

		// Fetch all comments for this element (sorted ascending for tree building)
		const comments = await prismaNew.comment.findMany({
			where: { elementId },
			include: {
				author: { select: { username: true } },
				resolvedBy: { select: { username: true } },
			},
			orderBy: { createdAt: "asc" },
		});

		// Build and return the threaded comment tree
		return NextResponse.json(buildCommentTree(comments));
	} catch (error) {
		console.error("Error fetching comments:", error);
		return NextResponse.json(
			{ error: "Failed to fetch comments" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/elements/[id]/comments
 * Creates a new comment on an element (supports threading via parentId)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Business logic requires validation checks
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const content = body.content || body.comment;
		const parentId = body.parentId || null;

		if (!content || typeof content !== "string" || !content.trim()) {
			return NextResponse.json(
				{ error: "Comment content is required" },
				{ status: 400 }
			);
		}

		const { prismaNew } = await import("@/lib/prisma-new");
		const { canAccessCase } = await import("@/lib/permissions");

		// Get the element to find its case and name
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, name: true, description: true },
		});

		if (!element) {
			return NextResponse.json({ error: "Element not found" }, { status: 404 });
		}

		// Check user has at least COMMENT access to the case
		const hasAccess = await canAccessCase(
			{ userId: session.user.id, caseId: element.caseId },
			"COMMENT"
		);

		if (!hasAccess) {
			return NextResponse.json({ error: "Permission denied" }, { status: 403 });
		}

		// If replying to a parent comment, verify it exists and belongs to this element
		if (parentId) {
			const parentComment = await prismaNew.comment.findUnique({
				where: { id: parentId },
				select: { elementId: true },
			});

			if (!parentComment || parentComment.elementId !== elementId) {
				return NextResponse.json(
					{ error: "Parent comment not found" },
					{ status: 400 }
				);
			}
		}

		// Create the comment
		const comment = await prismaNew.comment.create({
			data: {
				elementId,
				content: content.trim(),
				authorId: session.user.id,
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
		const username = session.user.name || session.user.email || "Someone";
		emitSSEEvent(
			"comment:created",
			element.caseId,
			{
				comment: response,
				elementId,
				elementName: element.name || element.description,
				username,
			},
			session.user.id
		);

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error("Error creating comment:", error);
		return NextResponse.json(
			{ error: "Failed to create comment" },
			{ status: 500 }
		);
	}
}
