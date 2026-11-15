import { JSON_BODY_LIMITS, parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import type { ElementChange } from "@/lib/case/tree-diff";
import { AppError } from "@/lib/errors";
import { batchUpdateRequestSchema } from "@/lib/schemas/batch-update";
import {
	applyBatchUpdate,
	type BatchUpdateOptions,
} from "@/lib/services/case-batch-update-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * Apply batch updates to case elements
 *
 * @description Applies multiple element changes (create, update, delete) atomically. Used by the JSON editor to sync changes back to the database. The goal rules hold for the goals as the batch leaves them: a goal defeater (counter-goal) has a parent, the top goal has none, and a case has one ordinary goal. The element rules of the single-element routes hold too: a new element's type fits its parent, only counter-goals hang from evidence, the old element types cannot be created, and a filled-in field belongs to the element's type.
 *
 * @pathParam id - Case ID (UUID)
 * @body { changes: ElementChange[], expectedVersion?: string }
 * @response 200 - Success with summary of changes
 * @response 400 - Validation error (including a goal defeater without a parent, an element changed more than once, and anything but a counter-goal placed beneath evidence)
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @response 409 - Conflict (case was modified)
 * @response 422 - The batch would leave the case with a second ordinary goal
 * @response 413 - Payload too large
 * @add 409,422
 * @auth bearer
 * @tag Elements
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: caseId } = await params;

		const { changes, expectedVersion } = await parseJsonBody(
			request,
			batchUpdateRequestSchema,
			{ maxBytes: JSON_BODY_LIMITS.batchUpdate }
		);

		// Apply the batch update
		const options: BatchUpdateOptions = {};
		if (expectedVersion) {
			options.expectedVersion = expectedVersion;
		}

		const result = await applyBatchUpdate(
			session.userId,
			caseId,
			changes as ElementChange[],
			options
		);

		if ("error" in result) {
			if (result.conflictDetected) {
				return apiError(
					new AppError({ code: "CONFLICT", message: result.error })
				);
			}
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("case:updated", caseId, {
			summary: result.data.summary,
			username,
			source: "json-editor",
			userId: session.userId,
		});

		return apiSuccess({
			success: true,
			summary: result.data.summary,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
