import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * Result of session validation.
 */
export type ValidatedSession = {
	userId: string;
	username: string | null;
	email: string | null;
};

/**
 * Validates the current user session.
 *
 * Trusts the NextAuth JWT session directly - no database lookup required.
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
