import { prisma } from "@/lib/prisma";
import type { ConnectedAccountsData } from "@/types/domain";

// ============================================
// VALIDATION REGEX PATTERNS (top-level for performance)
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPPERCASE_REGEX = /[A-Z]/;
const DIGIT_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[\W_]/;
const WHITESPACE_REGEX = /\s/;

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
// VALIDATION HELPERS
// ============================================

/**
 * Validates email format.
 */
function isValidEmail(email: string): boolean {
	return EMAIL_REGEX.test(email);
}

/**
 * Validates password strength.
 * Requires: min 8 chars, 1 uppercase, 1 number, 1 special char.
 */
function isValidPassword(password: string): { valid: boolean; error?: string } {
	if (password.length < 8) {
		return { valid: false, error: "Password must be at least 8 characters" };
	}
	if (!UPPERCASE_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one uppercase letter",
		};
	}
	if (!DIGIT_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one number",
		};
	}
	if (!SPECIAL_CHAR_REGEX.test(password)) {
		return {
			valid: false,
			error: "Password must contain at least one special character",
		};
	}
	return { valid: true };
}

/**
 * Validates username format.
 */
function isValidUsername(username: string): { valid: boolean; error?: string } {
	if (username.length < 2) {
		return { valid: false, error: "Username must be at least 2 characters" };
	}
	if (username.length > 250) {
		return { valid: false, error: "Username must be less than 250 characters" };
	}
	if (WHITESPACE_REGEX.test(username)) {
		return { valid: false, error: "Username cannot contain spaces" };
	}
	return { valid: true };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Registers a new user with Prisma.
 */
export async function registerUser(
	input: RegisterUserInput
): Promise<{ data?: UserResponse; error?: string; field?: string }> {
	// Validate username
	const usernameValidation = isValidUsername(input.username);
	if (!usernameValidation.valid) {
		return { error: usernameValidation.error, field: "username" };
	}

	// Validate email
	if (!isValidEmail(input.email)) {
		return { error: "Please enter a valid email address", field: "email" };
	}

	// Validate password
	const passwordValidation = isValidPassword(input.password);
	if (!passwordValidation.valid) {
		return { error: passwordValidation.error, field: "password" };
	}

	const email = input.email.toLowerCase().trim();
	const username = input.username.trim();

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
 * Gets the current user by ID.
 */
export async function getUserById(
	userId: string
): Promise<{ data?: UserResponse; error?: string }> {
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
): Promise<{ data: CurrentUserData } | { error: string }> {
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
