import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isJwtOnlyAuth } from "./feature-flags";
import { validateRefreshToken } from "./refresh-token-service";

/**
 * Result of session validation.
 */
export type ValidatedSession = {
	userId: string;
};

/**
 * Validates the current user session.
 *
 * In JWT-only mode (USE_JWT_ONLY_AUTH=true):
 *   - Trusts the NextAuth session directly
 *   - No database lookup required
 *
 * In legacy mode (USE_JWT_ONLY_AUTH=false):
 *   - Validates the refresh token against the database
 *   - Returns null if token is invalid, expired, or revoked
 *
 * @returns {Promise<ValidatedSession | null>} The validated session with userId, or null if invalid
 */
export async function validateSession(): Promise<ValidatedSession | null> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return null;
	}

	if (isJwtOnlyAuth()) {
		// JWT-only mode: trust the session directly
		return { userId: session.user.id };
	}

	// Legacy mode: validate refresh token against database
	if (!session.key) {
		return null;
	}

	const tokenValidation = await validateRefreshToken(session.key);
	if (!tokenValidation.valid) {
		return null;
	}

	return { userId: tokenValidation.userId };
}
