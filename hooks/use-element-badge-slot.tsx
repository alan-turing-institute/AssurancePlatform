"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementBadgeSlot } from "@/lib/plugins/slots";
import { useEnabledPluginIds } from "./use-plugin-enablement";

/**
 * The `element-badge` slot (ADR 0002 v2 §2.3) for one canvas node.
 *
 * Returns `null` — not a component that itself renders null — when no
 * enabled plugin has registered, or while enablement is still loading.
 * That distinction matters: a caller passes the result straight into
 * `BaseNode`'s `topRightActions` prop, which already guards rendering with
 * `topRightActions && <div>...</div>`. A literal `null` keeps that guard
 * false, so no wrapper element appears at all — zero layout shift, core
 * screens stay pixel-identical with the registry empty. Returning a React
 * element that merely renders null internally would defeat that guard: the
 * element is truthy even when its own output is nothing.
 */
export function useElementBadgeSlot(
	context: ElementSlotContext
): ReactNode | null {
	const { enabledPluginIds, loading } = useEnabledPluginIds();

	const registrations = useMemo(
		() =>
			elementBadgeSlot
				.list()
				.filter((registration) => enabledPluginIds.has(registration.pluginId)),
		[enabledPluginIds]
	);

	if (loading || registrations.length === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-1" data-testid="element-badge-slot">
			{registrations.map(({ pluginId, Component }) => (
				// `key` after the spread so it can't be clobbered if `context`
				// ever gained a same-named field.
				<Component {...context} key={pluginId} />
			))}
		</div>
	);
}
