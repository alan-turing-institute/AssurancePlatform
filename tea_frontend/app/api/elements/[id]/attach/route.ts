import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { attachElement } from "@/lib/services/element-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * POST /api/elements/[id]/attach
 * Attaches an element to a parent (moves from sandbox)
 */
export async function POST(
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

			// Accept parentId directly or from Django-style fields
			const parentId =
				body.parentId ||
				body.parent_id ||
				body.goal_id ||
				body.strategy_id ||
				body.property_claim_id;

			if (!parentId) {
				return NextResponse.json(
					{ error: "Parent ID is required" },
					{ status: 400 }
				);
			}

			const result = await attachElement(
				session.user.id,
				elementId,
				String(parentId)
			);

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
		} catch (error) {
			console.error("Error attaching element:", error);
			return NextResponse.json(
				{ error: "Failed to attach element" },
				{ status: 500 }
			);
		}
	}

	// Django fallback - proxy to type-specific attach endpoint
	const session = await getServerSession(authOptions);
	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const elementType = body.element_type || body.elementType;

		if (!elementType) {
			return NextResponse.json(
				{ error: "Element type is required for Django fallback" },
				{ status: 400 }
			);
		}

		// Map element type to Django endpoint
		const endpointMap: Record<string, string> = {
			context: "contexts",
			strategy: "strategies",
			property_claim: "propertyclaims",
			propertyclaim: "propertyclaims",
			evidence: "evidence",
		};

		const endpoint =
			endpointMap[elementType.toLowerCase().replace(/\s+/g, "_")];
		if (!endpoint) {
			return NextResponse.json(
				{ error: `Unknown element type: ${elementType}` },
				{ status: 400 }
			);
		}

		const djangoUrl = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${endpoint}/${elementId}/attach/`;

		const response = await fetch(djangoUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${session.key}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const error = await response.text();
			return NextResponse.json(
				{ error: error || "Failed to attach element" },
				{ status: response.status }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error proxying attach to Django:", error);
		return NextResponse.json(
			{ error: "Failed to attach element" },
			{ status: 500 }
		);
	}
}
