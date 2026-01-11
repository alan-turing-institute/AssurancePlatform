import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isPublicRoute } from "./lib/routes";

export default withAuth(
	function middleware(req) {
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

				// JWT auth: require valid token with user ID
				return token?.id != null;
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
