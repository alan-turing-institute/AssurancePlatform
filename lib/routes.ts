/**
 * Route configuration for the TEA Platform.
 * Centralised definitions for public and protected routes.
 */

/**
 * Public routes that do not require authentication.
 * These routes are accessible to all users, including unauthenticated visitors.
 */
export const PUBLIC_ROUTES = [
	"/",
	"/login",
	"/register",
	"/discover",
	"/docs",
	"/auth-error",
	"/cookie-policy",
	"/feedback",
	"/forgot-password",
	"/reset-password",
] as const;

/**
 * Type for public route paths
 */
export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/**
 * Auth routes where authenticated users should be redirected away.
 * These are login/register pages that only make sense for unauthenticated users.
 */
export const AUTH_ROUTES = ["/login", "/register"] as const;

/**
 * Checks if a pathname is an auth route (login/register).
 * Used by middleware to redirect authenticated users to the dashboard.
 */
export function isAuthRoute(pathname: string): boolean {
	return AUTH_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`)
	);
}

/**
 * Checks if a pathname is a public route.
 * Matches exact routes and routes that start with a public route prefix.
 *
 * @param pathname - The URL pathname to check
 * @returns true if the route is public
 *
 * @example
 * isPublicRoute("/") // true
 * isPublicRoute("/discover") // true
 * isPublicRoute("/discover/123") // true
 * isPublicRoute("/dashboard") // false
 */
export function isPublicRoute(pathname: string): boolean {
	return PUBLIC_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`)
	);
}
