"use server";

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

/**
 * Fetches threaded case-level comments (notes) for a given case.
 * Validates auth and permission before querying.
 */
export async function fetchCaseComments(
	caseId: string
): Promise<CommentResponse[] | null> {
	const session = await validateSession();
	if (!session) {
		return null;
	}

	const { prisma } = await import("@/lib/prisma");
	const { getCasePermission } = await import("@/lib/permissions");

	const permissionResult = await getCasePermission({
		userId: session.userId,
		caseId,
	});

	if (!permissionResult.hasAccess) {
		return null;
	}

	const allComments = await prisma.comment.findMany({
		where: { caseId, elementId: null },
		include: {
			author: { select: { username: true } },
			resolvedBy: { select: { username: true } },
		},
		orderBy: { createdAt: "asc" },
	});

	// Build threaded comment tree
	const commentMap = new Map<string, CommentResponse>();
	const topLevelComments: CommentResponse[] = [];

	for (const comment of allComments) {
		commentMap.set(comment.id, {
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
		});
	}

	for (const comment of allComments) {
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

	topLevelComments.sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);

	return topLevelComments;
}
