import type { PermissionLevel, TeamRole } from "@/src/generated/prisma-new";

/**
 * Team role hierarchy (higher index = more permissions)
 * Note: We use ADMIN/MEMBER only. OWNER is reserved for future use.
 */
const TEAM_ROLE_HIERARCHY: TeamRole[] = ["MEMBER", "ADMIN", "OWNER"];

/**
 * Permission level hierarchy (higher index = more permissions)
 */
const PERMISSION_HIERARCHY: PermissionLevel[] = [
	"VIEW",
	"COMMENT",
	"EDIT",
	"ADMIN",
];

/**
 * Checks if a permission level meets or exceeds the required level.
 */
export function hasPermissionLevel(
	userPermission: PermissionLevel,
	requiredPermission: PermissionLevel
): boolean {
	const userIndex = PERMISSION_HIERARCHY.indexOf(userPermission);
	const requiredIndex = PERMISSION_HIERARCHY.indexOf(requiredPermission);
	return userIndex >= requiredIndex;
}

/**
 * Returns the higher of two permission levels.
 */
function maxPermission(
	a: PermissionLevel | null,
	b: PermissionLevel | null
): PermissionLevel | null {
	if (!a) {
		return b;
	}
	if (!b) {
		return a;
	}
	const aIndex = PERMISSION_HIERARCHY.indexOf(a);
	const bIndex = PERMISSION_HIERARCHY.indexOf(b);
	return aIndex >= bIndex ? a : b;
}

type CasePermissionResult = {
	hasAccess: boolean;
	permission: PermissionLevel | null;
	isOwner: boolean;
};

/**
 * Gets a user's effective permission level on a case using Prisma.
 * Combines direct user permissions and team-based permissions.
 */
async function getCasePermissionFromPrisma(
	userId: string,
	caseId: string
): Promise<CasePermissionResult> {
	const { prismaNew } = await import("@/lib/prisma-new");

	// First, check if user is the case creator (implicit owner)
	const assuranceCase = await prismaNew.assuranceCase.findUnique({
		where: { id: caseId },
		select: { createdById: true },
	});

	if (!assuranceCase) {
		return { hasAccess: false, permission: null, isOwner: false };
	}

	const isOwner = assuranceCase.createdById === userId;
	if (isOwner) {
		return { hasAccess: true, permission: "ADMIN", isOwner: true };
	}

	// Get direct user permission
	const userPermission = await prismaNew.casePermission.findUnique({
		where: {
			caseId_userId: { caseId, userId },
		},
		select: { permission: true },
	});

	// Get team-based permissions
	const teamPermissions = await prismaNew.caseTeamPermission.findMany({
		where: {
			caseId,
			team: {
				members: {
					some: { userId },
				},
			},
		},
		select: { permission: true },
	});

	// Calculate highest permission from teams
	let teamPermission: PermissionLevel | null = null;
	for (const tp of teamPermissions) {
		teamPermission = maxPermission(teamPermission, tp.permission);
	}

	// Get the highest of user and team permissions
	const effectivePermission = maxPermission(
		userPermission?.permission ?? null,
		teamPermission
	);

	return {
		hasAccess: effectivePermission !== null,
		permission: effectivePermission,
		isOwner: false,
	};
}

/**
 * Gets a user's effective permission level on a case.
 */
export async function getCasePermission({
	userId,
	caseId,
}: {
	userId: string;
	caseId: string;
}): Promise<CasePermissionResult> {
	return await getCasePermissionFromPrisma(userId, caseId);
}

/**
 * Checks if a user can perform a specific action on a case.
 */
export async function canAccessCase(
	{ userId, caseId }: { userId: string; caseId: string },
	requiredPermission: PermissionLevel = "VIEW"
): Promise<boolean> {
	const result = await getCasePermission({ userId, caseId });
	if (!(result.hasAccess && result.permission)) {
		return false;
	}
	return hasPermissionLevel(result.permission, requiredPermission);
}

/**
 * Validates the current session and returns user ID if valid.
 */
export async function validateSession(
	sessionKey: string
): Promise<{ valid: true; userId: string } | { valid: false; reason: string }> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	return validateRefreshToken(sessionKey);
}

// ============================================
// TEAM PERMISSION HELPERS
// ============================================

/**
 * Checks if a team role meets or exceeds the required role.
 */
export function hasTeamRole(
	userRole: TeamRole,
	requiredRole: TeamRole
): boolean {
	const userIndex = TEAM_ROLE_HIERARCHY.indexOf(userRole);
	const requiredIndex = TEAM_ROLE_HIERARCHY.indexOf(requiredRole);
	return userIndex >= requiredIndex;
}

type TeamMembershipResult = {
	isMember: boolean;
	role: TeamRole | null;
};

/**
 * Gets a user's role in a team.
 * Returns null if user is not a member.
 */
export async function getTeamRole(
	userId: string,
	teamId: string
): Promise<TeamRole | null> {
	const { prismaNew } = await import("@/lib/prisma-new");

	const membership = await prismaNew.teamMember.findUnique({
		where: {
			teamId_userId: { teamId, userId },
		},
		select: { role: true },
	});

	return membership?.role ?? null;
}

/**
 * Gets full team membership info for a user.
 */
export async function getTeamMembership(
	userId: string,
	teamId: string
): Promise<TeamMembershipResult> {
	const role = await getTeamRole(userId, teamId);
	return {
		isMember: role !== null,
		role,
	};
}

/**
 * Checks if a user is a team admin (ADMIN or OWNER role).
 * Note: We currently only use ADMIN role; OWNER is reserved for future.
 */
export async function isTeamAdmin(
	userId: string,
	teamId: string
): Promise<boolean> {
	const role = await getTeamRole(userId, teamId);
	if (!role) {
		return false;
	}
	return hasTeamRole(role, "ADMIN");
}

/**
 * Checks if a user is a member of a team (any role).
 */
export async function isTeamMember(
	userId: string,
	teamId: string
): Promise<boolean> {
	const role = await getTeamRole(userId, teamId);
	return role !== null;
}

/**
 * Checks if a user can manage a team (add/remove members, update settings).
 * Requires ADMIN role.
 */
export async function canManageTeam(
	userId: string,
	teamId: string
): Promise<boolean> {
	return await isTeamAdmin(userId, teamId);
}

/**
 * Checks if a user is the last admin of a team.
 * Used to prevent removing the last admin.
 */
export async function isLastTeamAdmin(
	userId: string,
	teamId: string
): Promise<boolean> {
	const { prismaNew } = await import("@/lib/prisma-new");

	// Check if user is an admin
	const userRole = await getTeamRole(userId, teamId);
	if (!(userRole && hasTeamRole(userRole, "ADMIN"))) {
		return false;
	}

	// Count other admins
	const adminCount = await prismaNew.teamMember.count({
		where: {
			teamId,
			role: { in: ["ADMIN", "OWNER"] },
			userId: { not: userId },
		},
	});

	return adminCount === 0;
}
