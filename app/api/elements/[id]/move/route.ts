import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { moveElementSchema } from "@/lib/schemas/element";
import { moveElement } from "@/lib/services/element-service";

/**
 * POST /api/elements/[id]/move
 * Moves an element to a new parent within the same case.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: elementId } = await params;

		const body = await request.json();
		const parsed = moveElementSchema.safeParse(body);

		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const result = await moveElement(userId, elementId, parsed.data.parentId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { prisma } = await import("@/lib/prisma");
		const element = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			emitSSEEvent(
				"element:moved",
				element.caseId,
				{ elementId, parentId: parsed.data.parentId },
				userId
			);
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
