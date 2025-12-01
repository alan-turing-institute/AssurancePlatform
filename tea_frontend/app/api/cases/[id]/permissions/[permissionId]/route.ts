import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { UpdatePermissionInput } from "@/lib/services/case-permission-service";
import {
	revokeTeamPermission,
	revokeUserPermission,
	updateTeamPermission,
	updateUserPermission,
} from "@/lib/services/case-permission-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * PATCH /api/cases/[id]/permissions/[permissionId]
 * Updates a permission level. Requires ADMIN permission.
 *
 * Body: { permission: string, type?: "user" | "team" }
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string; permissionId: string }> }
) {
	const { id: caseId, permissionId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		try {
			const body = await request.json();

			const input: UpdatePermissionInput = {
				permission: body.permission,
			};

			// Determine if this is a user or team permission
			const isTeamPermission = body.type === "team";

			const result = isTeamPermission
				? await updateTeamPermission(
						session.user.id,
						caseId,
						permissionId,
						input
					)
				: await updateUserPermission(
						session.user.id,
						caseId,
						permissionId,
						input
					);

			if (result.error) {
				const status =
					result.error === "Permission denied"
						? 403
						: result.error === "Permission not found"
							? 404
							: 400;
				return NextResponse.json({ error: result.error }, { status });
			}

			return NextResponse.json(result.data);
		} catch (error) {
			console.error("Error updating permission:", error);
			return NextResponse.json(
				{ error: "Failed to update permission" },
				{ status: 500 }
			);
		}
	}

	return NextResponse.json(
		{ error: "Updating permissions requires Prisma auth" },
		{ status: 501 }
	);
}

/**
 * DELETE /api/cases/[id]/permissions/[permissionId]
 * Revokes a permission. Requires ADMIN permission.
 *
 * Query param: ?type=team (optional, defaults to user)
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string; permissionId: string }> }
) {
	const { id: caseId, permissionId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		// Check query param for type
		const url = new URL(request.url);
		const isTeamPermission = url.searchParams.get("type") === "team";

		const result = isTeamPermission
			? await revokeTeamPermission(session.user.id, caseId, permissionId)
			: await revokeUserPermission(session.user.id, caseId, permissionId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Permission not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json({ success: true });
	}

	return NextResponse.json(
		{ error: "Revoking permissions requires Prisma auth" },
		{ status: 501 }
	);
}
