"use server";

import { prismaNew } from "@/lib/prisma-new";
import type { TeamRole } from "@/src/generated/prisma-new";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

// ============================================
// INPUT INTERFACES
// ============================================

export type AddTeamMemberInput = {
	email: string;
	role?: "ADMIN" | "MEMBER";
};

export type UpdateMemberRoleInput = {
	role: "ADMIN" | "MEMBER";
};

// ============================================
// OUTPUT INTERFACES
// ============================================

export type TeamMemberResponse = {
	id: string;
	user_id: string;
	role: TeamRole;
	joined_at: string;
	user: {
		id: string;
		username: string;
		email: string;
		avatar_url: string | null;
	};
};

export type AddMemberResult = {
	member?: TeamMemberResponse;
	already_member?: boolean;
	user_not_found?: boolean;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates that a user has admin access to a team.
 */
async function validateTeamAdmin(
	userId: string,
	teamId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const { isTeamAdmin } = await import("@/lib/permissions");
	const hasAccess = await isTeamAdmin(userId, teamId);
	if (!hasAccess) {
		return { valid: false, error: "Permission denied" };
	}
	return { valid: true };
}

/**
 * Validates that a user is a member of a team.
 */
async function validateTeamMember(
	userId: string,
	teamId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const { isTeamMember } = await import("@/lib/permissions");
	const isMember = await isTeamMember(userId, teamId);
	if (!isMember) {
		return { valid: false, error: "Team not found" };
	}
	return { valid: true };
}

/**
 * Transforms a Prisma team member to the response format.
 */
function transformMemberToResponse(member: {
	id: string;
	userId: string;
	role: TeamRole;
	joinedAt: Date;
	user: {
		id: string;
		username: string;
		email: string;
		avatarUrl: string | null;
	};
}): TeamMemberResponse {
	return {
		id: member.id,
		user_id: member.userId,
		role: member.role,
		joined_at: member.joinedAt.toISOString(),
		user: {
			id: member.user.id,
			username: member.user.username,
			email: member.user.email,
			avatar_url: member.user.avatarUrl,
		},
	};
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Lists all members of a team. User must be a member.
 */
export async function getTeamMembers(
	userId: string,
	teamId: string
): Promise<{ data?: TeamMemberResponse[]; error?: string }> {
	if (!USE_PRISMA_AUTH) {
		return { error: "Prisma auth not enabled" };
	}

	// Validate membership
	const validation = await validateTeamMember(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		const members = await prismaNew.teamMember.findMany({
			where: { teamId },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						email: true,
						avatarUrl: true,
					},
				},
			},
			orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
		});

		return { data: members.map(transformMemberToResponse) };
	} catch (error) {
		console.error("Failed to get team members:", error);
		return { error: "Failed to get team members" };
	}
}

/**
 * Adds a new member to a team by email. Requires ADMIN role.
 * If user doesn't exist, returns user_not_found (caller can create invite).
 * If already a member, returns already_member.
 */
export async function addTeamMember(
	userId: string,
	teamId: string,
	input: AddTeamMemberInput
): Promise<{ data?: AddMemberResult; error?: string }> {
	if (!USE_PRISMA_AUTH) {
		return { error: "Prisma auth not enabled" };
	}

	// Validate admin access
	const validation = await validateTeamAdmin(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate email
	if (!input.email?.includes("@")) {
		return { error: "Valid email is required" };
	}

	const email = input.email.toLowerCase().trim();
	const role = input.role || "MEMBER";

	// Prevent adding as OWNER
	if (role !== "ADMIN" && role !== "MEMBER") {
		return { error: "Invalid role" };
	}

	try {
		// Find user by email
		const targetUser = await prismaNew.user.findUnique({
			where: { email },
			select: { id: true },
		});

		// User doesn't exist - return indicator (don't reveal user existence externally)
		if (!targetUser) {
			return { data: { user_not_found: true } };
		}

		// Check if already a member
		const existingMembership = await prismaNew.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUser.id },
			},
		});

		if (existingMembership) {
			return { data: { already_member: true } };
		}

		// Add member
		const member = await prismaNew.teamMember.create({
			data: {
				teamId,
				userId: targetUser.id,
				role,
				invitedById: userId,
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
			},
		});

		return { data: { member: transformMemberToResponse(member) } };
	} catch (error) {
		console.error("Failed to add team member:", error);
		return { error: "Failed to add team member" };
	}
}

/**
 * Updates a team member's role. Requires ADMIN role.
 * Cannot change own role or promote to OWNER.
 */
export async function updateMemberRole(
	userId: string,
	teamId: string,
	targetUserId: string,
	input: UpdateMemberRoleInput
): Promise<{ data?: TeamMemberResponse; error?: string }> {
	if (!USE_PRISMA_AUTH) {
		return { error: "Prisma auth not enabled" };
	}

	// Validate admin access
	const validation = await validateTeamAdmin(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Prevent changing own role
	if (userId === targetUserId) {
		return { error: "Cannot change your own role" };
	}

	// Validate role
	if (input.role !== "ADMIN" && input.role !== "MEMBER") {
		return { error: "Invalid role" };
	}

	try {
		// Check target is a member
		const targetMembership = await prismaNew.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		if (!targetMembership) {
			return { error: "Member not found" };
		}

		// Update role
		const member = await prismaNew.teamMember.update({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
			data: { role: input.role },
			include: {
				user: {
					select: {
						id: true,
						username: true,
						email: true,
						avatarUrl: true,
					},
				},
			},
		});

		return { data: transformMemberToResponse(member) };
	} catch (error) {
		console.error("Failed to update member role:", error);
		return { error: "Failed to update member role" };
	}
}

/**
 * Removes a member from a team. Requires ADMIN role.
 * Cannot remove self (use leaveTeam instead).
 */
export async function removeMember(
	userId: string,
	teamId: string,
	targetUserId: string
): Promise<{ success?: boolean; error?: string }> {
	if (!USE_PRISMA_AUTH) {
		return { error: "Prisma auth not enabled" };
	}

	// Validate admin access
	const validation = await validateTeamAdmin(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Prevent removing self
	if (userId === targetUserId) {
		return { error: "Cannot remove yourself. Use leave team instead." };
	}

	try {
		// Check target is a member
		const targetMembership = await prismaNew.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		if (!targetMembership) {
			return { error: "Member not found" };
		}

		// Remove member
		await prismaNew.teamMember.delete({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to remove member:", error);
		return { error: "Failed to remove member" };
	}
}

/**
 * Allows a user to leave a team.
 * Cannot leave if last admin (must transfer admin first).
 */
export async function leaveTeam(
	userId: string,
	teamId: string
): Promise<{ success?: boolean; error?: string }> {
	if (!USE_PRISMA_AUTH) {
		return { error: "Prisma auth not enabled" };
	}

	try {
		// Check membership
		const membership = await prismaNew.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId },
			},
		});

		if (!membership) {
			return { error: "Not a member of this team" };
		}

		// Check if last admin
		const { isLastTeamAdmin } = await import("@/lib/permissions");
		const isLast = await isLastTeamAdmin(userId, teamId);
		if (isLast) {
			return {
				error:
					"Cannot leave team as the last admin. Promote another member first.",
			};
		}

		// Remove membership
		await prismaNew.teamMember.delete({
			where: {
				teamId_userId: { teamId, userId },
			},
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to leave team:", error);
		return { error: "Failed to leave team" };
	}
}
