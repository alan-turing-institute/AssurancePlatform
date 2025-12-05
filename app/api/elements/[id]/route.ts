import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { UpdateElementInput } from "@/lib/services/element-service";
import {
	deleteElement,
	getElement,
	updateElement,
} from "@/lib/services/element-service";

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
 * GET /api/elements/[id]
 * Gets a single element by ID
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const result = await getElement(session.user.id, elementId);

	if (result.error) {
		return NextResponse.json(
			{ error: result.error },
			{ status: getErrorStatus(result.error) }
		);
	}

	return NextResponse.json(result.data);
}

/**
 * Builds update input from request body.
 */
function buildUpdateInput(body: Record<string, unknown>): UpdateElementInput {
	return {
		name: body.name as string | undefined,
		description: (body.description || body.short_description) as
			| string
			| undefined,
		shortDescription: body.short_description as string | undefined,
		longDescription: body.long_description as string | undefined,
		parentId: body.parentId as string | undefined,
		url: (body.url || body.URL) as string | undefined,
		assumption: body.assumption as string | undefined,
		justification: body.justification as string | undefined,
		context: body.context as string[] | undefined,
		inSandbox: body.in_sandbox as boolean | undefined,
		// Django-style parent references
		goal_id: body.goal_id as string | undefined,
		strategy_id: body.strategy_id as string | undefined,
		property_claim_id: body.property_claim_id as
			| string
			| number
			| number[]
			| null
			| undefined,
	};
}

/**
 * PUT /api/elements/[id]
 * Updates an existing element
 */
export async function PUT(
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
		const input = buildUpdateInput(body);
		const result = await updateElement(session.user.id, elementId, input);

		if (result.error) {
			return NextResponse.json(
				{ error: result.error },
				{ status: getErrorStatus(result.error) }
			);
		}

		// Emit SSE event for real-time updates
		if (result.data?.assurance_case_id) {
			const { emitSSEEvent } = await import(
				"@/lib/services/sse-connection-manager"
			);
			const username = session.user.name || session.user.email || "Someone";
			emitSSEEvent(
				"element:updated",
				result.data.assurance_case_id,
				{
					element: result.data,
					elementId,
					elementName: result.data?.name || result.data?.short_description,
					username,
				},
				session.user.id
			);
		}

		return NextResponse.json(result.data);
	} catch (error) {
		console.error("Error updating element:", error);
		return NextResponse.json(
			{ error: "Failed to update element" },
			{ status: 500 }
		);
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
	const { id: elementId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Get the element's caseId and name before deletion for SSE event
	const { prismaNew } = await import("@/lib/prisma-new");
	const element = await prismaNew.assuranceElement.findUnique({
		where: { id: elementId },
		select: { caseId: true, name: true, description: true },
	});

	const result = await deleteElement(session.user.id, elementId);

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
			"element:deleted",
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
