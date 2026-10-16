"use client";

import type { AppearanceSubject, ElementAppearance } from "@/lib/plugins/slots";
import { type LiveNodeState, liveNodeStateOf } from "./health-format";
import type { HealthLiveEvidenceNode } from "./health-types";
import type { LiveNodeIndex } from "./live-evidence-nodes";
import { useLiveEvidenceNodes } from "./use-live-evidence-nodes";
import { useRerenderAtExpiry } from "./use-rerender-at-expiry";

/**
 * How a live node and its edge are drawn for a state: the verdict's tone, and
 * faded once the result is out of date. A claim with no result yet is drawn as
 * plain evidence, and so is one whose results have all been withdrawn, except
 * that it is faded.
 */
export function appearanceOf(state: LiveNodeState): ElementAppearance | null {
	switch (state.kind) {
		case "none":
			return null;
		case "withdrawn":
			return { tone: "neutral", faded: true };
		case "pass":
			return { tone: "positive", faded: state.stale };
		case "marginal":
			return { tone: "caution", faded: state.stale };
		case "fail":
			return { tone: "negative", faded: state.stale };
		default:
			return { tone: "neutral", faded: state.stale };
	}
}

/**
 * The live node an appearance question is about: for a node, the node itself;
 * for an edge, the node at its target when the edge starts at the claim the
 * node reports on, so a second claim linked to the same node draws plain.
 */
function liveNodeFor(
	index: LiveNodeIndex,
	subject: AppearanceSubject
): HealthLiveEvidenceNode | undefined {
	if (subject.kind === "node") {
		return subject.elementType === "evidence"
			? index.byNodeId.get(subject.elementId)
			: undefined;
	}
	const node = index.byNodeId.get(subject.targetElementId);
	return node?.claim_id === subject.sourceElementId ? node : undefined;
}

/**
 * The health plugin's answer to the `element-appearance` slot. It reads the
 * case's shared list of live nodes, so a node or edge that is not live costs
 * no request, and with the plugin off it reads nothing at all. The fade
 * follows the same clock as the node's badge: the answer is worked out again
 * when the result expires.
 */
export function useHealthAppearance(
	subject: AppearanceSubject,
	enabled: boolean
): ElementAppearance | null {
	const index = useLiveEvidenceNodes(subject.caseId, enabled);
	const live = enabled ? liveNodeFor(index, subject) : undefined;
	useRerenderAtExpiry(live?.status?.expires_at ?? null);
	if (!live) {
		return null;
	}
	return appearanceOf(liveNodeStateOf(live.status, Date.now()));
}
