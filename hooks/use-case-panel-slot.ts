"use client";

import { useMemo } from "react";
import type { CasePanelRegistration } from "@/lib/plugins/slots";
import { casePanelSlot } from "@/lib/plugins/slots";
import { useEnabledPluginIds } from "./use-plugin-enablement";

export interface UseCasePanelSlotResult {
	/** True until enablement resolves. Treated as "no registrations yet" by callers. */
	loading: boolean;
	/** The `case-panel` registrations currently enabled for the session user, in registration order. */
	registrations: readonly CasePanelRegistration[];
}

/**
 * The enabled `case-panel` registrations for the session user, filtered from
 * the build-time registry by the same effective enablement state the other
 * slots read. The caller decides how to lay them out; this hook only answers
 * "which, if any".
 */
export function useCasePanelSlot(): UseCasePanelSlotResult {
	const { enabledPluginIds, loading } = useEnabledPluginIds();

	const registrations = useMemo(
		() =>
			casePanelSlot
				.list()
				.filter((registration) => enabledPluginIds.has(registration.pluginId)),
		[enabledPluginIds]
	);

	return { registrations, loading };
}
