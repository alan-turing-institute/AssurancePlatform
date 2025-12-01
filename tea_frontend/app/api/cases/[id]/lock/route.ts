import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
	getCaseLockStatus,
	lockCase,
	unlockCase,
} from "@/lib/services/case-permission-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/cases/[id]/lock
 * Gets the lock status of a case. Requires VIEW permission.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;

	if (USE_PRISMA_AUTH) {
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

	return NextResponse.json(
		{ error: "Lock status requires Prisma auth" },
		{ status: 501 }
	);
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

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await lockCase(session.user.id, caseId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Case not found"
						? 404
						: result.error === "Case is already locked by another user"
							? 409
							: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	return NextResponse.json(
		{ error: "Locking cases requires Prisma auth" },
		{ status: 501 }
	);
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

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await unlockCase(session.user.id, caseId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Case not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	return NextResponse.json(
		{ error: "Unlocking cases requires Prisma auth" },
		{ status: 501 }
	);
}
