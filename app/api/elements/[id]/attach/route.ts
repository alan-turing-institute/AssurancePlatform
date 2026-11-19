import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { attachElementSchema } from "@/lib/schemas/element";
import { attachElement } from "@/lib/services/element-service";

/**
 * POST /api/elements/[id]/attach
 * Attaches an element to a parent (moves from sandbox)
 *
 * @description Attaches an element to a parent (moves from sandbox). Evidence is linked to the named property claim instead of taking a parentId; any other parent answers 400. A new parent that cannot hold the element's type answers 400, and beneath evidence only a counter-goal can hang. Attaching an element beneath itself or one of its descendants answers 400.
 * @auth SessionAuth
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const { parentId } = await parseJsonBody(request, attachElementSchema);
		const result = await attachElement(session.userId, elementId, parentId);

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
			const username = session.username ?? session.email ?? "Someone";
			emitSSEEvent("element:attached", element.caseId, {
				elementId,
				parentId,
				username,
				userId: session.userId,
			});
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
