import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	getCaseLockStatus,
	lockCase,
	unlockCase,
} from "@/lib/services/case-permission-service";

/**
 * GET /api/cases/[id]/lock
 * Gets the lock status of a case. Requires VIEW permission.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await getCaseLockStatus(session.user.id, caseId);

	if (result.error) {
		const status = result.error === "Case not found" ? 404 : 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json(result.data);
}

/**
 * POST /api/cases/[id]/lock
 * Locks a case for editing. Requires EDIT permission.
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await lockCase(session.user.id, caseId);

	if (result.error) {
		const errorStatusMap: Record<string, number> = {
			"Permission denied": 403,
			"Case not found": 404,
			"Case is already locked by another user": 409,
		};
		const status = errorStatusMap[result.error] ?? 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json(result.data);
}

/**
 * DELETE /api/cases/[id]/lock
 * Unlocks a case. Must be lock holder or ADMIN.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await unlockCase(session.user.id, caseId);

	if (result.error) {
		const errorStatusMap: Record<string, number> = {
			"Permission denied": 403,
			"Case not found": 404,
		};
		const status = errorStatusMap[result.error] ?? 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json(result.data);
}
