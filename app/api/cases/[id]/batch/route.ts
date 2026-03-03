import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import type { ElementChange } from "@/lib/case/tree-diff";
import { AppError, validationError } from "@/lib/errors";
import { batchUpdateRequestSchema } from "@/lib/schemas/batch-update";
import {
	applyBatchUpdate,
	type BatchUpdateOptions,
} from "@/lib/services/case-batch-update-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * Apply batch updates to case elements
 *
 * @description Applies multiple element changes (create, update, delete) atomically.
 * Used by the JSON editor to sync changes back to the database.
 *
 * @pathParam id - Case ID (UUID)
 * @body { changes: ElementChange[], expectedVersion?: string }
 * @response 200 - Success with summary of changes
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @response 409 - Conflict (case was modified)
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

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return apiError(validationError("Invalid JSON in request body"));
		}

		// Validate request body
		const parseResult = batchUpdateRequestSchema.safeParse(body);
		if (!parseResult.success) {
			return apiError(validationError("Invalid request body"));
		}

		const { changes, expectedVersion } = parseResult.data;

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
		emitSSEEvent(
			"case:updated",
			caseId,
			{
				summary: result.data.summary,
				username,
				source: "json-editor",
			},
			session.userId
		);

		return apiSuccess({
			success: true,
			summary: result.data.summary,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
