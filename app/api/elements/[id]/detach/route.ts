import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { detachElement } from "@/lib/services/element-service";

/**
 * Maps error messages to HTTP status codes.
 */
function getErrorStatus(error: string): number {
	if (error === "Permission denied") {
		return 403;
	}
	if (error === "Element not found") {
		return 404;
	}
	return 400;
}

/**
 * POST /api/elements/[id]/detach
 * Detaches an element (moves to sandbox)
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Get caseId before detaching for SSE event
		const { prismaNew } = await import("@/lib/prisma");
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		const result = await detachElement(session.user.id, elementId);

		if (result.error) {
			return NextResponse.json(
				{ error: result.error },
				{ status: getErrorStatus(result.error) }
			);
		}

		// Emit SSE event for real-time updates
		if (element?.caseId) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			emitSSEEvent(
				"element:detached",
				element.caseId,
				{ elementId },
				session.user.id
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error detaching element:", error);
		return NextResponse.json(
			{ error: "Failed to detach element" },
			{ status: 500 }
		);
	}
}
