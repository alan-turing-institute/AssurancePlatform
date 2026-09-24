import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";

/**
 * Result of session validation.
 */
export interface ValidatedSession {
	email: string | null;
	userId: string;
	username: string | null;
}

/**
 * Validates the current user session.
 *
 * Calls next-auth's `getServerSession`, which runs `callbacks.jwt`
 * (lib/auth/config.ts) — that callback does a database lookup on every call,
 * to check the token's stamped session version against the user's current
 * one (lib/auth/session-version.ts), so a token from before a password
 * change or reset is rejected here rather than trusted.
 *
 * @returns {Promise<ValidatedSession | null>} The validated session with userId, or null if invalid
 */
export async function validateSession(): Promise<ValidatedSession | null> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return null;
	}

	return {
		userId: session.user.id,
		username: session.user.name ?? null,
		email: session.user.email ?? null,
	};
}
