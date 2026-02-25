import {
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { createElementCommentSchema } from "@/lib/schemas/comment";
import {
	createElementComment,
	fetchElementComments,
} from "@/lib/services/comment-service";

/**
 * GET /api/elements/[id]/comments
 * Gets all comments for an element with threading support.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;
		const comments = await fetchElementComments(elementId, session.userId);
		return apiSuccess(comments);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/elements/[id]/comments
 * Creates a new comment on an element (supports threading via parentId).
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const body = await request.json();
		const parsed = createElementCommentSchema.safeParse(body);
		if (!parsed.success) {
			throw validationError(parsed.error.errors[0]?.message ?? "Invalid input");
		}

		const comment = await createElementComment(
			elementId,
			parsed.data.content,
			parsed.data.parentId,
			session
		);
		return apiSuccess(comment, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
