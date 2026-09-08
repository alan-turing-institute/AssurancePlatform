import type { PermissionLevel, TeamRole } from "@/src/generated/prisma";

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

interface CasePermissionResult {
	hasAccess: boolean;
	isOwner: boolean;
	permission: PermissionLevel | null;
}

interface CasePermissionOptions {
	/**
	 * When true, skips the trash-invisibility gate: a soft-deleted case is
	 * treated as visible and the full permission logic below still runs.
	 * The permission check itself is never bypassed — only the "trashed
	 * cases don't exist" gate is opted out of. Used by `softDeleteCase`,
	 * which needs to distinguish "already in trash" from "not found".
	 */
	includeTrashed?: boolean;
}

/**
 * Gets a user's effective permission level on a case using Prisma.
 * Combines direct user permissions and team-based permissions.
 *
 * Soft-deleted (trashed) cases are treated as not-found by default: the
 * same response shape is returned for "no such case" and "case is in
 * trash", per the resource-enumeration rule. Pass
 * `{ includeTrashed: true }` to opt a caller into seeing trashed cases —
 * the permission logic below still applies in full; only the
 * trash-invisibility gate is skipped.
 */
async function getCasePermissionFromPrisma(
	userId: string,
	caseId: string,
	options?: CasePermissionOptions
): Promise<CasePermissionResult> {
	const { prisma } = await import("@/lib/prisma");

	// First, check if user is the case creator (implicit owner)
	const assuranceCase = await prisma.assuranceCase.findUnique({
		where: { id: caseId },
		select: { createdById: true, deletedAt: true },
	});

	if (!assuranceCase) {
		return { hasAccess: false, permission: null, isOwner: false };
	}

	if (assuranceCase.deletedAt && !options?.includeTrashed) {
		// Same shape as "not found" — prevents distinguishing a trashed case
		// from a nonexistent one via the permission response.
		return { hasAccess: false, permission: null, isOwner: false };
	}

	const isOwner = assuranceCase.createdById === userId;
	if (isOwner) {
		return { hasAccess: true, permission: "ADMIN", isOwner: true };
	}

	// Get direct user permission and team-based permissions in parallel
	const [userPermission, teamPermissions] = await Promise.all([
		prisma.casePermission.findUnique({
			where: {
				caseId_userId: { caseId, userId },
			},
			select: { permission: true },
		}),
		prisma.caseTeamPermission.findMany({
			where: {
				caseId,
				team: {
					members: {
						some: { userId },
					},
				},
			},
			select: { permission: true },
		}),
	]);

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
 *
 * By default, a soft-deleted (trashed) case is invisible: the result is
 * identical to a nonexistent case. Pass `{ includeTrashed: true }` to see
 * a trashed case's permissions — the permission logic still applies in
 * full, only the trash-invisibility gate is skipped.
 */
export async function getCasePermission(
	{
		userId,
		caseId,
	}: {
		userId: string;
		caseId: string;
	},
	options?: CasePermissionOptions
): Promise<CasePermissionResult> {
	return await getCasePermissionFromPrisma(userId, caseId, options);
}

/**
 * Checks if a user can perform a specific action on a case.
 *
 * By default, a soft-deleted (trashed) case is treated as inaccessible to
 * everyone, including its creator and any grantee. Pass
 * `{ includeTrashed: true }` to opt in to seeing trashed cases — the
 * permission check itself still runs in full.
 */
export async function canAccessCase(
	{ userId, caseId }: { userId: string; caseId: string },
	requiredPermission: PermissionLevel = "VIEW",
	options?: CasePermissionOptions
): Promise<boolean> {
	const result = await getCasePermission({ userId, caseId }, options);
	if (!(result.hasAccess && result.permission)) {
		return false;
	}
	return hasPermissionLevel(result.permission, requiredPermission);
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

interface TeamMembershipResult {
	isMember: boolean;
	role: TeamRole | null;
}

/**
 * Gets a user's role in a team.
 * Returns null if user is not a member.
 */
export async function getTeamRole(
	userId: string,
	teamId: string
): Promise<TeamRole | null> {
	const { prisma } = await import("@/lib/prisma");

	const membership = await prisma.teamMember.findUnique({
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
 * Validates that a user has admin access to a team.
 * Returns a typed result for use in service-layer permission guards.
 */
export async function validateTeamAdmin(
	userId: string,
	teamId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const isAdmin = await isTeamAdmin(userId, teamId);
	if (!isAdmin) {
		return { valid: false, error: "Permission denied" };
	}
	return { valid: true };
}

/**
 * Validates that a user is a member of a team.
 * Returns a typed result for use in service-layer permission guards.
 */
export async function validateTeamMember(
	userId: string,
	teamId: string
): Promise<{ valid: true } | { valid: false; error: string }> {
	const isMember = await isTeamMember(userId, teamId);
	if (!isMember) {
		return { valid: false, error: "Permission denied" };
	}
	return { valid: true };
}

/**
 * Checks if a user is the last admin of a team.
 * Used to prevent removing the last admin.
 */
export async function isLastTeamAdmin(
	userId: string,
	teamId: string
): Promise<boolean> {
	const { prisma } = await import("@/lib/prisma");

	// Check if user is an admin
	const userRole = await getTeamRole(userId, teamId);
	if (!(userRole && hasTeamRole(userRole, "ADMIN"))) {
		return false;
	}

	// Count other admins
	const adminCount = await prisma.teamMember.count({
		where: {
			teamId,
			role: { in: ["ADMIN", "OWNER"] },
			userId: { not: userId },
		},
	});

	return adminCount === 0;
}
