"use client";

import type { ReactNode } from "react";
import {
	getAssertionStatusIndicator,
	getPlaceholderIndicator,
	UnsupportedMarkerBadge,
} from "@/components/shared/nodes";
import type { ElementType } from "@/lib/plugins/slots";
import useStore from "@/store/store";
import { useChildrenHidden } from "./use-children-hidden";
import { useElementBadgeSlot } from "./use-element-badge-slot";
import { useUnsupportedMarker } from "./use-unsupported-marker";

/**
 * Combines the things a canvas node shows in `BaseNode`'s `topRightActions`
 * slot — the "To fill in" badge of a placeholder, the per-assertion status
 * badge, the unsupported marker, and the badges plugins add through the
 * `element-badge` slot — into the single node `goal-node.tsx`/
 * `strategy-node.tsx`/`property-node.tsx` pass through.
 *
 * The unsupported marker appears only when the status badge does not: an
 * author's own status is the answer to why nothing is beneath the card, and
 * the two badges are never shown together.
 *
 * Was three verbatim copies of this composition (one per node type,
 * introduced alongside the assertionStatus badge); extracted here so the
 * three node components only differ in `elementType`/`nodeType`. Behaviour
 * is unchanged: `null` when the assertion badge, the unsupported marker and
 * the plugin slot are all absent, so `BaseNode`'s
 * `topRightActions && <div>...</div>` guard still renders no wrapper at all
 * (see `useElementBadgeSlot`'s docstring for why that distinction matters).
 */
export function useNodeTopRightActions(
	data: Record<string, unknown>,
	elementType: ElementType,
	nodeId: string
): ReactNode | null {
	const { assuranceCase } = useStore();
	const childrenHidden = useChildrenHidden(nodeId);
	const unsupported = useUnsupportedMarker(nodeId);

	const badgeSlot = useElementBadgeSlot({
		caseId: assuranceCase?.id?.toString() ?? "",
		childrenHidden,
		elementId: String(data.id),
		elementType,
	});
	const assertionBadge = getAssertionStatusIndicator(data.assertionStatus);
	const placeholderBadge = getPlaceholderIndicator(data);
	const unsupportedBadge =
		unsupported && !assertionBadge ? <UnsupportedMarkerBadge /> : null;

	if (!(placeholderBadge || assertionBadge || unsupportedBadge || badgeSlot)) {
		return null;
	}

	return (
		<div className="flex items-center gap-1.5">
			{placeholderBadge}
			{assertionBadge}
			{unsupportedBadge}
			{badgeSlot}
		</div>
	);
}
