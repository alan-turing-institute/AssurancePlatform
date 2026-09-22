"use client";

import { useCallback } from "react";
import { parseErrorMessage, useFetchOnMount } from "@/hooks/use-fetch-on-mount";

/**
 * The off-switch consequence read's shape — mirrors
 * `PluginDisableConsequences` (`lib/services/plugin-consequences-service.ts`)
 * as a plain interface rather than importing it, so this client hook never
 * pulls in a service file (services own Prisma; see repo `CLAUDE.md`'s
 * layering rule). `plugin-off-copy.ts` imports this type from here.
 */
export interface PluginOffConsequenceNumbers {
	activeIntegrations: ReadonlyArray<{ id: string; name: string }>;
	caseCount: number;
	evidenceRecordCount: number;
}

async function requestPluginConsequences(
	pluginId: string
): Promise<PluginOffConsequenceNumbers> {
	const response = await fetch(`/api/user/plugins/${pluginId}/consequences`);
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	return (await response.json()) as PluginOffConsequenceNumbers;
}

export interface UsePluginConsequencesResult {
	consequences: PluginOffConsequenceNumbers | null;
	error: string | null;
	loading: boolean;
}

/**
 * Fetches the off-switch confirmation dialog's live numbers (TEA — Plugin
 * management surface D3) from `GET /api/user/plugins/{pluginId}/
 * consequences`, once on mount — via the shared `useFetchOnMount`
 * (`hooks/use-fetch-on-mount.ts`), the same fetch-on-mount shape
 * `useEnabledPluginIds`/`usePluginSettings` use.
 *
 * `PluginOffConfirmDialog` only mounts the component that calls this hook
 * while the dialog is open (see that file), so opening the dialog IS the
 * reset: a fresh mount starts loading from scratch, the same "remount for
 * fresh state" convention `IntegrationRegisterDialog`'s dialog-instance key
 * already uses elsewhere in this settings area.
 *
 * A failed read surfaces as `error`, with `consequences` staying `null` —
 * the dialog must still let the user confirm on that state (D3: "a failed
 * read must not block the switch"), which `useFetchOnMount` already gives
 * for free: it never throws past its own boundary.
 */
export function usePluginConsequences(
	pluginId: string
): UsePluginConsequencesResult {
	const fetcher = useCallback(
		() => requestPluginConsequences(pluginId),
		[pluginId]
	);
	const { data, error, loading } = useFetchOnMount(fetcher);

	return { consequences: data, error, loading };
}
