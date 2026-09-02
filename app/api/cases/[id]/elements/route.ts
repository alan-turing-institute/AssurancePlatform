import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { createElementSchema } from "@/lib/schemas/element";
import { createElement } from "@/lib/services/element-service";

/**
 * Create a new element in a case
 *
 * @description Creates a goal, strategy, property claim, evidence, or other
 * element type within the case hierarchy. Requires EDIT permission.
 *
 * @pathParam id - Case ID (UUID)
 * @body { type, name?, description?, parentId?, url?, assumption?, justification? }
 * @response 201 - Created element data
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
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

		const rawBody = (await request.json().catch(() => null)) as Record<
			string,
			unknown
		> | null;
		const parsed = createElementSchema.safeParse(rawBody);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		// element-service.ts's createElement resolves url/URL itself
		// (url || URL) — do not collapse them here.
		const result = await createElement(session.userId, {
			...parsed.data,
			caseId,
			elementType: parsed.data.type ?? parsed.data.elementType ?? "",
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username || session.email || "Someone";
		emitSSEEvent("element:created", caseId, {
			element: result.data,
			elementName: result.data?.name,
			username,
			userId: session.userId,
		});

		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
