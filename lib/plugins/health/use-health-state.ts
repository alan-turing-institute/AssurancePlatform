"use client";

import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthStatus } from "./health-types";
import { useClaimScopedFetch } from "./use-claim-scoped-fetch";

interface HealthStateResponseBody {
	status: HealthStatus | null;
}

export async function fetchHealthStatus(
	elementId: string
): Promise<HealthStatus | null> {
	const response = await fetch(`/api/elements/${elementId}/health`);
	if (!response.ok) {
		throw new Error(`Failed to fetch health status (${response.status})`);
	}
	const body = (await response.json()) as HealthStateResponseBody;
	return body.status;
}

export type HealthStateStatus = "error" | "loading" | "ready";

export interface UseHealthStateResult {
	/** The claim's status; null when it has neither a bound check nor a record. */
	healthStatus: HealthStatus | null;
	/** Fetches the status again now. */
	refetch: () => Promise<void>;
	/** The state of the fetch itself. */
	status: HealthStateStatus;
}

/**
 * The `tea.health` status for one claim, fetched once on mount and refetched
 * whenever `tea.health/state-changed` arrives for this element over the
 * case's SSE stream (via `useClaimScopedFetch`, which also backs
 * `useHealthEvidence`). The event only triggers a refetch; its payload is
 * never merged in.
 *
 * Only meaningful for property claims. Callers for any other element type
 * get `status: "ready"`, `healthStatus: null` without a request.
 *
 * Fails closed: a non-OK response or a network error both resolve to
 * `status: "error"`, `healthStatus: null`, and the badge renders nothing.
 */
export function useHealthState({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext): UseHealthStateResult {
	const { data, status, refetch } = useClaimScopedFetch<HealthStatus | null>({
		caseId,
		elementId,
		elementType,
		fetchFn: fetchHealthStatus,
		errorValue: null,
		notApplicableValue: null,
	});

	return { healthStatus: data, status, refetch };
}
