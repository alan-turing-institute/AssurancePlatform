"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
	type LiveNodeIndex,
	NO_LIVE_NODES,
	readLiveNodes,
	subscribeToLiveNodes,
} from "./live-evidence-nodes";

const NOT_SUBSCRIBED = () => undefined;

/**
 * The case's live evidence nodes (`live-evidence-nodes.ts`). With `enabled`
 * false, or no case, the hook holds nothing and asks for nothing: it returns
 * the empty list. Many components share one read of the list per case.
 */
export function useLiveEvidenceNodes(
	caseId: string,
	enabled: boolean
): LiveNodeIndex {
	const active = enabled && caseId !== "";
	const subscribe = useCallback(
		(listener: () => void) =>
			active ? subscribeToLiveNodes(caseId, listener) : NOT_SUBSCRIBED,
		[active, caseId]
	);
	return useSyncExternalStore(
		subscribe,
		() => (active ? readLiveNodes(caseId) : NO_LIVE_NODES),
		() => NO_LIVE_NODES
	);
}
