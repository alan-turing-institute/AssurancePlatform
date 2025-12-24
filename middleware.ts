import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isJwtOnlyAuth } from "./lib/auth/feature-flags";
import { isPublicRoute } from "./lib/routes";

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

		// Legacy mode only: check for stale sessions (token exists but no key)
		// In JWT-only mode, we trust the JWT directly without a refresh token
		if (!isJwtOnlyAuth() && token && !token.key && pathname !== "/login") {
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

				// Allow public routes (defined in lib/routes.ts)
				if (isPublicRoute(pathname)) {
					return true;
				}

				// JWT-only mode: trust the JWT directly (just check token.id exists)
				if (isJwtOnlyAuth()) {
					return token?.id != null;
				}

				// Legacy mode: require a valid session with refresh token key
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
		"/((?!api/auth|api/health|api/users/register|_next/static|_next/image|favicon.ico|images|data|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.json$).*)",
	],
};
