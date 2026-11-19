import type { CommentResponse } from "@/lib/services/comment-service";

/**
 * Whether the signed-in person wrote the comment. User ids decide when both
 * sides have one; otherwise the names are compared, for rows that carry no
 * author id. A Google or GitHub sign-in carries the provider's display name
 * rather than the stored username, so the name alone never matches their own
 * comments.
 */
export function wroteComment(
	comment: CommentResponse,
	currentUserId: string | undefined,
	currentUsername: string | null | undefined
): boolean {
	if (currentUserId && comment.authorId) {
		return comment.authorId === currentUserId;
	}
	return currentUsername === comment.author;
}
