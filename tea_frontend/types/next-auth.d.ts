import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    key?: string;
    provider?: string;
  }

  interface User {
    key?: string;
    provider?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    key?: string;
    provider?: string;
  }
}
