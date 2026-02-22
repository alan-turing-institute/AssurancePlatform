"use server";

import { validateSession } from "@/lib/auth/validate-session";

/**
 * Ensures the current user has a demo assurance case.
 * Idempotent — safe to call on every dashboard visit.
 */
export async function ensureUserHasDemoCase(_token: string): Promise<void> {
	const validated = await validateSession();
	if (!validated) {
		return;
	}

	const { ensureDemoCaseExists } = await import(
		"@/lib/services/demo-case-service"
	);

	await ensureDemoCaseExists(validated.userId);
}
