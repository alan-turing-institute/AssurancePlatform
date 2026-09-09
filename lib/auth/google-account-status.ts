/**
 * Pure predicate: true when a user record has a linked Google identity but
 * no Drive refresh token — access was revoked, or Drive access was never
 * granted with offline access. Distinguishes "needs to reconnect Drive"
 * from "never connected Google at all".
 *
 * Kept in its own module (no Prisma, no `googleapis`) rather than in
 * `lib/services/google-drive-service.ts`, so importing it doesn't drag in
 * that service's module-level Prisma client — `connected-accounts-service.ts`
 * needs the predicate but deliberately keeps Prisma access dynamic
 * (`await import("@/lib/prisma")`), so it can be imported from client-side
 * test files with no `DATABASE_URL` set. The single definition shared by
 * `google-drive-service.ts`'s `needsGoogleReauthorisation` (the DB-reading
 * wrapper) and `connected-accounts-service.ts`'s `getConnectedAccounts`,
 * which already has both fields from its own query.
 */
export function googleNeedsReauthorisation(user: {
	googleId: string | null;
	googleRefreshToken: string | null;
}): boolean {
	return !!user.googleId && !user.googleRefreshToken;
}
