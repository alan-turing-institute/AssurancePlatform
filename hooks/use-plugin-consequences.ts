"use client";

import { useCallback, useEffect, useState } from "react";

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

interface ApiErrorBody {
	error?: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
	return body?.error ?? "Something went wrong";
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
 * consequences`, once on mount, the same "fetch on mount" shape
 * `useEnabledPluginIds` (`use-plugin-enablement.ts`) uses.
 *
 * This hook deliberately has no "is the caller currently active" flag —
 * `PluginOffConfirmDialog` only mounts the component that calls this hook
 * while the dialog is open (see that file), so opening the dialog IS the
 * reset: a fresh mount starts loading from scratch, the same "remount for
 * fresh state" convention `IntegrationRegisterDialog`'s dialog-instance key
 * already uses elsewhere in this settings area. That keeps this hook a
 * plain fetch-on-mount, rather than a hook that watches a prop and adjusts
 * its own state in response to it.
 *
 * A failed read surfaces as `error`, with `consequences` staying `null` —
 * the dialog must still let the user confirm on that state (D3: "a failed
 * read must not block the switch"), so this hook never throws past its own
 * boundary.
 */
export function usePluginConsequences(
	pluginId: string
): UsePluginConsequencesResult {
	const [consequences, setConsequences] =
		useState<PluginOffConsequenceNumbers | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const data = await requestPluginConsequences(pluginId);
			setConsequences(data);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to load plugin consequences"
			);
		} finally {
			setLoading(false);
		}
	}, [pluginId]);

	useEffect(() => {
		load();
	}, [load]);

	return { consequences, error, loading };
}
