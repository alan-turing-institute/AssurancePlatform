import type { PermissionLevel, TeamRole } from "@/src/generated/prisma-new";

// Feature flag for Prisma-based permissions
const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

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
 * Gets a user's permission on a case from Django API.
 */
async function getCasePermissionFromDjango(
	token: string,
	caseId: string
): Promise<CasePermissionResult> {
	const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
	if (!apiUrl) {
		throw new Error("API_URL or NEXT_PUBLIC_API_URL must be configured");
	}

	// Django uses numeric case IDs
	const response = await fetch(`${apiUrl}/api/cases/${caseId}/`, {
		headers: {
			Authorization: `Token ${token}`,
		},
	});

	if (!response.ok) {
		if (response.status === 404 || response.status === 403) {
			return { hasAccess: false, permission: null, isOwner: false };
		}
		throw new Error(`Django API returned status ${response.status}`);
	}

	const data = await response.json();

	// Django returns permissions in a different format
	// Map to our permission levels
	const permissionMap: Record<string, PermissionLevel> = {
		view: "VIEW",
		comment: "COMMENT",
		edit: "EDIT",
		manage: "ADMIN",
	};

	return {
		hasAccess: true,
		permission: permissionMap[data.permission] ?? "VIEW",
		isOwner: data.owner === true,
	};
}

type GetCasePermissionParams =
	| { userId: string; caseId: string; token?: never }
	| { userId?: never; caseId: string; token: string };

/**
 * Gets a user's effective permission level on a case.
 * Uses Prisma or Django based on the feature flag.
 */
export async function getCasePermission(
	params: GetCasePermissionParams
): Promise<CasePermissionResult> {
	const { caseId } = params;

	if (USE_PRISMA_AUTH) {
		if (!("userId" in params && params.userId)) {
			throw new Error("userId is required for Prisma auth");
		}
		return await getCasePermissionFromPrisma(params.userId, caseId);
	}

	if (!("token" in params && params.token)) {
		throw new Error("token is required for Django auth");
	}
	return await getCasePermissionFromDjango(params.token, caseId);
}

/**
 * Checks if a user can perform a specific action on a case.
 */
export async function canAccessCase(
	params: GetCasePermissionParams,
	requiredPermission: PermissionLevel = "VIEW"
): Promise<boolean> {
	const result = await getCasePermission(params);
	if (!(result.hasAccess && result.permission)) {
		return false;
	}
	return hasPermissionLevel(result.permission, requiredPermission);
}

/**
 * Validates the current session and returns user ID if valid.
 * Works with both Django and Prisma auth.
 */
export async function validateSession(
	sessionKey: string
): Promise<{ valid: true; userId: string } | { valid: false; reason: string }> {
	if (USE_PRISMA_AUTH) {
		const { validateRefreshToken } = await import(
			"@/lib/auth/refresh-token-service"
		);
		return validateRefreshToken(sessionKey);
	}

	// For Django auth, we don't have direct user ID - caller must use token
	// This is a limitation of the Django API which doesn't expose user ID directly
	// from the token validation
	return {
		valid: false,
		reason: "Django auth requires API call for validation",
	};
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
	if (!USE_PRISMA_AUTH) {
		return null;
	}

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
	return isTeamAdmin(userId, teamId);
}

/**
 * Checks if a user is the last admin of a team.
 * Used to prevent removing the last admin.
 */
export async function isLastTeamAdmin(
	userId: string,
	teamId: string
): Promise<boolean> {
	if (!USE_PRISMA_AUTH) {
		return false;
	}

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
