"use server";

import { revalidatePath } from "next/cache";
import { validateSession } from "@/lib/auth/validate-session";
import type { ActionResult } from "@/lib/errors";
import { ProviderSchema } from "@/lib/schemas/connected-accounts";
import type { ConnectedAccountsData } from "@/lib/services/connected-accounts-service";
import {
	getConnectedAccounts,
	unlinkProvider as unlinkProviderFromService,
} from "@/lib/services/connected-accounts-service";

/**
 * Fetches the current user's connected accounts information.
 * Returns data about which providers are connected and their status.
 */
export async function fetchConnectedAccounts(): Promise<ConnectedAccountsData | null> {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const result = await getConnectedAccounts(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
}

/**
 * Unlinks an OAuth provider from the current user's account.
 * Will fail if this is the user's only authentication method.
 *
 * @param providerInput - The provider to unlink ('github' or 'google')
 */
export async function unlinkProvider(
	providerInput: string
): Promise<ActionResult<void>> {
	const parseResult = ProviderSchema.safeParse(providerInput);
	if (!parseResult.success) {
		return { success: false, error: "Invalid provider." };
	}

	const validated = await validateSession();
	if (!validated) {
		return {
			success: false,
			error: "You must be signed in to unlink a provider.",
		};
	}

	const result = await unlinkProviderFromService(
		validated.userId,
		parseResult.data
	);
	if ("error" in result) {
		return { success: false, error: result.error };
	}

	revalidatePath("/dashboard/settings");
	return { success: true, data: undefined };
}
