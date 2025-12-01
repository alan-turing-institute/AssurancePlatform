import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { CreateElementInput } from "@/lib/services/element-service";
import { createElement } from "@/lib/services/element-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * POST /api/cases/[id]/elements
 * Creates a new element in a case
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		try {
			const body = await request.json();

			const input: CreateElementInput = {
				caseId,
				elementType: body.type || body.elementType,
				name: body.name,
				description: body.description || body.short_description,
				shortDescription: body.short_description,
				longDescription: body.long_description,
				parentId: body.parentId,
				// Django-style parent references
				goal_id: body.goal_id,
				strategy_id: body.strategy_id,
				property_claim_id: body.property_claim_id,
				assurance_case_id: body.assurance_case_id,
				// Evidence-specific
				url: body.url || body.URL,
				// GSN-specific
				assumption: body.assumption,
				justification: body.justification,
			};

			const result = await createElement(session.user.id, input);

			if (result.error) {
				const status = result.error === "Permission denied" ? 403 : 400;
				return NextResponse.json({ error: result.error }, { status });
			}

			return NextResponse.json(result.data, { status: 201 });
		} catch (error) {
			console.error("Error creating element:", error);
			return NextResponse.json(
				{ error: "Failed to create element" },
				{ status: 500 }
			);
		}
	}

	// Fallback to Django API
	const session = await getServerSession(authOptions);
	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const elementType = (body.type || body.elementType || "").toLowerCase();

		// Map element type to Django endpoint
		const endpointMap: Record<string, string> = {
			goal: "goals",
			toplevelgoal: "goals",
			toplevel_normative_goal: "goals",
			context: "contexts",
			strategy: "strategies",
			property_claim: "propertyclaims",
			propertyclaim: "propertyclaims",
			evidence: "evidence",
		};

		const endpoint = endpointMap[elementType.replace(/\s+/g, "_")];
		if (!endpoint) {
			return NextResponse.json(
				{ error: `Unknown element type: ${elementType}` },
				{ status: 400 }
			);
		}

		const djangoUrl = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${endpoint}/`;

		const response = await fetch(djangoUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Token ${session.key}`,
			},
			body: JSON.stringify({
				...body,
				assurance_case_id: Number(caseId),
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			return NextResponse.json(
				{ error: error || "Failed to create element" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error proxying to Django:", error);
		return NextResponse.json(
			{ error: "Failed to create element" },
			{ status: 500 }
		);
	}
}
