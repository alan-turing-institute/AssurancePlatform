---
sidebar_position: 3
sidebar_label: 'Setting up Next Auth.js'
---

# Setting Up NextAuth.js with GitHub Provider

NextAuth.js is a flexible authentication solution for Next.js applications. This guide walks you through the steps to configure NextAuth.js with GitHub as an authentication provider.

## Prerequisites

- A Next.js application
- A GitHub account
- Node.js and npm installed

## Step 1: Install NextAuth.js

Install NextAuth.js in your Next.js project:

```bash
npm install next-auth
```

## Step 2: Create GitHub OAuth App
- Go to the GitHub Developer settings.
- Click on OAuth Apps and then New OAuth App.
- Fill in the required details:
  - **Application name:** Your app name
  - **Homepage URL:** http://localhost:3000 (or your production URL)
  - **Authorization callback URL:** http://localhost:3000/api/auth/callback/github
- After creating the app, note the Client ID and Client Secret.

## Step 3: Configure NextAuth.js
Create a new file for your NextAuth.js configuration at `app/api/auth/[...nextauth].js` called `route.ts`

```js
import { authOptions } from '@/lib/authOptions';
import NextAuth from 'next-auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

```
Create a new file called `authOptions.ts` as below:

```js
import NextAuth from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

export default NextAuth({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  // Optional: Add a database adapter, session, and callbacks as needed
});
```

## Step 4: Environment Variables
Create a `.env.local` file in the root of your project and add your GitHub credentials:

```makefile
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Step 5: Set Up Authentication Links
In your application, add links to sign in and sign out:

```jsx
import { signIn, signOut, useSession } from 'next-auth/react';

export default function AuthButton() {
  const { data: session } = useSession();

  return session ? (
    <>
      <p>Welcome, {session.user.name}</p>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  ) : (
    <button onClick={() => signIn('github')}>Sign in with GitHub</button>
  );
}
```

## Step 6: Test Your Setup
- Start your Next.js application:

```bash
npm run dev
```

- Navigate to your app in the browser and click the "Sign in with GitHub" button.
- Authenticate with GitHub and authorize the app.
- You should be redirected back to your application, logged in with your GitHub account.

## Conclusion
You have successfully set up NextAuth.js with GitHub as an authentication provider! You can further customize the authentication flow and add more providers as needed.
