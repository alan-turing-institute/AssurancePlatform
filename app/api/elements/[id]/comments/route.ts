import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
} from "@/lib/api-response";
import { forbidden, notFound, validationError } from "@/lib/errors";

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
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const { prismaNew } = await import("@/lib/prisma");
		const { canAccessCase } = await import("@/lib/permissions");

		// Get the element to find its case (exclude deleted elements)
		const element = await prismaNew.assuranceElement.findFirst({
			where: { id: elementId, deletedAt: null },
			select: { caseId: true },
		});

		if (!element) {
			throw notFound("Element");
		}

		// Check user has at least VIEW access to the case
		const hasAccess = await canAccessCase(
			{ userId: session.userId, caseId: element.caseId },
			"VIEW"
		);

		if (!hasAccess) {
			throw forbidden();
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
		return apiSuccess(buildCommentTree(comments));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/elements/[id]/comments
 * Creates a new comment on an element (supports threading via parentId)
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const body = await request.json();
		const content = body.content || body.comment;
		const parentId = body.parentId || null;

		if (!content || typeof content !== "string" || !content.trim()) {
			return apiError(validationError("Comment content is required"));
		}

		const { prismaNew } = await import("@/lib/prisma");
		const { canAccessCase } = await import("@/lib/permissions");

		// Get the element to find its case and name (exclude deleted elements)
		const element = await prismaNew.assuranceElement.findFirst({
			where: { id: elementId, deletedAt: null },
			select: { caseId: true, name: true, description: true },
		});

		if (!element) {
			throw notFound("Element");
		}

		// Check user has at least COMMENT access to the case
		const hasAccess = await canAccessCase(
			{ userId: session.userId, caseId: element.caseId },
			"COMMENT"
		);

		if (!hasAccess) {
			throw forbidden();
		}

		// If replying to a parent comment, verify it exists and belongs to this element
		if (parentId) {
			const parentComment = await prismaNew.comment.findUnique({
				where: { id: parentId },
				select: { elementId: true },
			});

			if (!parentComment || parentComment.elementId !== elementId) {
				return apiError(validationError("Parent comment not found"));
			}
		}

		// Create the comment
		const comment = await prismaNew.comment.create({
			data: {
				elementId,
				content: content.trim(),
				authorId: session.userId,
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
		const username = session.username || session.email || "Someone";
		emitSSEEvent(
			"comment:created",
			element.caseId,
			{
				comment: response,
				elementId,
				elementName: element.name || element.description,
				username,
			},
			session.userId
		);

		return apiSuccess(response, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
