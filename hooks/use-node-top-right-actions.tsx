"use client";

import type { ReactNode } from "react";
import { getAssertionStatusIndicator } from "@/components/shared/nodes";
import type { ElementType } from "@/lib/plugins/slots";
import useStore from "@/store/store";
import { useElementBadgeSlot } from "./use-element-badge-slot";

/**
 * Combines the two things a canvas node shows in `BaseNode`'s
 * `topRightActions` slot — the per-assertion status badge (ADR 0004 D3) and
 * the `element-badge` plugin slot (ADR 0002 v2 §2.3) — into the single node
 * `goal-node.tsx`/`strategy-node.tsx`/`property-node.tsx` pass through.
 *
 * Was three verbatim copies of this composition (one per node type,
 * introduced alongside the assertionStatus badge); extracted here so the
 * three node components only differ in `elementType`/`nodeType`. Behaviour
 * is unchanged: `null` when both the assertion badge and the plugin slot are
 * absent, so `BaseNode`'s `topRightActions && <div>...</div>` guard still
 * renders no wrapper at all (see `useElementBadgeSlot`'s docstring for why
 * that distinction matters).
 */
export function useNodeTopRightActions(
	data: Record<string, unknown>,
	elementType: ElementType
): ReactNode | null {
	const { assuranceCase } = useStore();

	const badgeSlot = useElementBadgeSlot({
		caseId: assuranceCase?.id?.toString() ?? "",
		elementId: String(data.id),
		elementType,
	});
	const assertionBadge = getAssertionStatusIndicator(data.assertionStatus);

	if (!(assertionBadge || badgeSlot)) {
		return null;
	}

	return (
		<div className="flex items-center gap-1.5">
			{assertionBadge}
			{badgeSlot}
		</div>
	);
}
