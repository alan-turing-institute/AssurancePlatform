import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { UpdateElementInput } from "@/lib/services/element-service";
import {
	deleteElement,
	getElement,
	updateElement,
} from "@/lib/services/element-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/elements/[id]
 * Gets a single element by ID
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await getElement(session.user.id, elementId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Element not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	// Django fallback not implemented for generic element fetch
	// as Django uses type-specific endpoints
	return NextResponse.json(
		{ error: "Element fetch requires Prisma auth" },
		{ status: 501 }
	);
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

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		try {
			const body = await request.json();

			const input: UpdateElementInput = {
				name: body.name,
				description: body.description || body.short_description,
				shortDescription: body.short_description,
				longDescription: body.long_description,
				parentId: body.parentId,
				url: body.url || body.URL,
				assumption: body.assumption,
				justification: body.justification,
				inSandbox: body.in_sandbox,
				// Django-style parent references
				goal_id: body.goal_id,
				strategy_id: body.strategy_id,
				property_claim_id: body.property_claim_id,
			};

			const result = await updateElement(session.user.id, elementId, input);

			if (result.error) {
				const status =
					result.error === "Permission denied"
						? 403
						: result.error === "Element not found"
							? 404
							: 400;
				return NextResponse.json({ error: result.error }, { status });
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

	// Django fallback not implemented for generic element update
	return NextResponse.json(
		{ error: "Element update requires Prisma auth" },
		{ status: 501 }
	);
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

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await deleteElement(session.user.id, elementId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Element not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json({ success: true });
	}

	// Django fallback not implemented for generic element delete
	return NextResponse.json(
		{ error: "Element delete requires Prisma auth" },
		{ status: 501 }
	);
}
