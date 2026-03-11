import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
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
		const session = await requireAuthSession();
		const { id: elementId } = await params;

		const body = await request.json();
		const parsed = moveElementSchema.safeParse(body);

		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const result = await moveElement(
			session.userId,
			elementId,
			parsed.data.parentId
		);

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
			emitSSEEvent("element:moved", element.caseId, {
				elementId,
				parentId: parsed.data.parentId,
				username,
				userId: session.userId,
			});
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
