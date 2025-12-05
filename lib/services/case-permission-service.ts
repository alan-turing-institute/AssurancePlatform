"use server";

import { randomBytes } from "node:crypto";
import { prismaNew } from "@/lib/prisma-new";
import type { PermissionLevel } from "@/src/generated/prisma-new";

// ============================================
// INPUT INTERFACES
// ============================================

export type ShareByEmailInput = {
	email: string;
	permission: PermissionLevel;
};

export type ShareWithTeamInput = {
	teamId: string;
	permission: PermissionLevel;
};

export type UpdatePermissionInput = {
	permission: PermissionLevel;
};

// ============================================
// OUTPUT INTERFACES
// ============================================

export type UserPermissionResponse = {
	id: string;
	case_id: string;
	permission: PermissionLevel;
	granted_at: string;
	user: {
		id: string;
		username: string;
		email: string;
		avatar_url: string | null;
	};
	granted_by: {
		id: string;
		username: string;
	};
};

export type TeamPermissionResponse = {
	id: string;
	case_id: string;
	permission: PermissionLevel;
	granted_at: string;
	team: {
		id: string;
		name: string;
		slug: string;
	};
};

export type CasePermissionsListResponse = {
	user_permissions: UserPermissionResponse[];
	team_permissions: TeamPermissionResponse[];
	is_owner: boolean;
	owner: {
		id: string;
		username: string;
		email: string;
	};
};

export type ShareByEmailResult = {
	permission?: UserPermissionResponse;
	invite_created?: boolean;
	invite_token?: string;
	already_shared?: boolean;
};

export type CaseLockResponse = {
	is_locked: boolean;
	lock_uuid: string | null;
	locked_by_id: string | null;
	locked_at: string | null;
	locked_by?: {
		id: string;
		username: string;
	};
};

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
 * Validates that user has at least VIEW permission on a case.
 */
async function validateCaseView(
	userId: string,
	caseId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const { canAccessCase } = await import("@/lib/permissions");
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return { valid: false, error: "Case not found" };
	}
	return { valid: true };
}

/**
 * Generates a secure invite token.
 */
function generateInviteToken(): string {
	return randomBytes(32).toString("hex");
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
): Promise<{ data?: CasePermissionsListResponse; error?: string }> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Get case with owner info
		const assuranceCase = await prismaNew.assuranceCase.findUnique({
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
		const userPermissions = await prismaNew.casePermission.findMany({
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
		const teamPermissions = await prismaNew.caseTeamPermission.findMany({
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
): Promise<{ data?: ShareByEmailResult; error?: string }> {
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
		const targetUser = await prismaNew.user.findUnique({
			where: { email },
			select: { id: true, username: true, avatarUrl: true },
		});

		if (targetUser) {
			// Check if user is the case owner (can't add permission to owner)
			const assuranceCase = await prismaNew.assuranceCase.findUnique({
				where: { id: caseId },
				select: { createdById: true },
			});

			if (assuranceCase?.createdById === targetUser.id) {
				return { data: { already_shared: true } };
			}

			// Check if already has permission
			const existingPermission = await prismaNew.casePermission.findUnique({
				where: {
					caseId_userId: { caseId, userId: targetUser.id },
				},
			});

			if (existingPermission) {
				return { data: { already_shared: true } };
			}

			// Grant permission
			const permission = await prismaNew.casePermission.create({
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

		// User not found - create invite
		const token = generateInviteToken();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

		await prismaNew.caseInvite.create({
			data: {
				caseId,
				email,
				permission: input.permission,
				inviteToken: token,
				inviteExpiresAt: expiresAt,
				invitedById: userId,
			},
		});

		return {
			data: {
				invite_created: true,
				invite_token: token,
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
): Promise<{ data?: TeamPermissionResponse; error?: string }> {
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
		const existingPermission = await prismaNew.caseTeamPermission.findUnique({
			where: {
				caseId_teamId: { caseId, teamId: input.teamId },
			},
		});

		if (existingPermission) {
			return { error: "Case already shared with this team" };
		}

		// Grant permission
		const permission = await prismaNew.caseTeamPermission.create({
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
): Promise<{ data?: UserPermissionResponse; error?: string }> {
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
		const existingPermission = await prismaNew.casePermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Update permission
		const permission = await prismaNew.casePermission.update({
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
): Promise<{ data?: TeamPermissionResponse; error?: string }> {
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
		const existingPermission = await prismaNew.caseTeamPermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Update permission
		const permission = await prismaNew.caseTeamPermission.update({
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
): Promise<{ success?: boolean; error?: string }> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prismaNew.casePermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Delete permission
		await prismaNew.casePermission.delete({
			where: { id: permissionId },
		});

		return { success: true };
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
): Promise<{ success?: boolean; error?: string }> {
	// Validate admin access
	const validation = await validateCaseAdmin(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Verify permission exists and belongs to this case
		const existingPermission = await prismaNew.caseTeamPermission.findUnique({
			where: { id: permissionId },
		});

		if (!existingPermission || existingPermission.caseId !== caseId) {
			return { error: "Permission not found" };
		}

		// Delete permission
		await prismaNew.caseTeamPermission.delete({
			where: { id: permissionId },
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to revoke team permission:", error);
		return { error: "Failed to revoke team permission" };
	}
}

/**
 * Accepts a case invite using the token.
 */
export async function acceptInvite(
	userId: string,
	inviteToken: string
): Promise<{ success?: boolean; case_id?: string; error?: string }> {
	try {
		// Find invite
		const invite = await prismaNew.caseInvite.findUnique({
			where: { inviteToken },
		});

		if (!invite) {
			return { error: "Invalid invite" };
		}

		// Check if expired
		if (invite.inviteExpiresAt < new Date()) {
			return { error: "Invite has expired" };
		}

		// Check if already accepted
		if (invite.acceptedAt) {
			return { error: "Invite has already been used" };
		}

		// Get user email to verify match
		const _user = await prismaNew.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		// Optionally verify email matches (strict mode)
		// For now, allow any logged-in user to accept
		// if (user?.email.toLowerCase() !== invite.email.toLowerCase()) {
		//   return { error: "Invite was sent to a different email address" };
		// }

		// Check if user already has permission
		const existingPermission = await prismaNew.casePermission.findUnique({
			where: {
				caseId_userId: { caseId: invite.caseId, userId },
			},
		});

		if (!existingPermission) {
			// Grant permission
			await prismaNew.casePermission.create({
				data: {
					caseId: invite.caseId,
					userId,
					permission: invite.permission,
					grantedById: invite.invitedById,
				},
			});
		}

		// Mark invite as accepted
		await prismaNew.caseInvite.update({
			where: { inviteToken },
			data: {
				acceptedAt: new Date(),
				acceptedById: userId,
			},
		});

		return { success: true, case_id: invite.caseId };
	} catch (error) {
		console.error("Failed to accept invite:", error);
		return { error: "Failed to accept invite" };
	}
}

// ============================================
// LOCK/UNLOCK FUNCTIONS
// ============================================

/**
 * Gets the lock status of a case.
 */
export async function getCaseLockStatus(
	userId: string,
	caseId: string
): Promise<{ data?: CaseLockResponse; error?: string }> {
	// Validate view access
	const validation = await validateCaseView(userId, caseId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		const assuranceCase = await prismaNew.assuranceCase.findUnique({
			where: { id: caseId },
			select: {
				lockUuid: true,
				lockedById: true,
				lockedAt: true,
			},
		});

		if (!assuranceCase) {
			return { error: "Case not found" };
		}

		let lockedBy: { id: string; username: string } | undefined;
		if (assuranceCase.lockedById) {
			const lockedByUser = await prismaNew.user.findUnique({
				where: { id: assuranceCase.lockedById },
				select: { id: true, username: true },
			});
			lockedBy = lockedByUser ?? undefined;
		}

		return {
			data: {
				is_locked: !!assuranceCase.lockUuid,
				lock_uuid: assuranceCase.lockUuid,
				locked_by_id: assuranceCase.lockedById,
				locked_at: assuranceCase.lockedAt?.toISOString() ?? null,
				locked_by: lockedBy,
			},
		};
	} catch (error) {
		console.error("Failed to get lock status:", error);
		return { error: "Failed to get lock status" };
	}
}

/**
 * Locks a case for editing. Requires EDIT permission.
 */
export async function lockCase(
	userId: string,
	caseId: string
): Promise<{ data?: CaseLockResponse; error?: string }> {
	// Validate edit access
	const { canAccessCase } = await import("@/lib/permissions");
	const hasAccess = await canAccessCase({ userId, caseId }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		// Check if already locked
		const assuranceCase = await prismaNew.assuranceCase.findUnique({
			where: { id: caseId },
			select: { lockUuid: true, lockedById: true },
		});

		if (!assuranceCase) {
			return { error: "Case not found" };
		}

		if (assuranceCase.lockUuid) {
			if (assuranceCase.lockedById === userId) {
				// Already locked by this user - return current lock
				return getCaseLockStatus(userId, caseId);
			}
			return { error: "Case is already locked by another user" };
		}

		// Create lock
		const lockUuid = randomBytes(16).toString("hex");
		await prismaNew.assuranceCase.update({
			where: { id: caseId },
			data: {
				lockUuid,
				lockedById: userId,
				lockedAt: new Date(),
			},
		});

		return getCaseLockStatus(userId, caseId);
	} catch (error) {
		console.error("Failed to lock case:", error);
		return { error: "Failed to lock case" };
	}
}

/**
 * Unlocks a case. Must be the lock holder or ADMIN.
 */
export async function unlockCase(
	userId: string,
	caseId: string
): Promise<{ data?: CaseLockResponse; error?: string }> {
	try {
		// Get current lock state
		const assuranceCase = await prismaNew.assuranceCase.findUnique({
			where: { id: caseId },
			select: { lockUuid: true, lockedById: true },
		});

		if (!assuranceCase) {
			return { error: "Case not found" };
		}

		if (!assuranceCase.lockUuid) {
			// Already unlocked
			return getCaseLockStatus(userId, caseId);
		}

		// Check if user can unlock (lock holder or admin)
		const isLockHolder = assuranceCase.lockedById === userId;
		const { canAccessCase } = await import("@/lib/permissions");
		const isAdmin = await canAccessCase({ userId, caseId }, "ADMIN");

		if (!(isLockHolder || isAdmin)) {
			return { error: "Permission denied" };
		}

		// Release lock
		await prismaNew.assuranceCase.update({
			where: { id: caseId },
			data: {
				lockUuid: null,
				lockedById: null,
				lockedAt: null,
			},
		});

		return {
			data: {
				is_locked: false,
				lock_uuid: null,
				locked_by_id: null,
				locked_at: null,
			},
		};
	} catch (error) {
		console.error("Failed to unlock case:", error);
		return { error: "Failed to unlock case" };
	}
}
