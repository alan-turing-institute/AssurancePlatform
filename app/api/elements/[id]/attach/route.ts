import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { attachElement } from "@/lib/services/element-service";

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
	const { id: elementId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const parentId = extractParentId(body);

		if (!parentId) {
			return NextResponse.json(
				{ error: "Parent ID is required" },
				{ status: 400 }
			);
		}

		const result = await attachElement(session.user.id, elementId, parentId);

		if (result.error) {
			return NextResponse.json(
				{ error: result.error },
				{ status: getErrorStatus(result.error) }
			);
		}

		// Emit SSE event for real-time updates
		const { prismaNew } = await import("@/lib/prisma");
		const element = await prismaNew.assuranceElement.findUnique({
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
				session.user.id
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error attaching element:", error);
		return NextResponse.json(
			{ error: "Failed to attach element" },
			{ status: 500 }
		);
	}
}
