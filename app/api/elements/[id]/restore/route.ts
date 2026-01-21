import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { restoreElement } from "@/lib/services/element-service";

/**
 * Maps error messages to HTTP status codes.
 */
function getErrorStatus(error: string): number {
	if (error === "Permission denied") {
		return 403;
	}
	if (error === "Element not found" || error === "Element is not deleted") {
		return 404;
	}
	if (error.includes("parent")) {
		return 409; // Conflict - parent is deleted
	}
	return 400;
}

/**
 * POST /api/elements/[id]/restore
 * Restores a soft-deleted element and its descendants
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

	// Get the element's caseId before restoration for SSE event
	const { prismaNew } = await import("@/lib/prisma");
	const element = await prismaNew.assuranceElement.findUnique({
		where: { id: elementId },
		select: { caseId: true, name: true, description: true },
	});

	const result = await restoreElement(session.user.id, elementId);

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
		const username = session.user.name || session.user.email || "Someone";
		emitSSEEvent(
			"element:restored",
			element.caseId,
			{
				elementId,
				elementName: element.name || element.description,
				username,
			},
			session.user.id
		);
	}

	return NextResponse.json({ success: true });
}
