import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getSandboxElements } from "@/lib/services/element-service";

/**
 * GET /api/cases/[id]/sandbox
 * Gets all orphaned/sandbox elements for a case
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
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
