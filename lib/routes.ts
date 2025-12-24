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
