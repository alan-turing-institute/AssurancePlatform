import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import dotenv from 'dotenv';

dotenv.config(); // Explicitly load environment variables

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
  session: { strategy: 'jwt' },

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
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const { username, password } = credentials ?? {};

        try {
          // Send credentials to your API for verification
          const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
          if (!apiUrl) {
            throw new Error(
              'API_URL or NEXT_PUBLIC_API_URL must be configured'
            );
          }
          const response = await fetch(`${apiUrl}/api/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });

          if (!response.ok) throw new Error('Invalid credentials');

          const user = await response.json();

          if (user) {
            // Include key (access token) in the user object
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              key: user.key,
            };
          }
          return null;
        } catch (error) {
          console.error('Authorization error:', error);
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
    async signIn({ user, account, profile, email, credentials }) {
      if (account?.provider === 'github') {
        // Handle GitHub-specific behavior
        const payload = {
          access_token: account?.access_token,
          email: profile?.email,
        };

        const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
          console.error(
            'API_URL or NEXT_PUBLIC_API_URL must be configured for GitHub authentication'
          );
          return false;
        }
        const response = await fetch(
          `${apiUrl}/api/auth/github/register-by-token/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );

        // if (response.ok) {
        //   const result = await response.json();
        //   user.accessToken = result.key;
        //   user.provider = account?.provider;
        //   return true;
        // }

        if (response.ok) {
          const result = await response.json();
          user.key = result.key; // Include the key for GitHub users
          user.provider = account.provider;
          return true;
        } else {
          console.error(
            `GitHub authentication failed: ${response.status} ${response.statusText}`
          );
          try {
            const errorData = await response.json();
            console.error('GitHub auth error details:', errorData);
          } catch (e) {
            console.error('Unable to parse error response');
          }
        }

        return false;
      }

      // For credentials, allow default processing
      return !!user;
    },

    /**
     * Callback triggered when redirecting after login or sign-out.
     *
     * @param {Object} params - Parameters for the redirect.
     * @param {string} params.url - Target URL for the redirect.
     * @param {string} params.baseUrl - Base URL of the application.
     * @returns {string} Redirect URL after authentication.
     */
    async redirect({ url, baseUrl }) {
      // Use NEXTAUTH_URL if available, otherwise fall back to baseUrl
      const authUrl = process.env.NEXTAUTH_URL || baseUrl;
      if (!authUrl) {
        throw new Error(
          'NEXTAUTH_URL must be configured for authentication redirects'
        );
      }
      return `${authUrl}/dashboard`;
    },

    /**
     * Callback to handle the session object passed to the client.
     *
     * @param {Object} params - Parameters related to the session.
     * @param {Object} params.session - The current session object.
     * @param {Object} params.user - User information attached to the session.
     * @param {Object} params.token - The JWT token associated with the session.
     * @returns {Object} The modified session object with an access token and provider information.
     */
    async session({ session, user, token }) {
      // session.accessToken = token.accessToken;
      // session.provider = token.provider;
      session.key = token.key; // Add the key to the session object
      session.provider = token.provider;
      return session;
    },

    /**
     * Callback to handle JWT token creation and updates.
     *
     * @param {Object} params - Parameters related to the JWT.
     * @param {Object} params.token - The current token.
     * @param {Object} params.user - The user object returned after sign-in (initial sign-in only).
     * @param {Object} params.account - The account object from the provider (initial sign-in only).
     * @param {Object} params.profile - Profile information from the provider (optional).
     * @param {boolean} params.isNewUser - Flag indicating if this is a new user (optional).
     * @returns {Object} The updated token with access token and provider information.
     */
    async jwt({ token, user, account, profile, isNewUser }) {
      // if (account && user) {
      //   token.accessToken = user.accessToken;
      //   token.provider = user.provider;
      // }
      if (user) {
        token.key = user.key; // Store the key from the user object
        token.provider = user.provider || 'credentials';
      }
      return token;
    },
  },
};
