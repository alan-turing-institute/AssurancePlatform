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
			? await updateTeamPermission(session.user.id, caseId, permissionId, input)
			: await updateUserPermission(
					session.user.id,
					caseId,
					permissionId,
					input
				);

		if (result.error) {
			let status = 400;
			if (result.error === "Permission denied") {
				status = 403;
			} else if (result.error === "Permission not found") {
				status = 404;
			}
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
		let status = 400;
		if (result.error === "Permission denied") {
			status = 403;
		} else if (result.error === "Permission not found") {
			status = 404;
		}
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json({ success: true });
}
