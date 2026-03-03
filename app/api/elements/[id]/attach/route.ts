import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { attachElement } from "@/lib/services/element-service";

/**
 * Extracts parent ID from request body.
 */
function extractParentId(body: Record<string, unknown>): string | undefined {
	const parentId =
		body.parentId ||
		body.parent_id ||
		body.goal_id ||
		body.strategy_id ||
		body.property_claim_id;
	return parentId ? String(parentId) : undefined;
}

/**
 * POST /api/elements/[id]/attach
 * Attaches an element to a parent (moves from sandbox)
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: elementId } = await params;

		const body = await request.json();
		const parentId = extractParentId(body);

		if (!parentId) {
			return apiError(validationError("Parent ID is required"));
		}

		const result = await attachElement(userId, elementId, parentId);

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
				"element:attached",
				element.caseId,
				{ elementId, parentId },
				userId
			);
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
