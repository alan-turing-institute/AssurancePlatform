import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import type { UpdateElementInput } from "@/lib/services/element-service";
import {
	deleteElement,
	getElement,
	updateElement,
} from "@/lib/services/element-service";

/**
 * GET /api/elements/[id]
 * Gets a single element by ID
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const result = await getElement(session.userId, elementId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * Builds update input from request body.
 */
function buildUpdateInput(body: Record<string, unknown>): UpdateElementInput {
	return {
		name: body.name as string | undefined,
		description: (body.description || body.short_description) as
			| string
			| undefined,
		shortDescription: body.short_description as string | undefined,
		longDescription: body.long_description as string | undefined,
		parentId: body.parentId as string | undefined,
		url: (body.url || body.URL) as string | undefined,
		assumption: body.assumption as string | undefined,
		justification: body.justification as string | undefined,
		context: body.context as string[] | undefined,
		inSandbox: body.in_sandbox as boolean | undefined,
		// Django-style parent references
		goal_id: body.goal_id as string | undefined,
		strategy_id: body.strategy_id as string | undefined,
		property_claim_id: body.property_claim_id as
			| string
			| number
			| number[]
			| null
			| undefined,
	};
}

/**
 * PUT /api/elements/[id]
 * Updates an existing element
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const body = await request.json();
		const input = buildUpdateInput(body);
		const result = await updateElement(session.userId, elementId, input);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (result.data?.assurance_case_id) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username || session.email || "Someone";
			emitSSEEvent(
				"element:updated",
				result.data.assurance_case_id,
				{
					element: result.data,
					elementId,
					elementName: result.data?.name || result.data?.short_description,
					username,
				},
				session.userId
			);
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/elements/[id]
 * Deletes an element
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		// Get the element's caseId and name before deletion for SSE event
		const { prismaNew } = await import("@/lib/prisma");
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, name: true, description: true },
		});

		const result = await deleteElement(session.userId, elementId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username || session.email || "Someone";
			emitSSEEvent(
				"element:deleted",
				element.caseId,
				{
					elementId,
					elementName: element.name || element.description,
					username,
				},
				session.userId
			);
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
