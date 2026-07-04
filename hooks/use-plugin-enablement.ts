"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";

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

async function requestPlugins(): Promise<PluginSettingsListItem[]> {
	const response = await fetch("/api/user/plugins");
	if (!response.ok) {
		throw new Error(await parseErrorMessage(response));
	}
	const body = (await response.json()) as PluginsResponseBody;
	return body.plugins;
}

/**
 * De-dupes concurrent callers onto one in-flight request. A canvas full of N
 * nodes mounts N `useElementBadgeSlot`/`useElementPanelSlot` instances
 * together (plus, potentially, the settings pane) — without this, each one's
 * effect fires its own `GET /api/user/plugins` in the same tick, an N+1 fan-
 * out for data that's identical across every caller (vincent finding,
 * 2026-07-04 UI-slots review).
 *
 * Deliberately NOT a response cache: the slot holds the promise only while
 * a request is outstanding and clears it (success or failure) as soon as
 * that request settles, so a later, non-concurrent call — e.g. the refetch
 * `usePluginSettings.togglePlugin` issues after a PATCH — always goes to the
 * network rather than replaying stale state.
 */
let inFlightFetch: Promise<PluginSettingsListItem[]> | null = null;

/**
 * The one fetch mechanism for effective plugin state (ADR 0002 v2 §2.2/§2.3):
 * both the settings pane (`usePluginSettings`, the full list plus toggling)
 * and build-time UI slots (`useEnabledPluginIds` below, on/off only) read
 * through this single call to `/api/user/plugins` — one endpoint, one
 * response shape, no parallel mechanism invented for slots.
 */
export function fetchPlugins(): Promise<PluginSettingsListItem[]> {
	if (inFlightFetch) {
		return inFlightFetch;
	}
	const promise = requestPlugins().finally(() => {
		inFlightFetch = null;
	});
	inFlightFetch = promise;
	return promise;
}

/**
 * Test-only. Clears any in-flight fetch this module is tracking, so each
 * test file starts without carrying a pending (or already-settled, awaiting
 * microtask cleanup) promise over from a previous case.
 */
export function resetPluginFetchDedupeForTests(): void {
	inFlightFetch = null;
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
