import dotenv from "dotenv";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";

dotenv.config(); // Explicitly load environment variables

/**
 * Authenticates a user using Prisma.
 * Verifies password against stored hash and upgrades to argon2id if needed.
 */
async function authenticateWithPrisma(
	username: string,
	password: string
): Promise<{
	id: string;
	name: string;
	email: string;
} | null> {
	// Dynamic imports to avoid loading Prisma when not using this auth method
	const { prismaNew } = await import("@/lib/prisma");
	const { verifyPassword, hashPassword } = await import(
		"@/lib/auth/password-service"
	);
	type PasswordAlgorithm = "django_pbkdf2" | "argon2id";

	const user = await prismaNew.user.findFirst({
		where: {
			OR: [{ username }, { email: username }],
		},
		select: {
			id: true,
			username: true,
			email: true,
			passwordHash: true,
			passwordAlgorithm: true,
		},
	});

	if (!user?.passwordHash) {
		return null;
	}

	const { valid, needsUpgrade } = await verifyPassword(
		password,
		user.passwordHash,
		user.passwordAlgorithm as PasswordAlgorithm
	);

	if (!valid) {
		return null;
	}

	// Upgrade password hash to argon2id if using legacy algorithm
	if (needsUpgrade) {
		const newHash = await hashPassword(password);
		await prismaNew.user.update({
			where: { id: user.id },
			data: {
				passwordHash: newHash,
				passwordAlgorithm: "argon2id",
			},
		});
	}

	return {
		id: user.id,
		name: user.username,
		email: user.email,
	};
}

/**
 * Authenticates a GitHub user using Prisma.
 * Creates or updates user record and returns session credentials.
 */
async function authenticateGitHubWithPrisma(profile: {
	id?: string | number;
	login?: string;
	email?: string | null;
}): Promise<{ id: string } | null> {
	const { prismaNew } = await import("@/lib/prisma");

	const githubId = String(profile?.id ?? "");
	const githubUsername = profile?.login ?? "";
	const email = profile?.email;

	if (!email) {
		console.error("GitHub OAuth: No email provided");
		return null;
	}

	// Find existing user by GitHub ID or email
	const existingUser = await prismaNew.user.findFirst({
		where: {
			OR: [{ githubId }, { email }],
		},
	});

	let userId: string;
	if (existingUser) {
		userId = existingUser.id;
		await prismaNew.user.update({
			where: { id: userId },
			data: {
				githubId,
				githubUsername,
				authProvider: "GITHUB",
			},
		});
	} else {
		const newUser = await prismaNew.user.create({
			data: {
				email,
				username: githubUsername || email,
				githubId,
				githubUsername,
				authProvider: "GITHUB",
			},
		});
		userId = newUser.id;
	}

	return { id: userId };
}

/**
 * Configuration options for NextAuth authentication.
 *
 * This object sets up authentication for a Next.js app using GitHub as an authentication provider.
 * It defines providers, session strategy, and callbacks for handling sign-in, redirect, session, and JWT behaviors.
 *
 * @type {NextAuthOptions}
 *
 * @property {string} secret - Secret for encrypting/decrypting JWT tokens. Fetched from environment variables.
 * @property {Object} session - Configuration for session management, using JWT as the strategy.
 * @property {Array} providers - List of authentication providers. Here, GitHub is configured.
 * @property {Object} callbacks - Defines callback functions for various authentication events such as signIn, redirect, session, and JWT management.
 *
 * @example
 * // To use with NextAuth, you can import and pass this object to NextAuth in your API route.
 * import NextAuth from 'next-auth';
 * import { authOptions } from './path-to-this-file';
 *
 * export default NextAuth(authOptions);
 */
export const authOptions: NextAuthOptions = {
	// Secret for Next-auth, without this JWT encryption/decryption won't work
	secret: process.env.NEXTAUTH_SECRET,
	session: { strategy: "jwt" },

	// Configure one or more authentication providers
	providers: [
		GithubProvider({
			clientId:
				process.env.GITHUB_APP_CLIENT_ID ||
				(process.env.GITHUB_APP_CLIENT_ID_STAGING as string),
			clientSecret:
				process.env.GITHUB_APP_CLIENT_SECRET ||
				(process.env.GITHUB_APP_CLIENT_SECRET_STAGING as string),
		}),
		CredentialsProvider({
			name: "Credentials",
			credentials: {
				username: { label: "Username", type: "text" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials, _req) {
				const { username, password } = credentials ?? {};

				if (!(username && password)) {
					return null;
				}

				try {
					return await authenticateWithPrisma(username, password);
				} catch (_error) {
					return null;
				}
			},
		}),
	],

	callbacks: {
		/**
		 * Callback triggered during sign-in.
		 *
		 * @param {Object} params - Parameters provided during sign-in.
		 * @param {Object} params.user - User object returned by the provider.
		 * @param {Object} params.account - Account information including access token.
		 * @param {Object} params.profile - Profile information returned by the provider.
		 * @param {string} params.email - Email associated with the sign-in attempt.
		 * @returns {boolean} `true` to allow the sign-in.
		 */
		async signIn({ user, account, profile }) {
			if (account?.provider === "github") {
				const gitHubProfile = profile as { id?: number; login?: string };
				const githubProfile = {
					id: gitHubProfile?.id,
					login: gitHubProfile?.login,
					email: profile?.email,
				};

				const result = await authenticateGitHubWithPrisma(githubProfile);
				if (result) {
					user.id = result.id;
					user.provider = "github";
					return true;
				}
				return false;
			}

			// For credentials, allow default processing
			return !!user?.id;
		},

		/**
		 * Callback triggered when redirecting after login or sign-out.
		 *
		 * @param {Object} params - Parameters for the redirect.
		 * @param {string} params.url - Target URL for the redirect.
		 * @param {string} params.baseUrl - Base URL of the application.
		 * @returns {string} Redirect URL after authentication.
		 */
		// biome-ignore lint/suspicious/useAwait: Required for NextAuth compatibility - expects async function
		async redirect({ url, baseUrl }) {
			// Use NEXTAUTH_URL if available, otherwise fall back to baseUrl
			const authUrl = process.env.NEXTAUTH_URL || baseUrl;
			if (!authUrl) {
				throw new Error(
					"NEXTAUTH_URL must be configured for authentication redirects"
				);
			}

			// Allow relative URLs on the same site (e.g., /login for signout)
			if (url.startsWith("/")) {
				return `${authUrl}${url}`;
			}

			// Allow absolute URLs on the same origin
			if (url.startsWith(authUrl)) {
				return url;
			}

			// Default: redirect to dashboard (for sign-in)
			return `${authUrl}/dashboard`;
		},

		/**
		 * Callback to handle the session object passed to the client.
		 *
		 * @param {Object} params - Parameters related to the session.
		 * @param {Object} params.session - The current session object.
		 * @param {Object} params.token - The JWT token associated with the session.
		 * @returns {Object} The modified session object with provider information.
		 */
		session({ session, token }) {
			session.provider = token.provider;
			// Add user ID to session for Prisma auth
			if (token.id && session.user) {
				session.user.id = token.id as string;
			}
			return session;
		},

		/**
		 * Callback to handle JWT token creation and updates.
		 *
		 * @param {Object} params - Parameters related to the JWT.
		 * @param {Object} params.token - The current token.
		 * @param {Object} params.user - The user object returned after sign-in (initial sign-in only).
		 * @returns {Object} The updated token with user ID and provider information.
		 */
		jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.provider = user.provider || "credentials";
			}
			return token;
		},
	},
};
