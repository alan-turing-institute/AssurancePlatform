"use server";

import { prismaNew } from "@/lib/prisma-new";
import type { TeamRole } from "@/src/generated/prisma-new";

// ============================================
// INPUT INTERFACES
// ============================================

export type CreateTeamInput = {
	name: string;
	description?: string;
};

export type UpdateTeamInput = {
	name?: string;
	description?: string;
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

export type TeamResponse = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	created_at: string;
	updated_at: string;
	created_by_id: string;
	member_count: number;
	my_role: TeamRole | null;
	members?: TeamMemberResponse[];
};

export type TeamListResponse = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	created_at: string;
	member_count: number;
	my_role: TeamRole;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generates a URL-friendly slug from a team name.
 * Appends a random suffix if needed for uniqueness.
 */
function generateSlug(name: string): string {
	const baseSlug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	// Add random suffix for uniqueness
	const suffix = Math.random().toString(36).substring(2, 8);
	return `${baseSlug}-${suffix}`;
}

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
async function _validateTeamMember(
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
 * Transforms a Prisma team to the response format.
 */
function transformToResponse(
	team: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		createdAt: Date;
		updatedAt: Date;
		createdById: string;
		members?: Array<{
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
		}>;
		_count?: { members: number };
	},
	userRole?: TeamRole | null
): TeamResponse {
	return {
		id: team.id,
		name: team.name,
		slug: team.slug,
		description: team.description,
		created_at: team.createdAt.toISOString(),
		updated_at: team.updatedAt.toISOString(),
		created_by_id: team.createdById,
		member_count: team._count?.members ?? team.members?.length ?? 0,
		my_role: userRole ?? null,
		members: team.members?.map((m) => ({
			id: m.id,
			user_id: m.userId,
			role: m.role,
			joined_at: m.joinedAt.toISOString(),
			user: {
				id: m.user.id,
				username: m.user.username,
				email: m.user.email,
				avatar_url: m.user.avatarUrl,
			},
		})),
	};
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Creates a new team with the user as ADMIN.
 */
export async function createTeam(
	userId: string,
	input: CreateTeamInput
): Promise<{ data?: TeamResponse; error?: string }> {
	if (!input.name || input.name.trim().length === 0) {
		return { error: "Team name is required" };
	}

	if (input.name.length > 100) {
		return { error: "Team name must be less than 100 characters" };
	}

	try {
		const slug = generateSlug(input.name.trim());

		const team = await prismaNew.team.create({
			data: {
				name: input.name.trim(),
				slug,
				description: input.description?.trim() || null,
				createdById: userId,
				members: {
					create: {
						userId,
						role: "ADMIN",
					},
				},
			},
			include: {
				members: {
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
				},
				_count: { select: { members: true } },
			},
		});

		return { data: transformToResponse(team, "ADMIN") };
	} catch (error) {
		console.error("Failed to create team:", error);
		return { error: "Failed to create team" };
	}
}

/**
 * Gets a team by ID if the user is a member.
 */
export async function getTeam(
	userId: string,
	teamId: string
): Promise<{ data?: TeamResponse; error?: string }> {
	try {
		// Get team with membership check
		const team = await prismaNew.team.findUnique({
			where: { id: teamId },
			include: {
				members: {
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
				},
				_count: { select: { members: true } },
			},
		});

		if (!team) {
			return { error: "Team not found" };
		}

		// Check if user is a member
		const userMembership = team.members.find((m) => m.userId === userId);
		if (!userMembership) {
			// Don't reveal that team exists
			return { error: "Team not found" };
		}

		return { data: transformToResponse(team, userMembership.role) };
	} catch (error) {
		console.error("Failed to get team:", error);
		return { error: "Failed to get team" };
	}
}

/**
 * Lists all teams that a user is a member of.
 */
export async function listUserTeams(
	userId: string
): Promise<{ data?: TeamListResponse[]; error?: string }> {
	try {
		const memberships = await prismaNew.teamMember.findMany({
			where: { userId },
			include: {
				team: {
					include: {
						_count: { select: { members: true } },
					},
				},
			},
			orderBy: { joinedAt: "desc" },
		});

		const teams: TeamListResponse[] = memberships.map((m) => ({
			id: m.team.id,
			name: m.team.name,
			slug: m.team.slug,
			description: m.team.description,
			created_at: m.team.createdAt.toISOString(),
			member_count: m.team._count.members,
			my_role: m.role,
		}));

		return { data: teams };
	} catch (error) {
		console.error("Failed to list teams:", error);
		return { error: "Failed to list teams" };
	}
}

/**
 * Updates a team. Requires ADMIN role.
 */
export async function updateTeam(
	userId: string,
	teamId: string,
	input: UpdateTeamInput
): Promise<{ data?: TeamResponse; error?: string }> {
	// Validate admin access
	const validation = await validateTeamAdmin(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	// Validate input
	if (input.name !== undefined) {
		if (input.name.trim().length === 0) {
			return { error: "Team name is required" };
		}
		if (input.name.length > 100) {
			return { error: "Team name must be less than 100 characters" };
		}
	}

	try {
		const team = await prismaNew.team.update({
			where: { id: teamId },
			data: {
				...(input.name !== undefined && { name: input.name.trim() }),
				...(input.description !== undefined && {
					description: input.description?.trim() || null,
				}),
			},
			include: {
				members: {
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
				},
				_count: { select: { members: true } },
			},
		});

		// Get user's role for response
		const userMembership = team.members.find((m) => m.userId === userId);

		return { data: transformToResponse(team, userMembership?.role) };
	} catch (error) {
		console.error("Failed to update team:", error);
		return { error: "Failed to update team" };
	}
}

/**
 * Deletes a team. Requires ADMIN role.
 */
export async function deleteTeam(
	userId: string,
	teamId: string
): Promise<{ success?: boolean; error?: string }> {
	// Validate admin access
	const validation = await validateTeamAdmin(userId, teamId);
	if (!validation.valid) {
		return { error: validation.error };
	}

	try {
		// Delete team (cascade deletes members and permissions)
		await prismaNew.team.delete({
			where: { id: teamId },
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to delete team:", error);
		return { error: "Failed to delete team" };
	}
}

/**
 * Gets a team by slug (for URL-friendly access).
 */
export async function getTeamBySlug(
	userId: string,
	slug: string
): Promise<{ data?: TeamResponse; error?: string }> {
	try {
		const team = await prismaNew.team.findUnique({
			where: { slug },
			include: {
				members: {
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
				},
				_count: { select: { members: true } },
			},
		});

		if (!team) {
			return { error: "Team not found" };
		}

		// Check if user is a member
		const userMembership = team.members.find((m) => m.userId === userId);
		if (!userMembership) {
			return { error: "Team not found" };
		}

		return { data: transformToResponse(team, userMembership.role) };
	} catch (error) {
		console.error("Failed to get team:", error);
		return { error: "Failed to get team" };
	}
}
