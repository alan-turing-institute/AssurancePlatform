import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isAuthRoute, isPublicRoute } from "./lib/routes";

export default withAuth(
	function middleware(req) {
		const pathname = req.nextUrl.pathname;
		const token = req.nextauth.token;

		// Redirect authenticated users away from auth pages (login/register)
		if (token?.id != null && isAuthRoute(pathname)) {
			const rawRedirect =
				req.nextUrl.searchParams.get("redirect") || "/dashboard";
			// Prevent open redirect: only allow relative paths that don't start with //
			const redirectTo =
				rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
					? rawRedirect
					: "/dashboard";
			return NextResponse.redirect(new URL(redirectTo, req.url));
		}

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
		pages: {
			signIn: "/login",
		},
	}
);

// Specify which routes this middleware should run on
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api/auth (auth endpoints)
		 * - api/cron (cron endpoints, own CRON_SECRET bearer auth)
		 * - api/machine (machine/integration endpoints, own requireApiToken
		 *   bearer auth — ADR 0002 v2 §2.4. Without this exemption every
		 *   bearer-token request here 307-redirects to /login instead of
		 *   reaching the route handler.)
		 * - api/health (health checks)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 *
		 * Each of the four `api/*` prefixes above is boundary-anchored
		 * (`(?:/|$)`) rather than a bare string prefix — otherwise a
		 * hypothetical future route like `/api/machinery` or
		 * `/api/healthcheck` would be silently exempted from session auth
		 * too. Verified against the full route inventory (fix round,
		 * 2026-07-03): no existing route under any of the four prefixes
		 * relies on the looser match, so all four were anchored together.
		 */
		"/((?!api/auth(?:/|$)|api/cron(?:/|$)|api/machine(?:/|$)|api/health(?:/|$)|api/users/register|_next/static|_next/image|favicon.ico|images|data|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.json$|.*\\.html$).*)",
	],
};
