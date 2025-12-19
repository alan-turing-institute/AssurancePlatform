/**
 * Feature flags for auth system migration.
 *
 * USE_JWT_ONLY_AUTH controls whether to use standard NextAuth JWT sessions
 * (true) or the legacy RefreshToken-based validation (false).
 *
 * Set to "false" during migration to maintain backward compatibility.
 * Set to "true" in staging first for testing, then production.
 */

/**
 * Returns true if JWT-only authentication is enabled.
 * When true, session validation skips database RefreshToken lookups.
 *
 * Note: We read from process.env directly rather than caching the value
 * to ensure it works correctly in both Node.js and Edge runtimes.
 */
export function isJwtOnlyAuth(): boolean {
	return process.env.USE_JWT_ONLY_AUTH === "true";
}
