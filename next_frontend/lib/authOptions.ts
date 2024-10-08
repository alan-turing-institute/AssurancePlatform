import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

import dotenv from 'dotenv';
dotenv.config(); // Explicitly load environment variables

export const authOptions: NextAuthOptions = {
  // Secret for Next-auth, without this JWT encryption/decryption won't work
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  // Configure one or more authentication providers
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_APP_CLIENT_ID_STAGING as string,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET || process.env.GITHUB_APP_CLIENT_SECRET_STAGING as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // Send GitHub Token to Endpoint
      // api/register-by-access-token/social/github/

      const payload = {
        access_token: account?.access_token,
        email: profile?.email
      }

      const response = await fetch(`${process.env.API_URL}/api/auth/github/register-by-token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if(response.ok) {
        const result = await response.json()

        // pass the token to user so it can be added to the session
        user.accessToken = result.key;
        user.provider = account?.provider

        return true
      }

      return true
    },
    async redirect({ url, baseUrl }) {
      return `${process.env.NEXTAUTH_URL}/dashboard`;
    },
    async session({ session, user, token }) {
        // Include access_token in the session
        session.accessToken = token.accessToken;
        session.provider = token.provider
        return session;
    },
    async jwt({ token, user, account, profile, isNewUser }) {
        // Initial sign-in
        if (account && user) {
            token.accessToken = user.accessToken;
            token.provider = user.provider
        }
        return token;
    },
  }
}
