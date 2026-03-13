import {
	hashPassword,
	type PasswordAlgorithm,
	verifyPassword,
} from "@/lib/auth/password-service";
import { prisma } from "@/lib/prisma";
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
 * Gets or creates the system user for ownership transfer.
 */
async function getOrCreateSystemUser(
	tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
	let systemUser = await tx.user.findFirst({
		where: { isSystemUser: true },
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
 * Deletes a user account.
 * Transfers owned cases and anonymises comments before deletion.
 * Requires password confirmation for local auth users.
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

		// Perform deletion in transaction
		await prisma.$transaction(async (tx) => {
			const systemUserId = await getOrCreateSystemUser(tx);

			// Transfer owned cases to system user
			await tx.assuranceCase.updateMany({
				where: { createdById: userId },
				data: { createdById: systemUserId },
			});

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

			for (const team of ownedTeams) {
				if (team.members.length > 0) {
					// Transfer ownership to first remaining member
					await tx.team.update({
						where: { id: team.id },
						data: { createdById: team.members[0]?.userId },
					});
				} else {
					// No other members - delete the team
					await tx.team.delete({ where: { id: team.id } });
				}
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

			// Delete the user (cascades: RefreshToken, TeamMember, CasePermission)
			await tx.user.delete({ where: { id: userId } });
		});

		return { data: true };
	} catch (error) {
		console.error("Error deleting account:", error);
		return { error: "Failed to delete account" };
	}
}
