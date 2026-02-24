"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { CommentResponse } from "@/lib/services/comment-service";

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

	try {
		const { fetchCaseComments: fetchComments } = await import(
			"@/lib/services/comment-service"
		);
		return await fetchComments(caseId, session.userId);
	} catch {
		return null;
	}
}
