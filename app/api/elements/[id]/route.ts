import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { updateElementSchema } from "@/lib/schemas/element";
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

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
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

		const parsed = updateElementSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		// element-service.ts's updateElement resolves url/URL itself
		// (url || URL) — do not collapse them here.
		const result = await updateElement(session.userId, elementId, parsed.data);

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
				elementName: element.name || element.description,
				username,
				userId: session.userId,
			});
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
