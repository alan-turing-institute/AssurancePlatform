import { prisma } from "@/lib/prisma";
import {
	validateEmail,
	validatePassword,
	validateUsername,
} from "@/lib/validation/validators";
import type { ConnectedAccountsData } from "@/types/domain";
import type { ServiceResult } from "@/types/service";

// ============================================
// INPUT INTERFACES
// ============================================

export type RegisterUserInput = {
	username: string;
	email: string;
	password: string;
};

// ============================================
// OUTPUT INTERFACES
// ============================================

export type UserResponse = {
	id: string;
	username: string;
	email: string;
	created_at: string;
};

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Registers a new user with Prisma.
 */
export async function registerUser(
	input: RegisterUserInput
): Promise<{ data: UserResponse } | { error: string; field?: string }> {
	// Validate username
	const usernameValidation = validateUsername(input.username);
	if (!usernameValidation.valid) {
		return { error: usernameValidation.error, field: "username" };
	}

	// Validate email
	const emailValidation = validateEmail(input.email);
	if (!emailValidation.valid) {
		return { error: emailValidation.error, field: "email" };
	}

	// Validate password
	const passwordValidation = validatePassword(input.password);
	if (!passwordValidation.valid) {
		return { error: passwordValidation.error, field: "password" };
	}

	const email = emailValidation.value;
	const username = usernameValidation.value;

	try {
		// Check if email already exists
		const existingEmail = await prisma.user.findUnique({
			where: { email },
			select: { id: true },
		});

		if (existingEmail) {
			return {
				error: "An account with this email already exists",
				field: "email",
			};
		}

		// Check if username already exists
		const existingUsername = await prisma.user.findUnique({
			where: { username },
			select: { id: true },
		});

		if (existingUsername) {
			return { error: "This username is already taken", field: "username" };
		}

		// Hash password
		const { hashPassword } = await import("@/lib/auth/password-service");
		const passwordHash = await hashPassword(input.password);

		// Create user
		const user = await prisma.user.create({
			data: {
				username,
				email,
				passwordHash,
				passwordAlgorithm: "argon2id",
			},
			select: {
				id: true,
				username: true,
				email: true,
				createdAt: true,
			},
		});

		return {
			data: {
				id: user.id,
				username: user.username,
				email: user.email,
				created_at: user.createdAt.toISOString(),
			},
		};
	} catch (error) {
		console.error("Failed to register user:", error);
		return { error: "Failed to create account. Please try again." };
	}
}

/**
 * Dismisses the migration notice for the given user.
 * Only succeeds if the user has a valid (non-placeholder) email address.
 */
export async function dismissMigrationNotice(
	userId: string
): ServiceResult<null> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (!user) {
			return { error: "Permission denied" };
		}

		const hasValidEmail = user.email && !user.email.includes("@placeholder");
		if (!hasValidEmail) {
			return { error: "Valid email required to dismiss migration notice" };
		}

		await prisma.user.update({
			where: { id: userId },
			data: { hasSeenMigrationNotice: true },
		});

		return { data: null };
	} catch (error) {
		console.error("[dismissMigrationNotice]", { userId, error });
		return { error: "Failed to dismiss migration notice" };
	}
}

/**
 * Gets the current user by ID.
 */
export async function getUserById(userId: string): ServiceResult<UserResponse> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				email: true,
				createdAt: true,
			},
		});

		if (!user) {
			return { error: "User not found" };
		}

		return {
			data: {
				id: user.id,
				username: user.username,
				email: user.email,
				created_at: user.createdAt.toISOString(),
			},
		};
	} catch (error) {
		console.error("Failed to get user:", error);
		return { error: "Failed to get user" };
	}
}

// ============================================
// User Profile (used by /api/users/me)
// ============================================

export type UserProfileData = {
	id: string;
	username: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	groups: Array<{ id: string; name: string }>;
};

/**
 * Fetches the user's profile including team memberships.
 * Used by the /api/users/me route.
 */
export async function getUserProfile(
	userId: string
): ServiceResult<UserProfileData> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				email: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				teamMemberships: {
					select: {
						team: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!user) {
			return { error: "Permission denied" };
		}

		return {
			data: {
				id: user.id,
				username: user.username,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				avatarUrl: user.avatarUrl,
				groups: user.teamMemberships.map((m) => ({
					id: m.team.id,
					name: m.team.name,
				})),
			},
		};
	} catch (error) {
		console.error("[getUserProfile]", { userId, error });
		return { error: "Failed to fetch user profile" };
	}
}

// ============================================
// Current User
// ============================================

export type CurrentUserData = {
	id: string;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	avatar?: string | null;
	groups: Array<{ id: string; name: string }>;
	hasSeenMigrationNotice: boolean;
	completedTours: string[];
	connectedAccounts?: ConnectedAccountsData;
};

/**
 * Fetches the current user's full profile including team memberships.
 */
export async function getCurrentUser(
	userId: string
): ServiceResult<CurrentUserData> {
	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				username: true,
				email: true,
				firstName: true,
				lastName: true,
				avatarUrl: true,
				hasSeenMigrationNotice: true,
				completedTours: true,
				teamMemberships: {
					select: {
						team: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!user) {
			return { error: "Permission denied" };
		}

		return {
			data: {
				id: user.id,
				username: user.username,
				email: user.email,
				firstName: user.firstName ?? undefined,
				lastName: user.lastName ?? undefined,
				avatar: user.avatarUrl,
				groups: user.teamMemberships.map((m) => ({
					id: m.team.id,
					name: m.team.name,
				})),
				hasSeenMigrationNotice: user.hasSeenMigrationNotice,
				completedTours: user.completedTours,
			},
		};
	} catch (error) {
		console.error("[getCurrentUser]", { userId, error });
		return { error: "Failed to fetch user" };
	}
}
