"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";

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

async function fetchPlugins(): Promise<PluginSettingsListItem[]> {
	const response = await fetch("/api/user/plugins");
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	const body = (await response.json()) as PluginsResponseBody;
	return body.plugins;
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
