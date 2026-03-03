"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { CurrentUserData } from "@/lib/services/user-service";
import { getCurrentUser } from "@/lib/services/user-service";

export const fetchCurrentUser = async (): Promise<
	CurrentUserData | null | undefined
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const result = await getCurrentUser(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};
