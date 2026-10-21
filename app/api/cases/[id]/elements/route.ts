import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { createElementSchema } from "@/lib/schemas/element";
import { createElement } from "@/lib/services/element-service";

/**
 * Create a new element in a case
 *
 * @description Creates a goal, strategy, property claim, evidence, or other
 * element type within the case hierarchy. Requires EDIT permission.
 * A goal defeater (counter-goal) needs a `parentId`, and a case has one
 * ordinary goal.
 *
 * @pathParam id - Case ID (UUID)
 * @body { type, name?, description?, parentId?, url?, assumption?, justification? }
 * @response 201 - Created element data
 * @response 400 - Validation error (including a goal defeater without a parent)
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @response 409 - The case already has its ordinary goal
 * @response 413 - Payload too large
 * @add 409
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

		const data = await parseJsonBody(request, createElementSchema);

		// element-service.ts's createElement resolves url/URL itself
		// (url || URL) — do not collapse them here.
		const result = await createElement(session.userId, {
			...data,
			caseId,
			elementType: data.type ?? data.elementType ?? "",
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
