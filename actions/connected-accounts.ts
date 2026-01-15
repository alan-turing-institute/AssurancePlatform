"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/types/domain";

/**
 * Schema for validating provider input
 */
const ProviderSchema = z.enum(["github", "google"]);

/**
 * Data about a user's connected authentication providers
 */
export type ConnectedAccountsData = {
	/** Primary authentication provider used for sign-in */
	primaryAuthProvider: "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM";
	/** Whether the user has a password set (can use email/password login) */
	hasPassword: boolean;

	/** GitHub connection status */
	github: {
		connected: boolean;
		username?: string;
		tokenExpiry?: Date | null;
	};

	/** Google connection status */
	google: {
		connected: boolean;
		email?: string;
		tokenExpiry?: Date | null;
		/** Whether user has granted Drive access (has refresh token) */
		hasDriveAccess: boolean;
	};

	/** Safety flags - whether provider can be unlinked */
	canUnlinkGitHub: boolean;
	canUnlinkGoogle: boolean;
};

/**
 * Fetches the current user's connected accounts information.
 * Returns data about which providers are connected and their status.
 */
export async function fetchConnectedAccounts(): Promise<ConnectedAccountsData | null> {
	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const user = await prismaNew.user.findUnique({
		where: { id: validated.userId },
		select: {
			authProvider: true,
			passwordHash: true,
			// GitHub fields
			githubId: true,
			githubUsername: true,
			githubTokenExpiresAt: true,
			// Google fields
			googleId: true,
			googleEmail: true,
			googleTokenExpiresAt: true,
			googleRefreshToken: true,
		},
	});

	if (!user) {
		return null;
	}

	const hasPassword = !!user.passwordHash;
	const hasGitHub = !!user.githubId;
	const hasGoogle = !!user.googleId;

	// Safety logic: can only unlink if user has another way to sign in
	const canUnlinkGitHub = hasPassword || hasGoogle;
	const canUnlinkGoogle = hasPassword || hasGitHub;

	return {
		primaryAuthProvider: user.authProvider,
		hasPassword,
		github: {
			connected: hasGitHub,
			username: user.githubUsername ?? undefined,
			tokenExpiry: user.githubTokenExpiresAt,
		},
		google: {
			connected: hasGoogle,
			email: user.googleEmail ?? undefined,
			tokenExpiry: user.googleTokenExpiresAt,
			hasDriveAccess: !!user.googleRefreshToken,
		},
		canUnlinkGitHub,
		canUnlinkGoogle,
	};
}

/**
 * Validates that a provider can be safely unlinked.
 * Returns an error message if unlinking is not allowed.
 */
function validateUnlinkRequest(
	provider: "github" | "google",
	hasPassword: boolean,
	hasGitHub: boolean,
	hasGoogle: boolean
): string | null {
	if (provider === "github") {
		if (!hasGitHub) {
			return "GitHub is not connected to your account.";
		}
		// Can't unlink if it's the only auth method
		if (!(hasPassword || hasGoogle)) {
			return "Cannot disconnect GitHub. It is your only way to sign in. Connect another provider first.";
		}
	}

	if (provider === "google") {
		if (!hasGoogle) {
			return "Google is not connected to your account.";
		}
		// Can't unlink if it's the only auth method
		if (!(hasPassword || hasGitHub)) {
			return "Cannot disconnect Google. It is your only way to sign in. Connect another provider first.";
		}
	}

	return null;
}

/**
 * Determines the new auth provider after unlinking.
 */
function getNewAuthProvider(
	provider: "github" | "google",
	currentAuthProvider: "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM",
	hasPassword: boolean
): "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM" {
	// Only change if unlinking the primary provider
	if (provider === "github" && currentAuthProvider === "GITHUB") {
		return hasPassword ? "LOCAL" : "GOOGLE";
	}
	if (provider === "google" && currentAuthProvider === "GOOGLE") {
		return hasPassword ? "LOCAL" : "GITHUB";
	}
	return currentAuthProvider;
}

/**
 * Unlinks an OAuth provider from the current user's account.
 * Will fail if this is the user's only authentication method.
 *
 * @param providerInput - The provider to unlink ('github' or 'google')
 */
export async function unlinkProvider(
	providerInput: string
): Promise<ActionResult<void>> {
	// Validate provider input
	const parseResult = ProviderSchema.safeParse(providerInput);
	if (!parseResult.success) {
		return { success: false, error: "Invalid provider." };
	}
	const provider = parseResult.data;

	const { prismaNew } = await import("@/lib/prisma");

	const validated = await validateSession();
	if (!validated) {
		return {
			success: false,
			error: "You must be signed in to unlink a provider.",
		};
	}

	const user = await prismaNew.user.findUnique({
		where: { id: validated.userId },
		select: {
			authProvider: true,
			passwordHash: true,
			githubId: true,
			googleId: true,
		},
	});

	if (!user) {
		return { success: false, error: "User not found." };
	}

	const hasPassword = !!user.passwordHash;
	const hasGitHub = !!user.githubId;
	const hasGoogle = !!user.googleId;

	// Validate the unlink request
	const validationError = validateUnlinkRequest(
		provider,
		hasPassword,
		hasGitHub,
		hasGoogle
	);
	if (validationError) {
		return { success: false, error: validationError };
	}

	// Determine new auth provider
	const newAuthProvider = getNewAuthProvider(
		provider,
		user.authProvider,
		hasPassword
	);

	// Build update data based on provider
	const updateData =
		provider === "github"
			? {
					githubId: null,
					githubUsername: null,
					githubAccessToken: null,
					githubTokenExpiresAt: null,
					authProvider: newAuthProvider,
				}
			: {
					googleId: null,
					googleEmail: null,
					googleAccessToken: null,
					googleRefreshToken: null,
					googleTokenExpiresAt: null,
					authProvider: newAuthProvider,
				};

	await prismaNew.user.update({
		where: { id: validated.userId },
		data: updateData,
	});

	// Revalidate the settings page to reflect changes
	revalidatePath("/dashboard/settings");

	return { success: true, data: undefined };
}
