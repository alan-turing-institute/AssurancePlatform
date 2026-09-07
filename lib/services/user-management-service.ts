import {
	hashPassword,
	type PasswordAlgorithm,
	verifyPassword,
} from "@/lib/auth/password-service";
import { prisma } from "@/lib/prisma";
import { countIntegrationsOwnedBy } from "@/lib/services/integration-registry-service";
import {
	validateEmail,
	validatePassword,
	validateUsername,
} from "@/lib/validation/validators";
import type { ServiceResult } from "@/types/service";

// ============================================
// Types
// ============================================

export interface UpdateProfileInput {
	email?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

export interface ChangePasswordInput {
	currentPassword: string;
	newPassword: string;
}

// ============================================
// Profile Update
// ============================================

interface ValidationError {
	error: string;
}

/**
 * Validates and checks uniqueness of a username.
 */
async function validateAndCheckUsername(
	username: string,
	userId: string
): Promise<ValidationError | null> {
	const validation = validateUsername(username);
	if (!validation.valid) {
		return { error: validation.error };
	}

	const existingUser = await prisma.user.findFirst({
		where: {
			username: { equals: username, mode: "insensitive" },
			id: { not: userId },
		},
		select: { id: true },
	});

	if (existingUser) {
		return { error: "Username is already taken" };
	}

	return null;
}

/**
 * Validates and checks uniqueness of an email.
 */
async function validateAndCheckEmail(
	email: string,
	userId: string
): Promise<ValidationError | null> {
	const validation = validateEmail(email);
	if (!validation.valid) {
		return { error: validation.error };
	}

	const existingUser = await prisma.user.findFirst({
		where: {
			email: { equals: email, mode: "insensitive" },
			id: { not: userId },
		},
		select: { id: true },
	});

	if (existingUser) {
		return { error: "Email address is already in use" };
	}

	return null;
}

interface ProfileData {
	firstName?: string;
	lastName?: string;
	username: string;
}

function toProfileData(user: {
	username: string;
	firstName: string | null;
	lastName: string | null;
}): ProfileData {
	return {
		username: user.username,
		firstName: user.firstName ?? undefined,
		lastName: user.lastName ?? undefined,
	};
}

async function validateProfileInput(
	input: UpdateProfileInput,
	userId: string
): Promise<ValidationError | null> {
	if (input.username !== undefined) {
		const error = await validateAndCheckUsername(input.username, userId);
		if (error) {
			return error;
		}
	}
	if (input.email !== undefined) {
		const error = await validateAndCheckEmail(input.email, userId);
		if (error) {
			return error;
		}
	}
	return null;
}

function buildProfileUpdateData(input: UpdateProfileInput) {
	const data: Partial<UpdateProfileInput> = {};
	if (input.username !== undefined) {
		data.username = input.username;
	}
	if (input.firstName !== undefined) {
		data.firstName = input.firstName;
	}
	if (input.lastName !== undefined) {
		data.lastName = input.lastName;
	}
	if (input.email !== undefined) {
		data.email = input.email;
	}
	return data;
}

/**
 * Updates a user's profile information including email.
 */
export async function updateUserProfile(
	userId: string,
	input: UpdateProfileInput
): ServiceResult<ProfileData> {
	try {
		const validationError = await validateProfileInput(input, userId);
		if (validationError) {
			return validationError;
		}

		const updateData = buildProfileUpdateData(input);
		const selectFields = {
			username: true,
			firstName: true,
			lastName: true,
		} as const;

		// Skip update if nothing to change
		if (Object.keys(updateData).length === 0) {
			const currentUser = await prisma.user.findUnique({
				where: { id: userId },
				select: selectFields,
			});
			if (!currentUser) {
				return { error: "User not found" };
			}
			return { data: toProfileData(currentUser) };
		}

		const user = await prisma.user.update({
			where: { id: userId },
			data: updateData,
			select: selectFields,
		});

		return {
			data: toProfileData(user),
		};
	} catch (error) {
		console.error("Error updating user profile:", error);
		return { error: "Failed to update profile" };
	}
}

// ============================================
// Password Change
// ============================================

/**
 * Changes a user's password.
 * Verifies current password, validates new password, and revokes all sessions.
 */
export async function changePassword(
	userId: string,
	input: ChangePasswordInput
): ServiceResult {
	try {
		// Validate new password
		const passwordValidation = validatePassword(input.newPassword);
		if (!passwordValidation.valid) {
			return { error: passwordValidation.error };
		}

		// Get user's current password hash
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				passwordHash: true,
				passwordAlgorithm: true,
				authProvider: true,
			},
		});

		if (!user) {
			return { error: "User not found" };
		}

		// Only local auth users can change password
		if (user.authProvider !== "LOCAL") {
			return { error: "Password change is not available for OAuth accounts" };
		}

		if (!user.passwordHash) {
			return { error: "No password set for this account" };
		}

		// Verify current password
		const { valid } = await verifyPassword(
			input.currentPassword,
			user.passwordHash,
			user.passwordAlgorithm as PasswordAlgorithm
		);

		if (!valid) {
			return { error: "Current password is incorrect" };
		}

		// Hash new password with argon2id
		const newHash = await hashPassword(input.newPassword);

		// Update password
		await prisma.user.update({
			where: { id: userId },
			data: {
				passwordHash: newHash,
				passwordAlgorithm: "argon2id",
				// Clear any pending password reset
				passwordResetToken: null,
				passwordResetExpires: null,
			},
		});

		return { data: true };
	} catch (error) {
		console.error("Error changing password:", error);
		return { error: "Failed to change password" };
	}
}

// ============================================
// Account Deletion
// ============================================

const SYSTEM_USER_EMAIL = "system@tea-platform.internal";
const SYSTEM_USER_USERNAME = "system";

/**
 * Options for the account-deletion transaction. No existing shared
 * interactive-transaction constant in this repo (checked: `case-import-
 * service.ts` deliberately keeps Prisma's default 5s timeout because its
 * transaction does a fixed, small number of round trips regardless of
 * payload size). This transaction's round trips scale with how much
 * history the user has (owned cases, teams, comments, elements,
 * permissions granted), so a user with a lot of it can plausibly exceed
 * the 5s default (vincent, review round 2, should-fix) — widened here,
 * not globally.
 */
const DELETION_TRANSACTION_TIMEOUT_MS = 30_000;
const DELETION_TRANSACTION_MAX_WAIT_MS = 10_000;

/**
 * Gets or creates the generic fallback system user for ownership transfer
 * (used when a human account is deleted).
 *
 * Selects by the stable `SYSTEM_USER_EMAIL` identifier, NOT bare
 * `isSystemUser: true` — a bare-flag lookup is a privilege-escalation
 * hazard once integration system users exist (ADR 0002 v2 §2.4, feasibility
 * review R2): `findFirst({ isSystemUser: true })` returns whichever system
 * user Postgres happens to return first, which could just as easily be an
 * integration's machine principal as this fallback account. Deleted users'
 * case ownership — createdById, i.e. implicit ADMIN — would then be
 * reassigned to an integration's principal instead of the intended generic
 * account, handing that integration elevated access it never had.
 */
async function getOrCreateSystemUser(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
	let systemUser = await tx.user.findFirst({
		where: { email: SYSTEM_USER_EMAIL, isSystemUser: true },
		select: { id: true },
	});

	if (!systemUser) {
		systemUser = await tx.user.create({
			data: {
				email: SYSTEM_USER_EMAIL,
				username: SYSTEM_USER_USERNAME,
				isSystemUser: true,
				authProvider: "SYSTEM",
				emailVerified: true,
			},
			select: { id: true },
		});
	}

	return systemUser.id;
}

/**
 * Whether `userId`'s account can be deleted at all, independent of *how*
 * it is being deleted (self-service with a password, or the retention
 * sweep without one). Extracted (QA round 1, D2) so the retention sweep's
 * dry-run branch can report exactly the same skip a real run would hit,
 * instead of the dry-run and real counts disagreeing on accounts an
 * integration blocks.
 *
 * Integrations are NOT silently cascade-deleted: `Integration.ownerId` is an
 * unconditional `ON DELETE RESTRICT` (ADR 0002 v2 §2.4 — a revoked
 * integration keeps its accountability trail, so its owner reference must
 * never silently vanish). Without this check, `tx.user.delete` would throw
 * a raw Postgres P2003 that the caller's catch-all flattens into an
 * unhelpful "Failed to delete account". Checking `countIntegrationsOwnedBy`
 * first turns that into a clean, typed, actionable error instead —
 * "Remove your N integration(s) before deleting your account".
 */
export async function checkDeletable(
	userId: string
): Promise<{ deletable: true } | { deletable: false; error: string }> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true },
	});

	if (!user) {
		return { deletable: false, error: "User not found" };
	}

	const ownedIntegrationCount = await countIntegrationsOwnedBy(userId);
	if ("error" in ownedIntegrationCount) {
		return { deletable: false, error: ownedIntegrationCount.error };
	}
	if (ownedIntegrationCount.data > 0) {
		const count = ownedIntegrationCount.data;
		return {
			deletable: false,
			error: `Remove your ${count} integration${count === 1 ? "" : "s"} before deleting your account`,
		};
	}

	return { deletable: true };
}

/**
 * Deletes a user account. Transfers owned cases and anonymises comments
 * before deletion (see `runAccountDeletionTransaction` for the case-by-case
 * keep/trash rule). Requires password confirmation for local auth users.
 * Reassignment has no path in 1.0 (vincent minor, review round 2 — this
 * used to promise "reassign or remove"; only removal is actually offered),
 * so `checkDeletable`'s message promises only that.
 */
export async function deleteAccount(
	userId: string,
	password?: string
): ServiceResult {
	try {
		// Get user info
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				passwordHash: true,
				passwordAlgorithm: true,
				authProvider: true,
			},
		});

		if (!user) {
			return { error: "User not found" };
		}

		const deletable = await checkDeletable(userId);
		if (!deletable.deletable) {
			return { error: deletable.error };
		}

		// Verify password for local auth users
		if (user.authProvider === "LOCAL") {
			if (!password) {
				return { error: "Password is required to delete account" };
			}

			if (!user.passwordHash) {
				return { error: "Cannot verify account" };
			}

			const { valid } = await verifyPassword(
				password,
				user.passwordHash,
				user.passwordAlgorithm as PasswordAlgorithm
			);

			if (!valid) {
				return { error: "Password is incorrect" };
			}
		}

		await runAccountDeletionTransaction(userId);

		return { data: true };
	} catch (error) {
		console.error("Error deleting account:", error);
		return { error: "Failed to delete account" };
	}
}

/**
 * Splits `userId`'s created cases into those to keep (authorship
 * reassigned to the system account, as before) and those to trash, per
 * Chris's ruling (2026-09-07): a case is kept only if at least one OTHER
 * principal already holds ADMIN on it — another user's direct
 * `CasePermission` at ADMIN, or a team's `CaseTeamPermission` at ADMIN
 * (Chris: "fair assumption, I'm okay with this"). Otherwise nobody but the
 * deleted user could ever administer it, so it is trashed rather than
 * silently orphaned under the system account.
 */
async function partitionCasesToKeepOrTrash(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
	userId: string,
	caseIds: string[]
): Promise<{ toKeep: string[]; toTrash: string[] }> {
	if (caseIds.length === 0) {
		return { toKeep: [], toTrash: [] };
	}

	const [adminUserPermissions, adminTeamPermissions] = await Promise.all([
		tx.casePermission.findMany({
			where: {
				caseId: { in: caseIds },
				permission: "ADMIN",
				userId: { not: userId },
			},
			select: { caseId: true },
		}),
		// A team-ADMIN grant only counts as "another admin" if the team has a
		// member other than the user being deleted (vincent, review round 2,
		// blocker): a team of one is the deleted user themselves, and
		// `runAccountDeletionTransaction`'s team-handling step deletes exactly
		// that kind of team, cascading its CaseTeamPermission away — a case
		// "kept" on a team-of-one grant would end up owned by the system
		// account with no permissions for anyone, orphaned and never trashed.
		tx.caseTeamPermission.findMany({
			where: {
				caseId: { in: caseIds },
				permission: "ADMIN",
				team: { members: { some: { userId: { not: userId } } } },
			},
			select: { caseId: true },
		}),
	]);

	const casesWithOtherAdmin = new Set([
		...adminUserPermissions.map((p) => p.caseId),
		...adminTeamPermissions.map((p) => p.caseId),
	]);

	const toKeep: string[] = [];
	const toTrash: string[] = [];
	for (const caseId of caseIds) {
		(casesWithOtherAdmin.has(caseId) ? toKeep : toTrash).push(caseId);
	}
	return { toKeep, toTrash };
}

/**
 * The cascade shared by every account-deletion path.
 *
 * Cases the user created: kept (authorship reassigned to the system
 * account, as before) if another principal already holds ADMIN on them,
 * otherwise soft-deleted into the trash — `deletedAt`/`deletedById`, same
 * as `case-trash-service.ts`'s `softDeleteCase`, so the existing
 * `purge-trash` cron removes them permanently after the usual retention
 * window. This is a full disappearance for every collaborator, verified
 * against `listUserCases`/`listSharedCases` and `fetchCaseFromPrisma`/
 * `canAccessCase`, which all filter `deletedAt: null` unconditionally for
 * every viewer, not just the owner — a trashed case is invisible to
 * collaborators exactly like it is to the deleted user, so soft-delete
 * satisfies "disappears from the accounts of any collaborators" without
 * needing a hard delete.
 *
 * Comments and elements are anonymised (transferred to the system account)
 * exactly as before, on kept AND trashed cases alike — trashing a case
 * does not touch its children, only `deletedAt` on the case row, so their
 * `createdById`/`authorId` FKs still need a home until the purge cron
 * removes the whole case tree.
 *
 * `CasePermission.grantedById` is reassigned too (QA round 1, D1): it is a
 * real `ON DELETE RESTRICT` FK with no cascade, so any user who ever
 * shared ANY case — including one they don't own — could not previously
 * delete their own account (P2003, silently flattened to "Failed to
 * delete account" one level up). Covers permissions granted on the user's
 * own cases and on other people's.
 *
 * Callers are responsible for their own pre-flight checks
 * (`checkDeletable`, password) before calling this.
 */
async function runAccountDeletionTransaction(userId: string): Promise<void> {
	await prisma.$transaction(
		async (tx) => {
			const systemUserId = await getOrCreateSystemUser(tx);

			const ownedCases = await tx.assuranceCase.findMany({
				where: { createdById: userId },
				select: { id: true },
			});
			const { toKeep, toTrash } = await partitionCasesToKeepOrTrash(
				tx,
				userId,
				ownedCases.map((c) => c.id)
			);

			if (toKeep.length > 0) {
				await tx.assuranceCase.updateMany({
					where: { id: { in: toKeep } },
					data: { createdById: systemUserId },
				});
			}

			if (toTrash.length > 0) {
				await tx.assuranceCase.updateMany({
					where: { id: { in: toTrash } },
					data: {
						createdById: systemUserId,
						deletedAt: new Date(),
						deletedById: systemUserId,
					},
				});
			}

			// Handle teams created by user
			const ownedTeams = await tx.team.findMany({
				where: { createdById: userId },
				include: {
					members: {
						where: { userId: { not: userId } },
						orderBy: { joinedAt: "asc" },
						take: 1,
					},
				},
			});

			// Split into transfers (each to a different new owner, so one
			// updateMany can't set them all) and member-less teams (all get the
			// same treatment, so one deleteMany replaces N round trips).
			const teamTransfers: { newOwnerId: string; teamId: string }[] = [];
			const teamIdsToDelete: string[] = [];
			for (const team of ownedTeams) {
				const newOwnerId = team.members[0]?.userId;
				if (newOwnerId) {
					teamTransfers.push({ teamId: team.id, newOwnerId });
				} else {
					teamIdsToDelete.push(team.id);
				}
			}

			for (const { teamId, newOwnerId } of teamTransfers) {
				await tx.team.update({
					where: { id: teamId },
					data: { createdById: newOwnerId },
				});
			}

			if (teamIdsToDelete.length > 0) {
				await tx.team.deleteMany({ where: { id: { in: teamIdsToDelete } } });
			}

			// Anonymise comments (transfer to system user)
			await tx.comment.updateMany({
				where: { authorId: userId },
				data: { authorId: systemUserId },
			});

			// Also handle release comments if they exist
			await tx.releaseComment.updateMany({
				where: { authorId: userId },
				data: { authorId: systemUserId },
			});

			// Transfer created elements to system user (for audit trail)
			await tx.assuranceElement.updateMany({
				where: { createdById: userId },
				data: { createdById: systemUserId },
			});

			// Reassign permissions this user granted — on their own cases and on
			// others' — to the system user. Real ON DELETE RESTRICT FK, no cascade.
			await tx.casePermission.updateMany({
				where: { grantedById: userId },
				data: { grantedById: systemUserId },
			});

			// Delete the user (cascades: RefreshToken, TeamMember, CasePermission
			// held BY this user, GitHubRepository)
			await tx.user.delete({ where: { id: userId } });
		},
		{
			timeout: DELETION_TRANSACTION_TIMEOUT_MS,
			maxWait: DELETION_TRANSACTION_MAX_WAIT_MS,
		}
	);
}

/**
 * Deletes an account on the platform's own initiative (data retention),
 * not the user's — the password-free counterpart to `deleteAccount` used
 * by the retention sweep (`lib/services/retention-service.ts`). Shares
 * `deleteAccount`'s cascade and confirmation email, and additionally logs
 * a security event so the deletion has an audit trail distinct from a
 * self-service one.
 */
export async function deleteAccountForRetention(userId: string): ServiceResult {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true, username: true },
		});

		if (!user) {
			return { error: "User not found" };
		}

		const deletable = await checkDeletable(userId);
		if (!deletable.deletable) {
			return { error: deletable.error };
		}

		await runAccountDeletionTransaction(userId);

		const { sendAccountDeletedEmail } = await import(
			"@/lib/services/email-service"
		);
		await sendAccountDeletedEmail({ to: user.email, username: user.username });

		const { logSecurityEvent } = await import("@/lib/audit/security-log");
		logSecurityEvent({
			event: "account_deleted",
			severity: "medium",
			metadata: { userId, reason: "retention" },
		});

		return { data: true };
	} catch (error) {
		console.error("Error deleting account for retention:", error);
		return { error: "Failed to delete account" };
	}
}
