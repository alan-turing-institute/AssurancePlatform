import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
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
	try {
		const userId = await requireAuth();
		const { id: caseId, permissionId } = await params;
		const body = await request.json();

		const input: UpdatePermissionInput = {
			permission: body.permission,
		};

		// Determine if this is a user or team permission
		const isTeamPermission = body.type === "team";

		const result = isTeamPermission
			? await updateTeamPermission(userId, caseId, permissionId, input)
			: await updateUserPermission(userId, caseId, permissionId, input);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
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
	try {
		const userId = await requireAuth();
		const { id: caseId, permissionId } = await params;

		// Check query param for type
		const url = new URL(request.url);
		const isTeamPermission = url.searchParams.get("type") === "team";

		const result = isTeamPermission
			? await revokeTeamPermission(userId, caseId, permissionId)
			: await revokeUserPermission(userId, caseId, permissionId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
