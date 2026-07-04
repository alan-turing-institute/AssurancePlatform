"use client";

import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthState } from "./health-bands";
import { useClaimScopedFetch } from "./use-claim-scoped-fetch";

interface HealthStateResponseBody {
	health: HealthState | null;
}

async function fetchHealthState(
	elementId: string
): Promise<HealthState | null> {
	const response = await fetch(`/api/elements/${elementId}/health`);
	if (!response.ok) {
		throw new Error(`Failed to fetch health state (${response.status})`);
	}
	const body = (await response.json()) as HealthStateResponseBody;
	return body.health;
}

export type HealthStateStatus = "error" | "loading" | "ready";

export interface UseHealthStateResult {
	health: HealthState | null;
	status: HealthStateStatus;
}

/**
 * The `tea.health` score for one claim (ADR 0002 v2 §3), fetched once on
 * mount and refetched whenever `tea.health/state-changed` arrives for this
 * element over the case's existing SSE stream — via the shared
 * `useClaimScopedFetch` (`use-claim-scoped-fetch.ts`), which also backs
 * `useHealthEvidence`. A plain refetch, not the event payload merged in
 * directly: the payload happens to carry the full state today (the machine
 * evidence route emits it after `recomputeHealthScore`), but a refetch keeps
 * this hook's contract stable regardless of what any given plugin event
 * carries.
 *
 * Only meaningful for `PROPERTY_CLAIM` elements ("property" in
 * `ElementSlotContext.elementType` terms) — evidence-format-v0.1 only ever
 * bears on claims. Callers for any other element type get `status: "ready"`,
 * `health: null` without a request ever being made.
 *
 * Fails closed: a non-OK response or a network error both resolve to
 * `status: "error"`, `health: null` — the badge slot renders nothing rather
 * than guess.
 */
export function useHealthState({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext): UseHealthStateResult {
	const { data, status } = useClaimScopedFetch<HealthState | null>({
		caseId,
		elementId,
		elementType,
		fetchFn: fetchHealthState,
		errorValue: null,
		notApplicableValue: null,
	});

	return { health: data, status };
}
