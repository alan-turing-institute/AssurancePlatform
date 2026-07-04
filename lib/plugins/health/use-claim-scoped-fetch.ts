"use client";

import { useCallback, useEffect, useState } from "react";
import type { SSEEvent } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";

const HEALTH_STATE_EVENT_TYPE = "tea.health/state-changed";

function isHealthStateEventForElement(
	event: SSEEvent,
	elementId: string
): boolean {
	return (
		event.type === HEALTH_STATE_EVENT_TYPE &&
		event.payload?.claimId === elementId
	);
}

export type ClaimScopedFetchStatus = "error" | "loading" | "ready";

export interface ClaimScopedFetchResult<T> {
	data: T;
	status: ClaimScopedFetchStatus;
}

export interface UseClaimScopedFetchOptions<T> extends ElementSlotContext {
	/**
	 * Value to fall back to when `fetchFn` throws. Passed explicitly (rather
	 * than assumed to be `null`) because `T` is caller-defined and not every
	 * caller's `T` includes `null` in principle — in practice both current
	 * callers' `T` does, but the hook itself makes no such assumption.
	 */
	errorValue: T;
	/**
	 * What `fetchFn` resolves to. Fetched once on mount and refetched whenever
	 * `tea.health/state-changed` arrives for this element over the case's SSE
	 * stream (`useCaseEvents`) — never merged from the event payload directly,
	 * so this hook's contract stays stable regardless of what any given
	 * plugin event happens to carry.
	 */
	fetchFn: (elementId: string) => Promise<T>;
	/**
	 * Value to use for a non-claim element — `fetchFn` is never called for
	 * one (evidence-format-v0.1 / `tea.health`'s scoring only ever bears on
	 * `PROPERTY_CLAIM` elements), so this is what the "ready" state carries
	 * instead of a request that would never resolve.
	 */
	notApplicableValue: T;
}

/**
 * Shared refetch + SSE wiring behind `useHealthState` and `useHealthEvidence`
 * — the identical 19-line "fetch once on mount, refetch on
 * `tea.health/state-changed`, no-op entirely for non-claim elements" pattern
 * that was duplicated between them (fallow clone, n-F...). Generic over the
 * fetched shape `T` so both hooks (one fetching a `HealthState | null`, the
 * other a `HealthEvidenceLogItem[]`) share one implementation rather than one
 * copying the other's wiring by hand.
 */
export function useClaimScopedFetch<T>({
	caseId,
	elementId,
	elementType,
	errorValue,
	notApplicableValue,
	fetchFn,
}: UseClaimScopedFetchOptions<T>): ClaimScopedFetchResult<T> {
	const isClaim = elementType === "property";
	const [data, setData] = useState<T>(
		isClaim ? errorValue : notApplicableValue
	);
	const [status, setStatus] = useState<ClaimScopedFetchStatus>(
		isClaim ? "loading" : "ready"
	);

	const refetch = useCallback(async () => {
		if (!isClaim) {
			return;
		}
		try {
			const result = await fetchFn(elementId);
			setData(result);
			setStatus("ready");
		} catch {
			setData(errorValue);
			setStatus("error");
		}
	}, [elementId, isClaim, fetchFn, errorValue]);

	useEffect(() => {
		refetch();
	}, [refetch]);

	useCaseEvents({
		caseId,
		enabled: isClaim && Boolean(caseId),
		onEvent: (event) => {
			if (isHealthStateEventForElement(event, elementId)) {
				refetch();
			}
		},
	});

	return { data, status };
}
