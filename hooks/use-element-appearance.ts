"use client";

import type {
	AppearanceSubject,
	ElementAppearance,
	ElementType,
} from "@/lib/plugins/slots";
import { elementAppearanceSlot } from "@/lib/plugins/slots";
import useStore from "@/store/store";
import { useEnabledPluginIds } from "./use-plugin-enablement";

/**
 * The `element-appearance` slot (ADR 0002 v2 §2.3) for one subject: how the
 * first enabled plugin that has an opinion wants it drawn, or `null`.
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
	const { enabledPluginIds, loading } = useEnabledPluginIds();
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
