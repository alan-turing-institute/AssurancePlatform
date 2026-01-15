import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { CreateElementInput } from "@/lib/services/element-service";
import { createElement } from "@/lib/services/element-service";

/**
 * Builds element creation input from request body.
 */
function buildCreateInput(
	caseId: string,
	body: Record<string, unknown>
): CreateElementInput {
	return {
		caseId,
		elementType: (body.type || body.elementType) as string,
		name: body.name as string | undefined,
		description: (body.description || body.short_description) as
			| string
			| undefined,
		shortDescription: body.short_description as string | undefined,
		longDescription: body.long_description as string | undefined,
		parentId: body.parentId as string | undefined,
		goal_id: body.goal_id as string | undefined,
		strategy_id: body.strategy_id as string | undefined,
		property_claim_id: body.property_claim_id as string | undefined,
		assurance_case_id: body.assurance_case_id as string | undefined,
		url: (body.url || body.URL) as string | undefined,
		urls: body.urls as string[] | undefined,
		assumption: body.assumption as string | undefined,
		justification: body.justification as string | undefined,
	};
}

/**
 * Creates an element using Prisma.
 */
async function createElementPrisma(
	userId: string,
	username: string,
	caseId: string,
	body: Record<string, unknown>
): Promise<NextResponse> {
	const input = buildCreateInput(caseId, body);
	const result = await createElement(userId, input);

	if (result.error) {
		const status = result.error === "Permission denied" ? 403 : 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	// Emit SSE event for real-time updates
	const { emitSSEEvent } = await import(
		"@/lib/services/sse-connection-manager"
	);
	emitSSEEvent(
		"element:created",
		caseId,
		{
			element: result.data,
			elementName: result.data?.name || result.data?.short_description,
			username,
		},
		userId
	);

	return NextResponse.json(result.data, { status: 201 });
}

/**
 * Create a new element in a case
 *
 * @description Creates a goal, strategy, property claim, evidence, or other
 * element type within the case hierarchy. Requires EDIT permission.
 *
 * @pathParam id - Case ID (UUID)
 * @body { type, name?, description?, parentId?, url?, assumption?, justification? }
 * @response 201 - Created element data
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @auth bearer
 * @tag Elements
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const username = session.user.name || session.user.email || "Someone";
		return await createElementPrisma(session.user.id, username, caseId, body);
	} catch (error) {
		console.error("Error creating element:", error);
		return NextResponse.json(
			{ error: "Failed to create element" },
			{ status: 500 }
		);
	}
}
