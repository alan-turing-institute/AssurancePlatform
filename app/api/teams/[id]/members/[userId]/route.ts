import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
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
	try {
		const currentUserId = await requireAuth();
		const { id: teamId, userId: targetUserId } = await params;
		const body = await request.json();

		const input: UpdateMemberRoleInput = {
			role: body.role,
		};

		const result = await updateMemberRole(
			currentUserId,
			teamId,
			targetUserId,
			input
		);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
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
	try {
		const currentUserId = await requireAuth();
		const { id: teamId, userId: targetUserId } = await params;

		const result = await removeMember(currentUserId, teamId, targetUserId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
