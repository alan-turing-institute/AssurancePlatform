import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { detachElement } from "@/lib/services/element-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * POST /api/elements/[id]/detach
 * Detaches an element (moves to sandbox)
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: elementId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await detachElement(session.user.id, elementId);

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

	// Django fallback - proxy to type-specific detach endpoint
	const session = await getServerSession(authOptions);
	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const url = new URL(_request.url);
		const elementType = url.searchParams.get("element_type");

		if (!elementType) {
			return NextResponse.json(
				{
					error: "Element type query parameter is required for Django fallback",
				},
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

		const djangoUrl = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${endpoint}/${elementId}/detach/`;

		const response = await fetch(djangoUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${session.key}`,
			},
		});

		if (!response.ok) {
			const error = await response.text();
			return NextResponse.json(
				{ error: error || "Failed to detach element" },
				{ status: response.status }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error proxying detach to Django:", error);
		return NextResponse.json(
			{ error: "Failed to detach element" },
			{ status: 500 }
		);
	}
}
