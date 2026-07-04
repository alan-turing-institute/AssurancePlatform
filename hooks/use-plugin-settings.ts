"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPlugins } from "@/hooks/use-plugin-enablement";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { toast } from "@/lib/toast";

// Re-exported so existing consumers (e.g. `PluginToggleRow`) keep importing
// the settings pane's item shape from this hook — `lib/schemas/plugin.ts` is
// the single definition (was hand-duplicated with `UserPluginListItem` in
// `app/api/user/plugins/route.ts`; consolidated 2026-07-04). A second,
// separate `export ... from` (not re-exporting the local import above) so
// biome's `noExportedImports` doesn't fire. The fetch itself is delegated to
// `use-plugin-enablement.ts` — the shared fetch mechanism both this pane and
// the build-time UI slots read through (`[[TEA — UI extension slots]]`); this
// hook keeps its own public API unchanged.
export type {
	PluginPinnedAt,
	PluginSettingsListItem,
} from "@/lib/schemas/plugin";

interface ApiErrorBody {
	error?: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
	return body?.error ?? "Something went wrong";
}

async function requestPluginToggle(
	pluginId: string,
	enabled: boolean
): Promise<void> {
	const response = await fetch("/api/user/plugins", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pluginId, enabled }),
	});
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
}

export interface UsePluginSettingsResult {
	error: string | null;
	loading: boolean;
	plugins: PluginSettingsListItem[];
	togglePlugin: (pluginId: string, enabled: boolean) => Promise<void>;
	/** The pluginId currently mid-toggle, or `null` if none is in flight. */
	togglingId: string | null;
}

/**
 * Fetches and toggles the session user's effective plugin state via
 * `/api/user/plugins` — the settings pane's only data source (house rule:
 * "data via the new route only"). Owns all UI state (loading / error /
 * which row is mid-toggle) so the pane components stay presentational.
 *
 * A toggle re-fetches the full list on success rather than patching local
 * state from the PATCH response — the effective state can, in principle,
 * depend on scopes this hook has no local copy of (organisation/team rows),
 * so re-resolving through the same GET the pane renders from is the only
 * way to stay honest about "which level pinned it".
 */
export function usePluginSettings(): UsePluginSettingsResult {
	const [plugins, setPlugins] = useState<PluginSettingsListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [togglingId, setTogglingId] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const data = await fetchPlugins();
			setPlugins(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load plugins");
		}
	}, []);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	const togglePlugin = useCallback(
		async (pluginId: string, enabled: boolean) => {
			setTogglingId(pluginId);
			try {
				await requestPluginToggle(pluginId, enabled);
				await load();
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't update plugin",
					description:
						err instanceof Error ? err.message : "Something went wrong",
				});
			} finally {
				setTogglingId(null);
			}
		},
		[load]
	);

	return { plugins, loading, error, togglingId, togglePlugin };
}
