import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { restoreElement } from "@/lib/services/element-service";

/**
 * POST /api/elements/[id]/restore
 * Restores a soft-deleted element and its descendants
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		// Get the element's caseId before restoration for SSE event
		const { prisma } = await import("@/lib/prisma");
		const element = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, name: true, description: true },
		});

		const result = await restoreElement(session.userId, elementId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.username || session.email || "Someone";
			emitSSEEvent("element:restored", element.caseId, {
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
