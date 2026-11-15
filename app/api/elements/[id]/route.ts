import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { noticeElementName } from "@/lib/case/defined-terms";
import { updateElementSchema } from "@/lib/schemas/element";
import {
	deleteElement,
	getElement,
	updateElement,
} from "@/lib/services/element-service";

/**
 * GET /api/elements/[id]
 * @description Gets a single element by ID. A challenge whose target was deleted or detached comes back with no `defeatsElementId` and `defeatsDangling` true.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const result = await getElement(session.userId, elementId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/elements/[id] (400 without a parent, 422 for a second goal)
 * @description Updates an existing element. A `parentId` on evidence, including `null`, answers 400: evidence is moved with the move route and detached with the detach route. Moving an element beneath evidence also answers 400, because only counter-goals hang from evidence. Turning a counter-goal beneath evidence into an ordinary goal answers 400 with the top-goal message, since an ordinary goal takes no parent. The top goal never takes a parent, so a `parentId` on it answers 400. A non-empty assumption, justification, context or link that the element's type does not hold answers 400. An empty assumption or justification (an empty string, spaces or null) clears the stored text; leaving the field out keeps it.
 * @add 422
 */
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const data = await parseJsonBody(request, updateElementSchema);

		// element-service.ts's updateElement resolves url/URL itself
		// (url || URL) — do not collapse them here.
		const result = await updateElement(session.userId, elementId, data);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (result.data?.assuranceCaseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username || session.email || "Someone";
			emitSSEEvent("element:updated", result.data.assuranceCaseId, {
				element: result.data,
				elementId,
				elementName: result.data?.name,
				username,
				userId: session.userId,
			});
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * DELETE /api/elements/[id]
 *
 * @description Deletes an element. A challenge elsewhere in the case that named it is left unlinked and marked `defeatsDangling`.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		// Get the element's caseId and name before deletion for SSE event
		const { prisma } = await import("@/lib/prisma");
		const element = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, name: true, description: true },
		});

		const result = await deleteElement(session.userId, elementId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username || session.email || "Someone";
			emitSSEEvent("element:deleted", element.caseId, {
				elementId,
				elementName: noticeElementName(element),
				username,
				userId: session.userId,
			});
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
