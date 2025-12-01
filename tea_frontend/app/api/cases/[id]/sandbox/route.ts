import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSandboxElements } from "@/lib/services/element-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/cases/[id]/sandbox
 * Gets all orphaned/sandbox elements for a case
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const result = await getSandboxElements(session.user.id, caseId);

		if (result.error) {
			const status = result.error === "Permission denied" ? 403 : 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	// Django fallback
	const session = await getServerSession(authOptions);
	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const djangoUrl = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/cases/${caseId}/sandbox`;

		const response = await fetch(djangoUrl, {
			headers: {
				Authorization: `Token ${session.key}`,
			},
		});

		if (!response.ok) {
			return NextResponse.json(
				{ error: "Failed to fetch sandbox elements" },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error proxying sandbox to Django:", error);
		return NextResponse.json(
			{ error: "Failed to fetch sandbox elements" },
			{ status: 500 }
		);
	}
}
