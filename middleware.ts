import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
	function middleware(req) {
		const token = req.nextauth.token;
		const pathname = req.nextUrl.pathname;

		// Check redirect loop protection
		const redirectCount = Number.parseInt(
			req.cookies.get("auth-redirects")?.value || "0",
			10
		);

		// If we've redirected too many times, show error page
		if (redirectCount > 3 && pathname !== "/auth-error") {
			const errorResponse = NextResponse.redirect(
				new URL("/auth-error", req.url)
			);
			// Reset the counter
			errorResponse.cookies.set("auth-redirects", "0", { maxAge: 60 });
			return errorResponse;
		}

		// If user has a token but no key (stale session), clear it and redirect to login
		if (token && !token.key && pathname !== "/login") {
			const response = NextResponse.redirect(new URL("/login", req.url));
			// Clear the session cookies
			response.cookies.set("next-auth.session-token", "", { maxAge: 0 });
			response.cookies.set("__Secure-next-auth.session-token", "", {
				maxAge: 0,
			});
			// Increment redirect counter
			response.cookies.set("auth-redirects", String(redirectCount + 1), {
				maxAge: 60,
			});
			return response;
		}

		// Reset redirect counter on successful navigation
		if (pathname !== "/login") {
			const response = NextResponse.next();
			response.cookies.set("auth-redirects", "0", { maxAge: 60 });
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
					"/",
					"/login",
					"/register",
					"/discover",
					"/documentation",
					"/auth-error",
					"/cookie-policy",
					"/feedback",
					"/forgot-password",
					"/reset-password",
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
		"/((?!api/auth|api/users/register|_next/static|_next/image|favicon.ico|images|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)",
	],
};
