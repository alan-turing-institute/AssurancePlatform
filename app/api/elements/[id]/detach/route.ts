import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { detachElement } from "@/lib/services/element-service";

/**
 * POST /api/elements/[id]/detach
 * Detaches an element (moves to sandbox)
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: elementId } = await params;

		// Get caseId before detaching for SSE event
		const { prismaNew } = await import("@/lib/prisma");
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		const result = await detachElement(userId, elementId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			emitSSEEvent("element:detached", element.caseId, { elementId }, userId);
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
