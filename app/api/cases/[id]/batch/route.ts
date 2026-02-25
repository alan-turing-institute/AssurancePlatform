import { z } from "zod";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { AppError, validationError } from "@/lib/errors";
import {
	applyBatchUpdate,
	type BatchUpdateOptions,
} from "@/lib/services/case-batch-update-service";
import type { ElementChange } from "@/lib/services/json-diff-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";

/**
 * Schema for validating the request body
 */
const BatchUpdateRequestSchema = z.object({
	changes: z.array(
		z.discriminatedUnion("type", [
			z.object({
				type: z.literal("create"),
				elementId: z.string().uuid(),
				parentId: z.string().uuid().nullable(),
				data: z.object({
					id: z.string().uuid(),
					type: z.string(),
					name: z.string().nullable(),
					description: z.string(),
					inSandbox: z.boolean(),
					role: z.string().nullable().optional(),
					assumption: z.string().nullable().optional(),
					justification: z.string().nullable().optional(),
					context: z.array(z.string()).optional(),
					url: z.string().nullable().optional(),
					level: z.number().nullable().optional(),
					moduleReferenceId: z.string().optional(),
					moduleEmbedType: z.string().optional(),
					modulePublicSummary: z.string().nullable().optional(),
					fromPattern: z.boolean().optional(),
					modifiedFromPattern: z.boolean().optional(),
					isDefeater: z.boolean().optional(),
					defeatsElementId: z.string().optional(),
				}),
			}),
			z.object({
				type: z.literal("update"),
				elementId: z.string().uuid(),
				data: z.object({
					name: z.string().nullable().optional(),
					description: z.string().optional(),
					inSandbox: z.boolean().optional(),
					parentId: z.string().uuid().nullable().optional(),
					role: z.string().nullable().optional(),
					assumption: z.string().nullable().optional(),
					justification: z.string().nullable().optional(),
					context: z.array(z.string()).optional(),
					url: z.string().nullable().optional(),
					level: z.number().nullable().optional(),
					moduleReferenceId: z.string().optional(),
					moduleEmbedType: z.string().optional(),
					modulePublicSummary: z.string().nullable().optional(),
					fromPattern: z.boolean().optional(),
					modifiedFromPattern: z.boolean().optional(),
					isDefeater: z.boolean().optional(),
					defeatsElementId: z.string().optional(),
				}),
			}),
			z.object({
				type: z.literal("delete"),
				elementId: z.string().uuid(),
			}),
			z.object({
				type: z.literal("link_evidence"),
				evidenceId: z.string().uuid(),
				claimId: z.string().uuid(),
			}),
			z.object({
				type: z.literal("unlink_evidence"),
				evidenceId: z.string().uuid(),
				claimId: z.string().uuid(),
			}),
		])
	),
	expectedVersion: z.string().datetime().optional(),
});

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
		const parseResult = BatchUpdateRequestSchema.safeParse(body);
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
