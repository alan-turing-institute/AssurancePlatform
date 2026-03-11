import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { createElementSchema } from "@/lib/schemas/element";
import type { CreateElementInput } from "@/lib/services/element-service";
import { createElement } from "@/lib/services/element-service";

/**
 * Resolves `parentId` from the request body.
 *
 * The UI sends legacy relationship fields (`goalId`, `strategyId`,
 * `propertyClaimId`) instead of a unified `parentId`. This normalises
 * them before the payload reaches the service layer.
 */
function resolveParentIdFromBody(
	body: Record<string, unknown>
): string | undefined {
	if (body.parentId != null) {
		return String(body.parentId);
	}
	if (body.goalId != null) {
		return String(body.goalId);
	}
	if (body.strategyId != null) {
		return String(body.strategyId);
	}

	const claimId = body.propertyClaimId;
	if (claimId != null) {
		return String(Array.isArray(claimId) ? claimId[0] : claimId);
	}

	return;
}

/**
 * Builds element creation input from validated body.
 */
function buildCreateInput(
	caseId: string,
	body: Record<string, unknown>,
	rawBody: Record<string, unknown>
): CreateElementInput {
	return {
		caseId,
		elementType: (body.type || body.elementType) as string,
		name: body.name as string | undefined,
		description: body.description as string | undefined,
		shortDescription: body.shortDescription as string | undefined,
		longDescription: body.longDescription as string | undefined,
		parentId: resolveParentIdFromBody(rawBody),
		url: (body.url || body.URL) as string | undefined,
		urls: body.urls as string[] | undefined,
		assumption: body.assumption as string | undefined,
		justification: body.justification as string | undefined,
	};
}

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
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const input = buildCreateInput(
			caseId,
			parsed.data as unknown as Record<string, unknown>,
			rawBody ?? {}
		);
		const result = await createElement(session.userId, input);

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
