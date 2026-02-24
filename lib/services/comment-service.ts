import type { ValidatedSession } from "@/lib/auth/validate-session";
import { forbidden, notFound, validationError } from "@/lib/errors";
import {
	canAccessCase,
	getCasePermission,
	hasPermissionLevel,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CommentResponse = {
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

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Transforms a Prisma comment to the API response format.
 */
export function toCommentResponse(comment: PrismaComment): CommentResponse {
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
export function buildCommentTree(comments: PrismaComment[]): CommentResponse[] {
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

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Fetches a comment and validates the user has permission to modify it.
 * Throws `notFound()` if comment doesn't exist or isn't associated with a case.
 * Throws `forbidden()` if the user is neither the author nor has EDIT access.
 */
async function getCommentWithPermission(
	commentId: string,
	userId: string
): Promise<CommentPermissionResult> {
	const comment = await prisma.comment.findUnique({
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
		throw notFound("Comment");
	}

	const elementName = comment.element?.name || comment.element?.description;
	return { comment, caseId, elementName: elementName ?? null };
}

// ---------------------------------------------------------------------------
// Case comment operations
// ---------------------------------------------------------------------------

/**
 * Fetches all case-level comments for a case as a threaded tree.
 * Throws `notFound()` if the user has no access to the case.
 */
export async function fetchCaseComments(
	caseId: string,
	userId: string
): Promise<CommentResponse[]> {
	const permissionResult = await getCasePermission({ userId, caseId });

	if (!permissionResult.hasAccess) {
		throw notFound();
	}

	const allComments = await prisma.comment.findMany({
		where: { caseId, elementId: null },
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	return buildCommentTree(allComments);
}

/**
 * Creates a new case-level comment (note).
 * Throws `forbidden()` if the user lacks COMMENT permission.
 */
export async function createCaseComment(
	caseId: string,
	content: string,
	parentId: string | null,
	userId: string
): Promise<CommentResponse> {
	const permissionResult = await getCasePermission({ userId, caseId });

	const canComment =
		permissionResult.hasAccess &&
		permissionResult.permission &&
		hasPermissionLevel(permissionResult.permission, "COMMENT");

	if (!canComment) {
		throw forbidden();
	}

	const comment = await prisma.comment.create({
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

	const response = toCommentResponse(comment);

	// Emit SSE event for real-time updates
	emitSSEEvent("comment:created", caseId, { comment: response }, userId);

	return response;
}

// ---------------------------------------------------------------------------
// Element comment operations
// ---------------------------------------------------------------------------

/**
 * Fetches all comments for an element as a threaded tree.
 * Throws `notFound("Element")` if element doesn't exist.
 * Throws `forbidden()` if the user has no VIEW access to the case.
 */
export async function fetchElementComments(
	elementId: string,
	userId: string
): Promise<CommentResponse[]> {
	// Get the element to find its case (exclude deleted elements)
	const element = await prisma.assuranceElement.findFirst({
		where: { id: elementId, deletedAt: null },
		select: { caseId: true },
	});

	if (!element) {
		throw notFound("Element");
	}

	// Check user has at least VIEW access to the case
	const hasAccess = await canAccessCase(
		{ userId, caseId: element.caseId },
		"VIEW"
	);

	if (!hasAccess) {
		throw notFound("Element");
	}

	// Fetch all comments for this element (sorted ascending for tree building)
	const comments = await prisma.comment.findMany({
		where: { elementId },
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	return buildCommentTree(comments);
}

/**
 * Creates a new comment on an element (supports threading via parentId).
 * Throws `notFound("Element")` if element doesn't exist.
 * Throws `forbidden()` if the user lacks COMMENT access to the case.
 * Throws `validationError("Parent comment not found")` if parentId is invalid.
 */
export async function createElementComment(
	elementId: string,
	content: string,
	parentId: string | null,
	session: { userId: string; username: string | null; email: string | null }
): Promise<CommentResponse> {
	// Get the element to find its case and name (exclude deleted elements)
	const element = await prisma.assuranceElement.findFirst({
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
		throw notFound("Element");
	}

	// If replying to a parent comment, verify it exists and belongs to this element
	if (parentId) {
		const parentComment = await prisma.comment.findUnique({
			where: { id: parentId },
			select: { elementId: true },
		});

		if (!parentComment || parentComment.elementId !== elementId) {
			throw validationError("Parent comment not found");
		}
	}

	// Create the comment
	const comment = await prisma.comment.create({
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

	const response = toCommentResponse(comment);

	// Emit SSE event for real-time updates
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

	return response;
}

// ---------------------------------------------------------------------------
// Individual comment CRUD
// ---------------------------------------------------------------------------

/**
 * Deletes a comment by ID.
 * Throws `notFound("Comment")` or `forbidden()` if unauthorised.
 */
export async function deleteComment(
	commentId: string,
	session: ValidatedSession
): Promise<{ success: true }> {
	const { comment, caseId, elementName } = await getCommentWithPermission(
		commentId,
		session.userId
	);

	await prisma.comment.delete({ where: { id: commentId } });

	// Emit SSE event for real-time updates
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

	return { success: true };
}

/**
 * Updates the content of a comment by ID.
 * Throws `notFound("Comment")` or `forbidden()` if unauthorised.
 */
export async function updateComment(
	commentId: string,
	content: string,
	session: ValidatedSession
): Promise<{
	id: string;
	content: string;
	author: string;
	created_at: string;
}> {
	const {
		comment: existingComment,
		caseId,
		elementName,
	} = await getCommentWithPermission(commentId, session.userId);

	const updatedComment = await prisma.comment.update({
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
	const username = session.username || session.email || "Someone";
	emitSSEEvent(
		"comment:updated",
		caseId,
		{
			comment: response,
			elementId: existingComment.elementId,
			elementName,
			username,
		},
		session.userId
	);

	return response;
}

/**
 * Resolves or unresolves a comment thread.
 * Throws `notFound("Comment")` or `forbidden()` if unauthorised.
 */
export async function resolveComment(
	commentId: string,
	resolved: boolean,
	session: ValidatedSession
): Promise<CommentResponse> {
	const {
		comment: existingComment,
		caseId,
		elementName,
	} = await getCommentWithPermission(commentId, session.userId);

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

	const updatedComment = await prisma.comment.update({
		where: { id: commentId },
		data: updateData,
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
	});

	const response: CommentResponse = {
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
	const username = session.username || session.email || "Someone";
	emitSSEEvent(
		"comment:updated",
		caseId,
		{
			comment: response,
			elementId: existingComment.elementId,
			elementName,
			username,
		},
		session.userId
	);

	return response;
}
