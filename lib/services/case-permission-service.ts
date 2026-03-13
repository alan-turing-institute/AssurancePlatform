import { prisma } from "@/lib/prisma";
import { createCaseInvite } from "@/lib/services/case-invite-service";
import type { PermissionLevel } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

// ============================================
// INPUT INTERFACES
// ============================================

export interface ShareByEmailInput {
	email: string;
	permission: PermissionLevel;
}

export interface ShareWithTeamInput {
	permission: PermissionLevel;
	teamId: string;
}

export interface UpdatePermissionInput {
	permission: PermissionLevel;
}

// ============================================
// OUTPUT INTERFACES
// ============================================

export interface UserPermissionResponse {
	case_id: string;
	granted_at: string;
	granted_by: {
		id: string;
		username: string;
	};
	id: string;
	permission: PermissionLevel;
	user: {
		id: string;
		username: string;
		email: string;
		avatar_url: string | null;
	};
}

export interface TeamPermissionResponse {
	case_id: string;
	granted_at: string;
	id: string;
	permission: PermissionLevel;
	team: {
		id: string;
		name: string;
		slug: string;
	};
}

export interface CasePermissionsListResponse {
	is_owner: boolean;
	owner: {
		id: string;
		username: string;
		email: string;
	};
	team_permissions: TeamPermissionResponse[];
	user_permissions: UserPermissionResponse[];
}

export interface ShareByEmailResult {
	already_shared?: boolean;
	invite_created?: boolean;
	invite_token?: string;
	permission?: UserPermissionResponse;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates that user has ADMIN permission on a case.
 */
async function validateCaseAdmin(
	userId: string,
	caseId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const { canAccessCase } = await import("@/lib/permissions");
	const hasAccess = await canAccessCase({ userId, caseId }, "ADMIN");
	if (!hasAccess) {
		return { valid: false, error: "Permission denied" };
	}
	return { valid: true };
}

/**
 * Validates permission level input.
 */
function isValidPermission(permission: string): permission is PermissionLevel {
	return ["VIEW", "COMMENT", "EDIT", "ADMIN"].includes(permission);
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Lists all permissions for a case. Requires ADMIN permission.
 */
export async function listCasePermissions(
	userId: string,
	caseId: string
): ServiceResult<CasePermissionsListResponse> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Get case with owner info
		const assuranceCase = await prisma.assuranceCase.findUnique({
			where: { id: caseId },
			select: {
				createdById: true,
				createdBy: {
					select: {
						id: true,
						username: true,
						email: true,
					},
				},
			},
		});

		if (!assuranceCase) {
			return { error: "Case not found" };
		}

		// Get user permissions
		const userPermissions = await prisma.casePermission.findMany({
			where: { caseId },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						email: true,
						avatarUrl: true,
					},
				},
				grantedBy: {
					select: {
						id: true,
						username: true,
					},
				},
			},
			orderBy: { grantedAt: "desc" },
		});

		// Get team permissions
		const teamPermissions = await prisma.caseTeamPermission.findMany({
			where: { caseId },
			include: {
				team: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
			orderBy: { grantedAt: "desc" },
		});

		return {
			data: {
				user_permissions: userPermissions.map((p) => ({
					id: p.id,
					case_id: p.caseId,
					permission: p.permission,
					granted_at: p.grantedAt.toISOString(),
					user: {
						id: p.user.id,
						username: p.user.username,
						email: p.user.email,
						avatar_url: p.user.avatarUrl,
					},
					granted_by: {
						id: p.grantedBy.id,
						username: p.grantedBy.username,
					},
				})),
				team_permissions: teamPermissions.map((p) => ({
					id: p.id,
					case_id: p.caseId,
					permission: p.permission,
					granted_at: p.grantedAt.toISOString(),
					team: {
						id: p.team.id,
						name: p.team.name,
						slug: p.team.slug,
					},
				})),
				is_owner: assuranceCase.createdById === userId,
				owner: {
					id: assuranceCase.createdBy.id,
					username: assuranceCase.createdBy.username,
					email: assuranceCase.createdBy.email,
				},
			},
		};
	} catch (error) {
		console.error("Failed to list case permissions:", error);
		return { error: "Failed to list permissions" };
	}
}

/**
 * Shares a case with a user by email. Creates invite if user not found.
 * Requires ADMIN permission.
 */
export async function shareByEmail(
	userId: string,
	caseId: string,
	input: ShareByEmailInput
): ServiceResult<ShareByEmailResult> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate email
	if (!input.email?.includes("@")) {
		return { error: "Valid email is required" };
	}

	// Validate permission
	if (!isValidPermission(input.permission)) {
		return { error: "Invalid permission level" };
	}

	const email = input.email.toLowerCase().trim();

	try {
		// Find user by email
		const targetUser = await prisma.user.findUnique({
			where: { email },
			select: { id: true, username: true, avatarUrl: true },
		});

		if (targetUser) {
			// Check if user is the case owner (can't add permission to owner)
			const assuranceCase = await prisma.assuranceCase.findUnique({
				where: { id: caseId },
				select: { createdById: true },
			});

			if (assuranceCase?.createdById === targetUser.id) {
				return { data: { already_shared: true } };
			}

			// Check if already has permission
			const existingPermission = await prisma.casePermission.findUnique({
				where: {
					caseId_userId: { caseId, userId: targetUser.id },
				},
			});

			if (existingPermission) {
				return { data: { already_shared: true } };
			}

			// Grant permission
			const permission = await prisma.casePermission.create({
				data: {
					caseId,
					userId: targetUser.id,
					permission: input.permission,
					grantedById: userId,
				},
				include: {
					user: {
						select: {
							id: true,
							username: true,
							email: true,
							avatarUrl: true,
						},
					},
					grantedBy: {
						select: {
							id: true,
							username: true,
						},
					},
				},
			});

			return {
				data: {
					permission: {
						id: permission.id,
						case_id: permission.caseId,
						permission: permission.permission,
						granted_at: permission.grantedAt.toISOString(),
						user: {
							id: permission.user.id,
							username: permission.user.username,
							email: permission.user.email,
							avatar_url: permission.user.avatarUrl,
						},
						granted_by: {
							id: permission.grantedBy.id,
							username: permission.grantedBy.username,
						},
					},
				},
			};
		}

		// User not found — create invite via invite service
		const inviteResult = await createCaseInvite({
			caseId,
			email,
			permission: input.permission,
			invitedById: userId,
		});

		if ("error" in inviteResult) {
			return { error: inviteResult.error };
		}

		return {
			data: {
				invite_created: true,
				invite_token: inviteResult.data.invite_token,
			},
		};
	} catch (error) {
		console.error("Failed to share case:", error);
		return { error: "Failed to share case" };
	}
}

/**
 * Shares a case with a team. Requires ADMIN permission.
 */
export async function shareWithTeam(
	userId: string,
	caseId: string,
	input: ShareWithTeamInput
): ServiceResult<TeamPermissionResponse> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate permission
	if (!isValidPermission(input.permission)) {
		return { error: "Invalid permission level" };
	}

	try {
		// Check team exists and user is a member
		const { isTeamMember } = await import("@/lib/permissions");
		const isMember = await isTeamMember(userId, input.teamId);

		if (!isMember) {
			return { error: "Team not found" };
		}

		// Check if already shared with team
		const existingPermission = await prisma.caseTeamPermission.findUnique({
			where: {
				caseId_teamId: { caseId, teamId: input.teamId },
			},
		});

		if (existingPermission) {
			return { error: "Case already shared with this team" };
		}

		// Grant permission
		const permission = await prisma.caseTeamPermission.create({
			data: {
				caseId,
				teamId: input.teamId,
				permission: input.permission,
				grantedById: userId,
			},
			include: {
				team: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
		});

		return {
			data: {
				id: permission.id,
				case_id: permission.caseId,
				permission: permission.permission,
				granted_at: permission.grantedAt.toISOString(),
				team: {
					id: permission.team.id,
					name: permission.team.name,
					slug: permission.team.slug,
				},
			},
		};
	} catch (error) {
		console.error("Failed to share case with team:", error);
		return { error: "Failed to share case with team" };
	}
}

/**
 * Updates a user permission level. Requires ADMIN permission.
 */
export async function updateUserPermission(
	userId: string,
	caseId: string,
	permissionId: string,
	input: UpdatePermissionInput
): ServiceResult<UserPermissionResponse> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate permission
	if (!isValidPermission(input.permission)) {
		return { error: "Invalid permission level" };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prisma.casePermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Update permission
		const permission = await prisma.casePermission.update({
			where: { id: permissionId },
			data: { permission: input.permission },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						email: true,
						avatarUrl: true,
					},
				},
				grantedBy: {
					select: {
						id: true,
						username: true,
					},
				},
			},
		});

		return {
			data: {
				id: permission.id,
				case_id: permission.caseId,
				permission: permission.permission,
				granted_at: permission.grantedAt.toISOString(),
				user: {
					id: permission.user.id,
					username: permission.user.username,
					email: permission.user.email,
					avatar_url: permission.user.avatarUrl,
				},
				granted_by: {
					id: permission.grantedBy.id,
					username: permission.grantedBy.username,
				},
			},
		};
	} catch (error) {
		console.error("Failed to update permission:", error);
		return { error: "Failed to update permission" };
	}
}

/**
 * Updates a team permission level. Requires ADMIN permission.
 */
export async function updateTeamPermission(
	userId: string,
	caseId: string,
	permissionId: string,
	input: UpdatePermissionInput
): ServiceResult<TeamPermissionResponse> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate permission
	if (!isValidPermission(input.permission)) {
		return { error: "Invalid permission level" };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prisma.caseTeamPermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Update permission
		const permission = await prisma.caseTeamPermission.update({
			where: { id: permissionId },
			data: { permission: input.permission },
			include: {
				team: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
		});

		return {
			data: {
				id: permission.id,
				case_id: permission.caseId,
				permission: permission.permission,
				granted_at: permission.grantedAt.toISOString(),
				team: {
					id: permission.team.id,
					name: permission.team.name,
					slug: permission.team.slug,
				},
			},
		};
	} catch (error) {
		console.error("Failed to update team permission:", error);
		return { error: "Failed to update team permission" };
	}
}

/**
 * Revokes a user permission. Requires ADMIN permission.
 */
export async function revokeUserPermission(
	userId: string,
	caseId: string,
	permissionId: string
): ServiceResult {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prisma.casePermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Delete permission
		await prisma.casePermission.delete({
			where: { id: permissionId },
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to revoke permission:", error);
		return { error: "Failed to revoke permission" };
	}
}

/**
 * Revokes a team permission. Requires ADMIN permission.
 */
export async function revokeTeamPermission(
	userId: string,
	caseId: string,
	permissionId: string
): ServiceResult {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prisma.caseTeamPermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Delete permission
		await prisma.caseTeamPermission.delete({
			where: { id: permissionId },
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to revoke team permission:", error);
		return { error: "Failed to revoke team permission" };
	}
}
