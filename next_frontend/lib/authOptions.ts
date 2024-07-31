import { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  // Secret for Next-auth, without this JWT encryption/decryption won't work
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  
  // Configure one or more authentication providers
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_APP_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // // Check For Existing User
      // const res = await fetch(`${process.env.API_URL}/auth/check-user`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ email: user.email }),
      // });

      //// Check if you need to login or register
      // if (res.ok) {
      //   const data = await res.json();

      //   if (data.exists) {
      //     // User exists, log them in
      //     const loginRes = await fetch(`${process.env.API_URL}/auth/login`, {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json',
      //       },
      //       body: JSON.stringify({ email: user.email, githubId: profile.id }),
      //     });

      //     if (loginRes.ok) {
      //       const loginData = await loginRes.json();
      //       user.accessToken = loginData.token;
      //       return true;
      //     } else {
      //       return false;
      //     }
      //   } else {
      //     // User does not exist, register them
      //     const registerRes = await fetch(`${process.env.API_URL}/auth/register`, {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json',
      //       },
      //       body: JSON.stringify({ email: user.email, githubId: profile.id }),
      //     });

      //     if (registerRes.ok) {
      //       const registerData = await registerRes.json();
      //       user.accessToken = registerData.token;
      //       return true;
      //     } else {
      //       return false;
      //     }
      //   }
      // } else {
      //   return false;
      // }
      return true
    },
    async redirect({ url, baseUrl }) {
      return 'http://localhost:3000/dashboard'
    },
    async session({ session, user, token }) {
        // Include access_token in the session
        session.accessToken = token.accessToken;
        return session;
    },
    async jwt({ token, user, account, profile, isNewUser }) {
        // Initial sign-in
        if (account && user) {
            token.accessToken = account.access_token;
        }
        // if (user) {
        //   token.accessToken = user.accessToken;
        // }
        return token;
    },
  }
}