import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // If user has a token but no key (stale session), clear it and redirect to login
    if (token && !token.key && pathname !== '/login') {
      const response = NextResponse.redirect(new URL('/login', req.url));
      // Clear the session cookies
      response.cookies.set('next-auth.session-token', '', { maxAge: 0 });
      response.cookies.set('__Secure-next-auth.session-token', '', {
        maxAge: 0,
      });
      return response;
    }

    // Allow the request to continue
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes that don't require authentication
        const publicRoutes = [
          '/',
          '/login',
          '/register',
          '/discover',
          '/documentation',
        ];
        const isPublicRoute = publicRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`)
        );

        // Allow public routes
        if (isPublicRoute) {
          return true;
        }

        // For protected routes (like /dashboard), require a valid session with key
        return token?.key != null;
      },
    },
  }
);

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|images|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)',
  ],
};
