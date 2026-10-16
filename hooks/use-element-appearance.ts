"use client";

import type {
	AppearanceSubject,
	ElementAppearance,
	ElementType,
} from "@/lib/plugins/slots";
import { elementAppearanceSlot } from "@/lib/plugins/slots";
import useStore from "@/store/store";
import { useRememberedEnabledPluginIds } from "./remembered-plugin-ids";
import { useEnabledPluginIds } from "./use-plugin-enablement";

/**
 * Which plugins are on, for a node or edge that may have just mounted. A canvas
 * edge gets a new id, and so a new instance, on every case reload, and its own
 * request for the plugin list takes a round trip, during which every plugin
 * would count as off and the edge would be drawn plain. While that request is
 * out, the last answer any component received stands in for it; the edge's own
 * answer replaces it as soon as it arrives. The read-only canvas in the
 * documentation never uses it: there every plugin is off.
 */
function useKnownEnabledPluginIds() {
	const fresh = useEnabledPluginIds();
	const remembered = useRememberedEnabledPluginIds();
	const readOnlyCanvas = useStore((state) => state.readOnlyCanvas);
	if (fresh.loading && remembered && !readOnlyCanvas) {
		return { enabledPluginIds: remembered, loading: false };
	}
	return fresh;
}

/**
 * The `element-appearance` slot for one subject: how the first enabled plugin
 * that has an opinion wants it drawn, or `null`.
 *
 * Every registered plugin's hook runs on every render, whether or not the
 * plugin is on, because React needs the same hooks in the same order each
 * time. The registry is filled once, when the plugin modules load, so the
 * list does not change between renders. A plugin that is off, or whose
 * enablement is still loading, is told so and answers `null` without making a
 * request. With nothing registered the result is always `null`, and the
 * canvas draws exactly as it does without the slot.
 */
function useAppearance(subject: AppearanceSubject): ElementAppearance | null {
	const { enabledPluginIds, loading } = useKnownEnabledPluginIds();
	let answer: ElementAppearance | null = null;
	for (const registration of elementAppearanceSlot.list()) {
		const enabled = !loading && enabledPluginIds.has(registration.pluginId);
		// biome-ignore lint/correctness/useHookAtTopLevel: the registry is closed after bootstrap, so the loop runs the same hooks in the same order on every render.
		const result = registration.useAppearance(subject, enabled);
		if (enabled && result && !answer) {
			answer = result;
		}
	}
	return answer;
}

/** The id of the case on the canvas; empty where no case is loaded. */
function useCanvasCaseId(): string {
	return useStore((state) => state.assuranceCase?.id?.toString() ?? "");
}

/** How the plugins want one canvas element drawn. */
export function useNodeAppearance(
	elementId: string,
	elementType: ElementType
): ElementAppearance | null {
	const caseId = useCanvasCaseId();
	return useAppearance({ kind: "node", caseId, elementId, elementType });
}

/** How the plugins want the line from one canvas element to another drawn. */
export function useEdgeAppearance(
	sourceElementId: string | undefined,
	targetElementId: string | undefined
): ElementAppearance | null {
	const caseId = useCanvasCaseId();
	return useAppearance({
		kind: "edge",
		caseId,
		sourceElementId: sourceElementId ?? "",
		targetElementId: targetElementId ?? "",
	});
}
