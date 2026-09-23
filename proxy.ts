import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { isAuthRoute, isPublicRoute } from "./lib/routes";

export default withAuth(
	function proxy(req) {
		const pathname = req.nextUrl.pathname;
		const token = req.nextauth.token;

		// Unauthenticated API request: the `authorized` callback below passes
		// every non-exempt `/api/*` path through unconditionally, so this
		// branch — not next-auth's own sign-in redirect — decides what an
		// unauthenticated API caller gets back. Mirrors the JSON error shape
		// `apiError(unauthorised())` (`lib/api-response.ts`) produces, built
		// inline rather than importing `unauthorised()` from `lib/errors.ts`:
		// the proxy runs on every matched request (Next 16's `proxy` runtime
		// is always `nodejs`, so this is no longer an Edge Runtime bundling
		// restriction), and pulling in `lib/errors.ts` would drag
		// `lib/logger.ts` -> `lib/db-pool-config.ts` into that hot path.
		// `proxy.unauthenticated-api.test.ts` asserts this literal stays equal
		// to what `apiError(unauthorised())` produces, so the two can't drift
		// silently.
		if (token?.id == null && pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Unauthorised", code: "UNAUTHORISED" },
				{ status: 401 }
			);
		}

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

				// API routes: always pass through, session or not. Letting
				// next-auth's default handling decide here would 307-redirect an
				// unauthenticated API caller to /login instead of giving it a JSON
				// 401 — so the actual auth check for `/api/*` happens in the
				// wrapped middleware function above, which returns that JSON
				// response itself instead of a redirect.
				if (pathname.startsWith("/api/")) {
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
		 * - api/public (published-content read endpoints — no auth by
		 *   design, e.g. GET /api/public/discover/[slug]. Every route under
		 *   this prefix is
		 *   audited to serve only already-published content via read-only
		 *   GET handlers with no session-derived data — see the route
		 *   audit in the fix-public-api-auth issue. Without this exemption
		 *   anonymous requests 307-redirect to /login instead of reaching
		 *   the route handler, contradicting the routes' own "no auth
		 *   required" doc comments.)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 * - uploads (locally-stored user uploads — served via the
		 *   `/uploads/[...path]` route handler at runtime, or straight off
		 *   `public/` for anything present at build time; these are the same
		 *   URLs Azure Blob Storage returns in production, which are public
		 *   by URL, so this exemption keeps both storage backends behaving
		 *   the same way. Without it, uploads whose extension isn't in the
		 *   `.*\.ext$` list below — `.gif`, `.webp` — were 307-redirected to
		 *   `/login` even for files that existed at build time (the file
		 *   extension list happened to cover `.png`/`.jpg`/`.jpeg` but not
		 *   every `ALLOWED_MIME_TYPES` extension); a bare `uploads` prefix
		 *   here covers all of them without relying on an extension list.
		 *   This exemption is extension-independent by construction: anything
		 *   a future writer places under `public/uploads` becomes publicly
		 *   readable, regardless of what it is.)
		 *
		 * Each of the five `api/*` prefixes above is boundary-anchored
		 * (`(?:/|$)`) rather than a bare string prefix — otherwise a
		 * hypothetical future route like `/api/machinery` or
		 * `/api/healthcheck` (or `/api/publicfoo`) would be silently
		 * exempted from session auth too. Verified against the full route
		 * inventory (fix round, 2026-07-03; extended 2026-07-14): no
		 * existing route under any of the five prefixes relies on the
		 * looser match, so all five are anchored the same way.
		 *
		 * Every `/api/*` path this matcher does NOT exempt above still runs
		 * through this middleware, but an unauthenticated request to one of
		 * them no longer gets the page-style 307 redirect to /login: the
		 * `authorized` callback below passes all `/api/*` paths through
		 * unconditionally, and the wrapped middleware function returns a
		 * JSON 401 (in the platform's standard error shape) for any of them
		 * with no valid session, before any page-redirect logic runs. Page
		 * paths are unaffected — they still redirect to /login as before.
		 */
		"/((?!api/auth(?:/|$)|api/cron(?:/|$)|api/machine(?:/|$)|api/health(?:/|$)|api/public(?:/|$)|api/users/register|_next/static|_next/image|favicon.ico|images|data|uploads(?:/|$)|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.json$|.*\\.html$).*)",
	],
};
