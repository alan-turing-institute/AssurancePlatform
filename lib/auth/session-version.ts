/**
 * Thrown by `callbacks.jwt` (lib/auth/config.ts) when a token's stamped
 * session version no longer matches the user's current one — a signal, not
 * a normal error. NextAuth's session route catches any throw from
 * `callbacks.jwt`, logs it as `JWT_SESSION_ERROR`, returns an empty
 * session, and clears the cookie where it can
 * (node_modules/next-auth/core/routes/session.js:52-90). Returning `null`
 * from the callback is not equivalent — it only "works" here by accident,
 * via a later TypeError in `callbacks.session`.
 */
export class SessionRevokedError extends Error {
	constructor(message = "Session revoked") {
		super(message);
		this.name = "SessionRevokedError";
	}
}

/**
 * Reads `userId`'s current session version — a primary-key lookup of one
 * integer column. Returns `null` if the user no longer exists.
 *
 * Dynamic import, not a top-level one: `lib/auth/config.ts` (this module's
 * only caller) deliberately keeps Prisma out of its module-level imports —
 * see its own dynamic imports in `authenticateWithPrisma` and friends — so
 * that importing `authOptions` doesn't drag in a database connection for
 * code paths that never authenticate. A static `import { prisma } from
 * "@/lib/prisma"` here would undo that: `lib/prisma.ts` builds its client at
 * module load time, which throws immediately wherever `DATABASE_URL` isn't
 * set (e.g. every unit test that merely imports `lib/api-response.ts`,
 * which imports `validate-session.ts`, which imports `config.ts`).
 */
export async function getSessionVersion(
	userId: string
): Promise<number | null> {
	const { prisma } = await import("@/lib/prisma");
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { sessionVersion: true },
	});
	return user?.sessionVersion ?? null;
}

/**
 * Rejects a token whose stamped session version doesn't match the user's
 * current one — the check `callbacks.jwt` runs on every server-side session
 * read (when `user` is absent, i.e. not the initial sign-in). Throws
 * `SessionRevokedError` when `userId` isn't a string, `tokenSessionVersion`
 * isn't a number (covers tokens issued before this shipped — Chris's
 * ruling: no "missing claim = version 1" fallback), the user no longer
 * exists, or the two versions differ.
 */
export async function assertSessionVersionCurrent(
	userId: string | undefined,
	tokenSessionVersion: unknown
): Promise<void> {
	if (typeof userId !== "string" || typeof tokenSessionVersion !== "number") {
		throw new SessionRevokedError();
	}

	const currentVersion = await getSessionVersion(userId);
	if (currentVersion === null || currentVersion !== tokenSessionVersion) {
		throw new SessionRevokedError();
	}
}
