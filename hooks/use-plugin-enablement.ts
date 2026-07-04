"use client";

import { useCallback, useEffect, useState } from "react";

/** The scope currently pinning a plugin's state, or `null` if nothing is. */
export type PluginPinnedAt =
	| "DEPLOYMENT"
	| "ORGANISATION"
	| "TEAM"
	| "USER"
	| null;

export interface PluginSettingsListItem {
	available: boolean;
	enabled: boolean;
	name: string;
	pinnedAt: PluginPinnedAt;
	pluginId: string;
	settings: unknown;
	version: string;
}

interface PluginsResponseBody {
	plugins: PluginSettingsListItem[];
}

interface ApiErrorBody {
	error?: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
	return body?.error ?? "Something went wrong";
}

/**
 * The one fetch mechanism for effective plugin state (ADR 0002 v2 §2.2/§2.3):
 * both the settings pane (`usePluginSettings`, the full list plus toggling)
 * and build-time UI slots (`useEnabledPluginIds` below, on/off only) read
 * through this single call to `/api/user/plugins` — one endpoint, one
 * response shape, no parallel mechanism invented for slots.
 */
export async function fetchPlugins(): Promise<PluginSettingsListItem[]> {
	const response = await fetch("/api/user/plugins");
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	const body = (await response.json()) as PluginsResponseBody;
	return body.plugins;
}

export interface UseEnabledPluginIdsResult {
	/** Plugin ids that are effectively ON for the session user right now. */
	enabledPluginIds: ReadonlySet<string>;
	/** True until the first fetch resolves (or fails). Slots should render nothing meanwhile, never a placeholder. */
	loading: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * The narrow read UI extension slots need: which plugin ids are effectively
 * enabled for the session user (ADR 0002 v2 §2.3). Slot components filter
 * their registry entries (`lib/plugins/slots`) against this set — a
 * registration whose `pluginId` is absent here renders as if it were never
 * registered at all.
 *
 * A failed fetch degrades to "nothing enabled" rather than risking plugin UI
 * the server hasn't actually confirmed is on; the settings pane
 * (`usePluginSettings`) is where the real error surfaces to the user.
 */
export function useEnabledPluginIds(): UseEnabledPluginIdsResult {
	const [enabledPluginIds, setEnabledPluginIds] =
		useState<ReadonlySet<string>>(EMPTY_SET);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			const plugins = await fetchPlugins();
			setEnabledPluginIds(
				new Set(plugins.filter((p) => p.enabled).map((p) => p.pluginId))
			);
		} catch {
			setEnabledPluginIds(EMPTY_SET);
		}
	}, []);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	return { enabledPluginIds, loading };
}
