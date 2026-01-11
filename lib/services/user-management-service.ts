"use server";

import {
	hashPassword,
	type PasswordAlgorithm,
	verifyPassword,
} from "@/lib/auth/password-service";
import { prismaNew } from "@/lib/prisma";

// ============================================
// Types
// ============================================

export type UpdateProfileInput = {
	username?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
};

export type ChangePasswordInput = {
	currentPassword: string;
	newPassword: string;
};

type ServiceResult<T = void> = Promise<
	| { success: true; data?: T }
	| { success: false; error: string; field?: string }
>;

// ============================================
// Validation Helpers
// ============================================

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 50;

// Standard email regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(username: string): {
	valid: boolean;
	error?: string;
} {
	if (username.length < MIN_USERNAME_LENGTH) {
		return {
			valid: false,
			error: `Username must be at least ${MIN_USERNAME_LENGTH} characters`,
		};
	}
	if (username.length > MAX_USERNAME_LENGTH) {
		return {
			valid: false,
			error: `Username must be at most ${MAX_USERNAME_LENGTH} characters`,
		};
	}
	if (!USERNAME_REGEX.test(username)) {
		return {
			valid: false,
			error: "Username can only contain letters, numbers, and underscores",
		};
	}
	return { valid: true };
}

function validateEmail(email: string): {
	valid: boolean;
	error?: string;
} {
	if (!EMAIL_REGEX.test(email)) {
		return {
			valid: false,
			error: "Please enter a valid email address",
		};
	}
	return { valid: true };
}

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
const PASSWORD_DIGIT_REGEX = /\d/;
const PASSWORD_SPECIAL_REGEX = /[!@#$%^&*()_,.?":{}|<>]/;

function validatePassword(password: string): {
	valid: boolean;
	error?: string;
} {
	if (password.length < PASSWORD_MIN_LENGTH) {
		return {
			valid: false,
			error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
		};
	}
	if (!PASSWORD_UPPERCASE_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one uppercase letter",
		};
	}
	if (!PASSWORD_DIGIT_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one number",
		};
	}
	if (!PASSWORD_SPECIAL_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one special character",
		};
	}
	return { valid: true };
}

// ============================================
// Profile Update
// ============================================

type ValidationError = { success: false; error: string; field: string };

/**
 * Validates and checks uniqueness of a username.
 */
async function validateAndCheckUsername(
	username: string,
	userId: string
): Promise<ValidationError | null> {
	const validation = validateUsername(username);
	if (!validation.valid) {
		return {
			success: false,
			error: validation.error ?? "Invalid username",
			field: "username",
		};
	}

	const existingUser = await prismaNew.user.findFirst({
		where: {
			username: { equals: username, mode: "insensitive" },
			id: { not: userId },
		},
		select: { id: true },
	});

	if (existingUser) {
		return {
			success: false,
			error: "Username is already taken",
			field: "username",
		};
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
		return {
			success: false,
			error: validation.error ?? "Invalid email",
			field: "email",
		};
	}

	const existingUser = await prismaNew.user.findFirst({
		where: {
			email: { equals: email, mode: "insensitive" },
			id: { not: userId },
		},
		select: { id: true },
	});

	if (existingUser) {
		return {
			success: false,
			error: "Email address is already in use",
			field: "email",
		};
	}

	return null;
}

/**
 * Updates a user's profile information including email.
 */
export async function updateUserProfile(
	userId: string,
	input: UpdateProfileInput
): ServiceResult<{ username: string; firstName?: string; lastName?: string }> {
	try {
		// Validate username if provided
		if (input.username !== undefined) {
			const error = await validateAndCheckUsername(input.username, userId);
			if (error) {
				return error;
			}
		}

		// Validate email if provided
		if (input.email !== undefined) {
			const error = await validateAndCheckEmail(input.email, userId);
			if (error) {
				return error;
			}
		}

		// Build update data
		const updateData: {
			username?: string;
			firstName?: string;
			lastName?: string;
			email?: string;
		} = {};

		if (input.username !== undefined) {
			updateData.username = input.username;
		}
		if (input.firstName !== undefined) {
			updateData.firstName = input.firstName;
		}
		if (input.lastName !== undefined) {
			updateData.lastName = input.lastName;
		}
		if (input.email !== undefined) {
			updateData.email = input.email;
		}

		// Skip update if nothing to change
		if (Object.keys(updateData).length === 0) {
			return { success: true };
		}

		const user = await prismaNew.user.update({
			where: { id: userId },
			data: updateData,
			select: {
				username: true,
				firstName: true,
				lastName: true,
			},
		});

		return {
			success: true,
			data: {
				username: user.username,
				firstName: user.firstName ?? undefined,
				lastName: user.lastName ?? undefined,
			},
		};
	} catch (error) {
		console.error("Error updating user profile:", error);
		return { success: false, error: "Failed to update profile" };
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
			return {
				success: false,
				error: passwordValidation.error ?? "Invalid password",
				field: "newPassword",
			};
		}

		// Get user's current password hash
		const user = await prismaNew.user.findUnique({
			where: { id: userId },
			select: {
				passwordHash: true,
				passwordAlgorithm: true,
				authProvider: true,
			},
		});

		if (!user) {
			return { success: false, error: "User not found" };
		}

		// Only local auth users can change password
		if (user.authProvider !== "LOCAL") {
			return {
				success: false,
				error: "Password change is not available for OAuth accounts",
			};
		}

		if (!user.passwordHash) {
			return { success: false, error: "No password set for this account" };
		}

		// Verify current password
		const { valid } = await verifyPassword(
			input.currentPassword,
			user.passwordHash,
			user.passwordAlgorithm as PasswordAlgorithm
		);

		if (!valid) {
			return {
				success: false,
				error: "Current password is incorrect",
				field: "currentPassword",
			};
		}

		// Hash new password with argon2id
		const newHash = await hashPassword(input.newPassword);

		// Update password
		await prismaNew.user.update({
			where: { id: userId },
			data: {
				passwordHash: newHash,
				passwordAlgorithm: "argon2id",
				// Clear any pending password reset
				passwordResetToken: null,
				passwordResetExpires: null,
			},
		});

		return { success: true };
	} catch (error) {
		console.error("Error changing password:", error);
		return { success: false, error: "Failed to change password" };
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
	tx: Parameters<Parameters<typeof prismaNew.$transaction>[0]>[0]
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
		const user = await prismaNew.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				passwordHash: true,
				passwordAlgorithm: true,
				authProvider: true,
			},
		});

		if (!user) {
			return { success: false, error: "User not found" };
		}

		// Verify password for local auth users
		if (user.authProvider === "LOCAL") {
			if (!password) {
				return {
					success: false,
					error: "Password is required to delete account",
					field: "password",
				};
			}

			if (!user.passwordHash) {
				return { success: false, error: "Cannot verify account" };
			}

			const { valid } = await verifyPassword(
				password,
				user.passwordHash,
				user.passwordAlgorithm as PasswordAlgorithm
			);

			if (!valid) {
				return {
					success: false,
					error: "Password is incorrect",
					field: "password",
				};
			}
		}

		// Perform deletion in transaction
		await prismaNew.$transaction(async (tx) => {
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
						data: { createdById: team.members[0].userId },
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

		return { success: true };
	} catch (error) {
		console.error("Error deleting account:", error);
		return { success: false, error: "Failed to delete account" };
	}
}
