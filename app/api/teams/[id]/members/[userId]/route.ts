import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { UpdateMemberRoleInput } from "@/lib/services/team-member-service";
import {
	removeMember,
	updateMemberRole,
} from "@/lib/services/team-member-service";

/**
 * PATCH /api/teams/[id]/members/[userId]
 * Updates a team member's role. Requires ADMIN role.
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string; userId: string }> }
) {
	const { id: teamId, userId: targetUserId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	try {
		const body = await request.json();

		const input: UpdateMemberRoleInput = {
			role: body.role,
		};

		const result = await updateMemberRole(
			session.user.id,
			teamId,
			targetUserId,
			input
		);

		if (result.error) {
			let status = 400;
			if (result.error === "Permission denied") {
				status = 403;
			} else if (result.error === "Member not found") {
				status = 404;
			}
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	} catch (error) {
		console.error("Error updating member role:", error);
		return NextResponse.json(
			{ error: "Failed to update member role" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/teams/[id]/members/[userId]
 * Removes a member from a team. Requires ADMIN role.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; userId: string }> }
) {
	const { id: teamId, userId: targetUserId } = await params;

	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await removeMember(session.user.id, teamId, targetUserId);

	if (result.error) {
		let status = 400;
		if (result.error === "Permission denied") {
			status = 403;
		} else if (result.error === "Member not found") {
			status = 404;
		}
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json({ success: true });
}
