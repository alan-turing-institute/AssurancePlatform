"use client";

import { useCallback, useMemo } from "react";
import { parseErrorMessage, useFetchOnMount } from "@/hooks/use-fetch-on-mount";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import useStore from "@/store/store";

const NO_PLUGINS: PluginSettingsListItem[] = [];

interface PluginsResponseBody {
	plugins: PluginSettingsListItem[];
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
 * (`usePluginSettings`) is where the real error surfaces to the user. Built
 * on the shared `useFetchOnMount` (`hooks/use-fetch-on-mount.ts`) — `data`
 * only changes when a fetch actually resolves, so the derived `Set` is
 * memoised on it rather than rebuilt every render (`useElementBadgeSlot`/
 * `useElementPanelSlot` key a `useMemo` off `enabledPluginIds` itself, so a
 * fresh `Set` reference every render would defeat that memoisation).
 *
 * On the read-only docs canvas (`store.readOnlyCanvas`), this never calls
 * `GET /api/user/plugins` at all: a signed-out docs visitor has no session,
 * so the request always 401s, and every plugin badge/panel is degraded UI
 * the reveal-stage viewer has no use for anyway. Resolving straight to an
 * empty list keeps every downstream slot exactly as it renders today for a
 * failed or disabled-everything response — nothing appears — without a
 * network round trip.
 */
export function useEnabledPluginIds(): UseEnabledPluginIdsResult {
	const readOnlyCanvas = useStore((state) => state.readOnlyCanvas);
	const fetcher = useCallback(
		() => (readOnlyCanvas ? Promise.resolve(NO_PLUGINS) : fetchPlugins()),
		[readOnlyCanvas]
	);
	const { data, loading } = useFetchOnMount(fetcher);

	const enabledPluginIds = useMemo(() => {
		if (!data) {
			return EMPTY_SET;
		}
		return new Set(data.filter((p) => p.enabled).map((p) => p.pluginId));
	}, [data]);

	return { enabledPluginIds, loading };
}
