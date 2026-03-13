import {
	isLastTeamAdmin,
	validateTeamAdmin,
	validateTeamMember,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { TeamRole } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

// ============================================
// INPUT INTERFACES
// ============================================

export interface AddTeamMemberInput {
	email: string;
	role?: "ADMIN" | "MEMBER";
}

export interface UpdateMemberRoleInput {
	role: "ADMIN" | "MEMBER";
}

// ============================================
// OUTPUT INTERFACES
// ============================================

export interface TeamMemberResponse {
	id: string;
	joined_at: string;
	role: TeamRole;
	user: {
		id: string;
		username: string;
		email: string;
		avatar_url: string | null;
	};
	user_id: string;
}

export interface AddMemberResult {
	already_member?: boolean;
	member?: TeamMemberResponse;
	user_not_found?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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
): ServiceResult<TeamMemberResponse[]> {
	// Validate membership
	const validation = await validateTeamMember(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		const members = await prisma.teamMember.findMany({
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
): ServiceResult<AddMemberResult> {
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
		const targetUser = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});

		// User doesn't exist - return indicator (don't reveal user existence externally)
		if (!targetUser) {
			return { data: { user_not_found: true } };
		}

		// Check if already a member
		const existingMembership = await prisma.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUser.id },
			},
		});

		if (existingMembership) {
			return { data: { already_member: true } };
		}

		// Add member
		const member = await prisma.teamMember.create({
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
): ServiceResult<TeamMemberResponse> {
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
		const targetMembership = await prisma.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		if (!targetMembership) {
			return { error: "Member not found" };
		}

		// Update role
		const member = await prisma.teamMember.update({
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
): ServiceResult {
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
		const targetMembership = await prisma.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		if (!targetMembership) {
			return { error: "Member not found" };
		}

		// Remove member
		await prisma.teamMember.delete({
			where: {
				teamId_userId: { teamId, userId: targetUserId },
			},
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to remove member:", error);
		return { error: "Failed to remove member" };
	}
}

/**
 * Allows a user to leave a team.
 * Cannot leave if last admin (must transfer admin first).
 */
export async function leaveTeam(userId: string, teamId: string): ServiceResult {
	try {
		// Check membership
		const membership = await prisma.teamMember.findUnique({
			where: {
				teamId_userId: { teamId, userId },
			},
		});

		if (!membership) {
			return { error: "Not a member of this team" };
		}

		// Check if last admin
		const isLast = await isLastTeamAdmin(userId, teamId);
		if (isLast) {
			return {
				error:
					"Cannot leave team as the last admin. Promote another member first.",
			};
		}

		// Remove membership
		await prisma.teamMember.delete({
			where: {
				teamId_userId: { teamId, userId },
			},
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to leave team:", error);
		return { error: "Failed to leave team" };
	}
}
