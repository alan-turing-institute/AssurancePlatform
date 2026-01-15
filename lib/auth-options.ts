import dotenv from "dotenv";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

dotenv.config(); // Explicitly load environment variables

/**
 * Cookie name used for account linking flow.
 * When set, the OAuth callback will link to the existing user instead of creating a new one.
 * Exported for use in the link API route.
 */
export const LINK_COOKIE_NAME = "tea_link_user_id";

/**
 * Builds the token data object for Google OAuth updates.
 * Extracted to reduce cognitive complexity in the main function.
 */
function buildGoogleTokenData(
	accessToken?: string,
	refreshToken?: string,
	tokenExpiresAt?: Date | null
) {
	return {
		...(accessToken && { googleAccessToken: accessToken }),
		...(refreshToken && { googleRefreshToken: refreshToken }),
		...(tokenExpiresAt && { googleTokenExpiresAt: tokenExpiresAt }),
	};
}

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
 * Creates or updates user record, stores OAuth access token, and returns session credentials.
 *
 * @param profile - GitHub OAuth profile
 * @param accessToken - OAuth access token for API calls
 * @param expiresAt - Token expiry timestamp
 * @param linkToUserId - If provided, links GitHub to this existing user instead of creating/finding by email
 */
async function authenticateGitHubWithPrisma(
	profile: {
		id?: string | number;
		login?: string;
		email?: string | null;
	},
	accessToken?: string,
	expiresAt?: number,
	linkToUserId?: string
): Promise<{ id: string } | null> {
	const { prismaNew } = await import("@/lib/prisma");

	const githubId = String(profile?.id ?? "");
	const githubUsername = profile?.login ?? "";
	const email = profile?.email;

	if (!email) {
		console.error("GitHub OAuth: No email provided");
		return null;
	}

	// Calculate token expiry (GitHub tokens typically don't expire, but we store it if provided)
	const tokenExpiresAt = expiresAt ? new Date(expiresAt * 1000) : null;

	// Check if this GitHub account is already linked to another user
	const githubLinkedUser = await prismaNew.user.findUnique({
		where: { githubId },
		select: { id: true },
	});

	// If linking to existing user, verify the GitHub account isn't already linked elsewhere
	if (linkToUserId) {
		if (githubLinkedUser && githubLinkedUser.id !== linkToUserId) {
			// GitHub account already linked to different user - fail silently for security
			return null;
		}

		// Link GitHub to the specified user
		await prismaNew.user.update({
			where: { id: linkToUserId },
			data: {
				githubId,
				githubUsername,
				// Don't change authProvider when linking - user keeps their original provider
				...(accessToken && { githubAccessToken: accessToken }),
				...(tokenExpiresAt && { githubTokenExpiresAt: tokenExpiresAt }),
			},
		});

		return { id: linkToUserId };
	}

	// Standard flow: Find existing user by GitHub ID or email
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
				// Store access token for GitHub API calls (e.g., importing cases from repos)
				...(accessToken && { githubAccessToken: accessToken }),
				...(tokenExpiresAt && { githubTokenExpiresAt: tokenExpiresAt }),
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
				githubAccessToken: accessToken,
				githubTokenExpiresAt: tokenExpiresAt,
			},
		});
		userId = newUser.id;
	}

	return { id: userId };
}

/**
 * Links Google credentials to an existing user account.
 * Returns null if the Google account is already linked to a different user.
 */
async function linkGoogleToUser(
	linkToUserId: string,
	googleId: string,
	email: string,
	tokenData: ReturnType<typeof buildGoogleTokenData>
): Promise<{ id: string } | null> {
	const { prismaNew } = await import("@/lib/prisma");

	// Check if this Google account is already linked to another user
	const googleLinkedUser = await prismaNew.user.findUnique({
		where: { googleId },
		select: { id: true },
	});

	if (googleLinkedUser && googleLinkedUser.id !== linkToUserId) {
		// Google account already linked to different user - fail silently for security
		return null;
	}

	await prismaNew.user.update({
		where: { id: linkToUserId },
		data: {
			googleId,
			googleEmail: email,
			...tokenData,
		},
	});

	return { id: linkToUserId };
}

/**
 * Authenticates a Google user using Prisma.
 * Creates or updates user record, stores OAuth access and refresh tokens, and returns session credentials.
 *
 * @param profile - Google OAuth profile
 * @param accessToken - OAuth access token for API calls
 * @param refreshToken - OAuth refresh token for token renewal
 * @param expiresAt - Token expiry timestamp
 * @param linkToUserId - If provided, links Google to this existing user instead of creating/finding by email
 */
async function authenticateGoogleWithPrisma(
	profile: {
		sub?: string;
		email?: string | null;
		name?: string;
	},
	accessToken?: string,
	refreshToken?: string,
	expiresAt?: number,
	linkToUserId?: string
): Promise<{ id: string } | null> {
	const { prismaNew } = await import("@/lib/prisma");

	const googleId = profile?.sub ?? "";
	const email = profile?.email;

	if (!email) {
		console.error("Google OAuth: No email provided");
		return null;
	}

	const tokenExpiresAt = expiresAt ? new Date(expiresAt * 1000) : null;
	const tokenData = buildGoogleTokenData(
		accessToken,
		refreshToken,
		tokenExpiresAt
	);

	// Handle explicit account linking flow
	if (linkToUserId) {
		return linkGoogleToUser(linkToUserId, googleId, email, tokenData);
	}

	// Standard flow: Find existing user by Google ID or email
	const existingUser = await prismaNew.user.findFirst({
		where: { OR: [{ googleId }, { email }] },
	});

	if (existingUser) {
		await prismaNew.user.update({
			where: { id: existingUser.id },
			data: { googleId, googleEmail: email, ...tokenData },
		});
		return { id: existingUser.id };
	}

	// Create new user for Google login
	const username = email.split("@")[0] || email;
	const newUser = await prismaNew.user.create({
		data: {
			email,
			username,
			googleId,
			googleEmail: email,
			authProvider: "GOOGLE",
			googleAccessToken: accessToken,
			googleRefreshToken: refreshToken,
			googleTokenExpiresAt: tokenExpiresAt,
		},
	});

	return { id: newUser.id };
}

/**
 * Configuration options for NextAuth authentication.
 *
 * This object sets up authentication for a Next.js app using GitHub and Google as authentication providers.
 * It defines providers, session strategy, and callbacks for handling sign-in, redirect, session, and JWT behaviors.
 *
 * @type {NextAuthOptions}
 *
 * @property {string} secret - Secret for encrypting/decrypting JWT tokens. Fetched from environment variables.
 * @property {Object} session - Configuration for session management, using JWT as the strategy.
 * @property {Array} providers - List of authentication providers. GitHub, Google, and Credentials are configured.
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
			// Request repo scope to access private repositories for import feature
			authorization: {
				params: {
					scope: "read:user user:email repo",
				},
			},
		}),
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
			authorization: {
				params: {
					// Request Drive API scope for backup/import functionality
					scope:
						"openid email profile https://www.googleapis.com/auth/drive.file",
					access_type: "offline", // Required to get refresh token
					prompt: "consent", // Force consent to ensure refresh token is returned
				},
			},
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
		 * Supports account linking via LINK_COOKIE_NAME cookie.
		 *
		 * @param {Object} params - Parameters provided during sign-in.
		 * @param {Object} params.user - User object returned by the provider.
		 * @param {Object} params.account - Account information including access token.
		 * @param {Object} params.profile - Profile information returned by the provider.
		 * @param {string} params.email - Email associated with the sign-in attempt.
		 * @returns {boolean} `true` to allow the sign-in.
		 */
		async signIn({ user, account, profile }) {
			// Check for account linking cookie (set by /api/auth/link/[provider])
			let linkToUserId: string | undefined;
			try {
				const { cookies } = await import("next/headers");
				const cookieStore = await cookies();
				const linkCookie = cookieStore.get(LINK_COOKIE_NAME);
				if (linkCookie?.value) {
					linkToUserId = linkCookie.value;
					// Clear the cookie after reading
					cookieStore.delete(LINK_COOKIE_NAME);
				}
			} catch {
				// Cookie access may fail in some contexts, continue without linking
			}

			if (account?.provider === "github") {
				const gitHubProfile = profile as { id?: number; login?: string };
				const githubProfile = {
					id: gitHubProfile?.id,
					login: gitHubProfile?.login,
					email: profile?.email,
				};

				// Pass access token and optional linkToUserId for account linking
				const result = await authenticateGitHubWithPrisma(
					githubProfile,
					account.access_token,
					account.expires_at,
					linkToUserId
				);
				if (result) {
					user.id = result.id;
					user.provider = "github";
					return true;
				}
				return false;
			}

			if (account?.provider === "google") {
				const googleProfile = profile as {
					sub?: string;
					email?: string;
					name?: string;
				};

				// Pass tokens and optional linkToUserId for account linking
				const result = await authenticateGoogleWithPrisma(
					googleProfile,
					account.access_token,
					account.refresh_token,
					account.expires_at,
					linkToUserId
				);
				if (result) {
					user.id = result.id;
					user.provider = "google";
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
