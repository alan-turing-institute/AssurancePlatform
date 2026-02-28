/**
 * Connected Accounts Service
 *
 * Handles OAuth provider connection status and unlinking for user accounts.
 */

import type { ConnectedAccountsData } from "@/types/domain";

// ============================================
// Types
// ============================================

export type Provider = "github" | "google";

// ============================================
// Internal helpers
// ============================================

/**
 * Validates that a provider can be safely unlinked.
 * Returns an error message if unlinking is not allowed.
 */
function validateUnlinkRequest(
	provider: Provider,
	hasPassword: boolean,
	hasGitHub: boolean,
	hasGoogle: boolean
): string | null {
	if (provider === "github") {
		if (!hasGitHub) {
			return "GitHub is not connected to your account.";
		}
		if (!(hasPassword || hasGoogle)) {
			return "Cannot disconnect GitHub. It is your only way to sign in. Connect another provider first.";
		}
	}

	if (provider === "google") {
		if (!hasGoogle) {
			return "Google is not connected to your account.";
		}
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
	provider: Provider,
	currentAuthProvider: "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM",
	hasPassword: boolean
): "LOCAL" | "GITHUB" | "GOOGLE" | "SYSTEM" {
	if (provider === "github" && currentAuthProvider === "GITHUB") {
		return hasPassword ? "LOCAL" : "GOOGLE";
	}
	if (provider === "google" && currentAuthProvider === "GOOGLE") {
		return hasPassword ? "LOCAL" : "GITHUB";
	}
	return currentAuthProvider;
}

// ============================================
// Service functions
// ============================================

/**
 * Fetches connected account information for the given user.
 * Returns data about which providers are connected and their status.
 */
export async function getConnectedAccounts(
	userId: string
): Promise<{ data: ConnectedAccountsData } | { error: string }> {
	const { prisma } = await import("@/lib/prisma");

	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				authProvider: true,
				passwordHash: true,
				githubId: true,
				githubUsername: true,
				githubTokenExpiresAt: true,
				googleId: true,
				googleEmail: true,
				googleTokenExpiresAt: true,
				googleRefreshToken: true,
			},
		});

		if (!user) {
			return { error: "Permission denied" };
		}

		const hasPassword = !!user.passwordHash;
		const hasGitHub = !!user.githubId;
		const hasGoogle = !!user.googleId;

		const canUnlinkGitHub = hasPassword || hasGoogle;
		const canUnlinkGoogle = hasPassword || hasGitHub;

		return {
			data: {
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
			},
		};
	} catch (error) {
		console.error("[getConnectedAccounts]", { userId, error });
		return { error: "Failed to fetch connected accounts" };
	}
}

/**
 * Unlinks an OAuth provider from the given user's account.
 * Will fail if this is the user's only authentication method.
 */
export async function unlinkProvider(
	userId: string,
	provider: Provider
): Promise<{ data: null } | { error: string }> {
	const { prisma } = await import("@/lib/prisma");

	try {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				authProvider: true,
				passwordHash: true,
				githubId: true,
				googleId: true,
			},
		});

		if (!user) {
			return { error: "Permission denied" };
		}

		const hasPassword = !!user.passwordHash;
		const hasGitHub = !!user.githubId;
		const hasGoogle = !!user.googleId;

		const validationError = validateUnlinkRequest(
			provider,
			hasPassword,
			hasGitHub,
			hasGoogle
		);

		if (validationError) {
			return { error: validationError };
		}

		const newAuthProvider = getNewAuthProvider(
			provider,
			user.authProvider,
			hasPassword
		);

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

		await prisma.user.update({
			where: { id: userId },
			data: updateData,
		});

		return { data: null };
	} catch (error) {
		console.error("[unlinkProvider]", { userId, provider, error });
		return { error: "Failed to unlink provider" };
	}
}
