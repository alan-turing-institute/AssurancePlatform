import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuthSession,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { updatePermissionSchema } from "@/lib/schemas/permission";
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
		const session = await requireAuthSession();
		const { id: caseId, permissionId } = await params;

		const parsed = updatePermissionSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(
					parsed.error.errors[0]?.message ?? "Invalid input"
				)
			);
		}

		// Determine if this is a user or team permission
		const isTeamPermission = parsed.data.type === "team";

		const result = isTeamPermission
			? await updateTeamPermission(session.userId, caseId, permissionId, {
					permission: parsed.data.permission,
				})
			: await updateUserPermission(session.userId, caseId, permissionId, {
					permission: parsed.data.permission,
				});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("permission:changed", caseId, {
			username,
			userId: session.userId,
		});

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
		const session = await requireAuthSession();
		const { id: caseId, permissionId } = await params;

		// Check query param for type
		const url = new URL(request.url);
		const isTeamPermission = url.searchParams.get("type") === "team";

		const result = isTeamPermission
			? await revokeTeamPermission(session.userId, caseId, permissionId)
			: await revokeUserPermission(session.userId, caseId, permissionId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Emit SSE event for real-time updates
		const { emitSSEEvent } = await import(
			"@/lib/services/sse-connection-manager"
		);
		const username = session.username ?? session.email ?? "Someone";
		emitSSEEvent("permission:changed", caseId, {
			username,
			userId: session.userId,
		});

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
