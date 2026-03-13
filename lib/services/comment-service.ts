import type { ValidatedSession } from "@/lib/auth/validate-session";
import { canAccessCase } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CommentResponse {
	author: string;
	authorId?: string;
	content: string;
	createdAt: string;
	id: string;
	parentId?: string | null;
	replies?: CommentResponse[];
	resolved?: boolean;
	resolvedAt?: string | null;
	resolvedBy?: string | null;
	updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PrismaComment {
	author: { username: string };
	authorId: string;
	content: string;
	createdAt: Date;
	id: string;
	parentCommentId: string | null;
	resolved: boolean;
	resolvedAt: Date | null;
	resolvedBy: { username: string } | null;
	updatedAt: Date;
}

interface CommentWithElement {
	author: { username: string };
	authorId: string;
	caseId: string | null;
	content: string;
	createdAt: Date;
	element: {
		caseId: string;
		name: string | null;
		description: string | null;
	} | null;
	elementId: string | null;
	id: string;
}

interface CommentPermissionResult {
	caseId: string;
	comment: CommentWithElement;
	elementName: string | null;
}

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
		createdAt: comment.createdAt.toISOString(),
		updatedAt: comment.updatedAt.toISOString(),
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
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);

	return topLevelComments;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Fetches a comment and validates the user has permission to modify it.
 * Returns "Permission denied" for not-found and forbidden to prevent enumeration.
 */
async function getCommentWithPermission(
	commentId: string,
	userId: string
): ServiceResult<CommentPermissionResult> {
	const comment = await prisma.comment.findUnique({
		where: { id: commentId },
		include: {
			element: { select: { caseId: true, name: true, description: true } },
			author: { select: { username: true } },
		},
	});

	if (!comment) {
		return { error: "Permission denied" };
	}

	const caseId = comment.element?.caseId ?? comment.caseId;

	if (!caseId) {
		return { error: "Comment not associated with a case" };
	}

	const isAuthor = comment.authorId === userId;
	const hasEditAccess = await canAccessCase({ userId, caseId }, "EDIT");

	if (!(isAuthor || hasEditAccess)) {
		return { error: "Permission denied" };
	}

	const elementName = comment.element?.name || comment.element?.description;
	return { data: { comment, caseId, elementName: elementName ?? null } };
}

// ---------------------------------------------------------------------------
// Case comment operations
// ---------------------------------------------------------------------------

/**
 * Fetches all case-level comments for a case as a threaded tree.
 * Returns "Permission denied" if the user has no access to the case.
 */
export async function fetchCaseComments(
	caseId: string,
	userId: string
): ServiceResult<CommentResponse[]> {
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	const allComments = await prisma.comment.findMany({
		where: { caseId, elementId: null },
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	return { data: buildCommentTree(allComments) };
}

/**
 * Creates a new case-level comment (note).
 * Returns "Permission denied" if the user lacks COMMENT permission.
 */
export async function createCaseComment(
	caseId: string,
	content: string,
	parentId: string | null,
	userId: string
): ServiceResult<CommentResponse> {
	const hasAccess = await canAccessCase({ userId, caseId }, "COMMENT");
	if (!hasAccess) {
		return { error: "Permission denied" };
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
	emitSSEEvent("comment:created", caseId, { comment: response, userId });

	return { data: response };
}

// ---------------------------------------------------------------------------
// Element comment operations
// ---------------------------------------------------------------------------

/**
 * Fetches all comments for an element as a threaded tree.
 * Returns "Permission denied" for not-found and forbidden to prevent enumeration.
 */
export async function fetchElementComments(
	elementId: string,
	userId: string
): ServiceResult<CommentResponse[]> {
	// Get the element to find its case (exclude deleted elements)
	const element = await prisma.assuranceElement.findFirst({
		where: { id: elementId, deletedAt: null },
		select: { caseId: true },
	});

	if (!element) {
		return { error: "Permission denied" };
	}

	// Check user has at least VIEW access to the case
	const hasAccess = await canAccessCase(
		{ userId, caseId: element.caseId },
		"VIEW"
	);

	if (!hasAccess) {
		return { error: "Permission denied" };
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

	return { data: buildCommentTree(comments) };
}

/**
 * Creates a new comment on an element (supports threading via parentId).
 * Returns "Permission denied" for not-found and forbidden to prevent enumeration.
 * Returns an error if the parentId does not exist on the element.
 */
export async function createElementComment(
	elementId: string,
	content: string,
	parentId: string | null,
	session: { userId: string; username: string | null; email: string | null }
): ServiceResult<CommentResponse> {
	// Get the element to find its case and name (exclude deleted elements)
	const element = await prisma.assuranceElement.findFirst({
		where: { id: elementId, deletedAt: null },
		select: { caseId: true, name: true, description: true },
	});

	if (!element) {
		return { error: "Permission denied" };
	}

	// Check user has at least COMMENT access to the case
	const hasAccess = await canAccessCase(
		{ userId: session.userId, caseId: element.caseId },
		"COMMENT"
	);

	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	// If replying to a parent comment, verify it exists and belongs to this element
	if (parentId) {
		const parentComment = await prisma.comment.findUnique({
			where: { id: parentId },
			select: { elementId: true },
		});

		if (!parentComment || parentComment.elementId !== elementId) {
			return { error: "Parent comment not found" };
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
	emitSSEEvent("comment:created", element.caseId, {
		comment: response,
		elementId,
		elementName: element.name || element.description,
		username,
		userId: session.userId,
	});

	return { data: response };
}

// ---------------------------------------------------------------------------
// Individual comment CRUD
// ---------------------------------------------------------------------------

/**
 * Deletes a comment by ID.
 * Returns "Permission denied" if the user is not the author and lacks EDIT access.
 */
export async function deleteComment(
	commentId: string,
	session: ValidatedSession
): ServiceResult<null> {
	const permissionResult = await getCommentWithPermission(
		commentId,
		session.userId
	);

	if ("error" in permissionResult) {
		return permissionResult;
	}

	const { comment, caseId, elementName } = permissionResult.data;

	await prisma.comment.delete({ where: { id: commentId } });

	// Emit SSE event for real-time updates
	const username = session.username || session.email || "Someone";
	emitSSEEvent("comment:deleted", caseId, {
		commentId,
		elementId: comment.elementId,
		elementName,
		username,
		userId: session.userId,
	});

	return { data: null };
}

interface UpdatedCommentData {
	author: string;
	content: string;
	createdAt: string;
	id: string;
}

/**
 * Updates the content of a comment by ID.
 * Returns "Permission denied" if the user is not the author and lacks EDIT access.
 */
export async function updateComment(
	commentId: string,
	content: string,
	session: ValidatedSession
): ServiceResult<UpdatedCommentData> {
	const permissionResult = await getCommentWithPermission(
		commentId,
		session.userId
	);

	if ("error" in permissionResult) {
		return permissionResult;
	}

	const {
		comment: existingComment,
		caseId,
		elementName,
	} = permissionResult.data;

	const updatedComment = await prisma.comment.update({
		where: { id: commentId },
		data: { content: content.trim() },
		include: { author: { select: { username: true } } },
	});

	const response: UpdatedCommentData = {
		id: updatedComment.id,
		content: updatedComment.content,
		author: updatedComment.author.username,
		createdAt: updatedComment.createdAt.toISOString(),
	};

	// Emit SSE event for real-time updates
	const username = session.username || session.email || "Someone";
	emitSSEEvent("comment:updated", caseId, {
		comment: response,
		elementId: existingComment.elementId,
		elementName,
		username,
		userId: session.userId,
	});

	return { data: response };
}

/**
 * Resolves or unresolves a comment thread.
 * Returns "Permission denied" if the user is not the author and lacks EDIT access.
 */
export async function resolveComment(
	commentId: string,
	resolved: boolean,
	session: ValidatedSession
): ServiceResult<CommentResponse> {
	const permissionResult = await getCommentWithPermission(
		commentId,
		session.userId
	);

	if ("error" in permissionResult) {
		return permissionResult;
	}

	const {
		comment: existingComment,
		caseId,
		elementName,
	} = permissionResult.data;

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
		createdAt: updatedComment.createdAt.toISOString(),
		updatedAt: updatedComment.updatedAt.toISOString(),
		resolved: updatedComment.resolved,
		resolvedBy: updatedComment.resolvedBy?.username ?? null,
		resolvedAt: updatedComment.resolvedAt?.toISOString() ?? null,
	};

	// Emit SSE event for real-time updates
	const username = session.username || session.email || "Someone";
	emitSSEEvent("comment:updated", caseId, {
		comment: response,
		elementId: existingComment.elementId,
		elementName,
		username,
		userId: session.userId,
	});

	return { data: response };
}
