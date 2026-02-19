"use server";

/**
 * Validates a password reset token (public endpoint — no auth required).
 */
export async function validatePasswordResetToken(token: string): Promise<{
	valid: boolean;
	email?: string;
	error?: string;
}> {
	const { validateResetToken } = await import(
		"@/lib/services/password-reset-service"
	);

	const result = await validateResetToken(token);

	if (result.success) {
		return { valid: true, email: result.email };
	}

	return { valid: false, error: result.error };
}
