"use client";

import { useMemo } from "react";
import type { ElementPanelRegistration } from "@/lib/plugins/slots";
import { elementPanelSlot } from "@/lib/plugins/slots";
import { useEnabledPluginIds } from "./use-plugin-enablement";

export interface UseElementPanelSlotResult {
	/** True until enablement resolves. Treated as "no registrations yet" by callers, matching the settings pane's own loading pattern. */
	loading: boolean;
	/** The `element-panel` registrations currently enabled for the session user, in registration order. */
	registrations: readonly ElementPanelRegistration[];
}

/**
 * The enabled `element-panel` registrations for the session user (ADR 0002
 * v2 §2.3), filtered from the build-time registry by the same effective
 * enablement state the settings pane reads. Presentational callers (e.g.
 * `NodeEditDialog`) decide how to lay these out — this hook only answers
 * "which, if any" — so the tab strip they build never has to know anything
 * about a plugin beyond `label` / `icon` / `Component`.
 */
export function useElementPanelSlot(): UseElementPanelSlotResult {
	const { enabledPluginIds, loading } = useEnabledPluginIds();

	const registrations = useMemo(
		() =>
			elementPanelSlot
				.list()
				.filter((registration) => enabledPluginIds.has(registration.pluginId)),
		[enabledPluginIds]
	);

	return { registrations, loading };
}
