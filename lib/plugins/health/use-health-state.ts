"use client";

import { useCallback, useEffect, useState } from "react";
import type { SSEEvent } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthState } from "./health-bands";

const HEALTH_STATE_EVENT_TYPE = "tea.health/state-changed";

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

function isHealthStateEventForElement(
	event: SSEEvent,
	elementId: string
): boolean {
	return (
		event.type === HEALTH_STATE_EVENT_TYPE &&
		event.payload?.claimId === elementId
	);
}

export type HealthStateStatus = "error" | "loading" | "ready";

export interface UseHealthStateResult {
	health: HealthState | null;
	status: HealthStateStatus;
}

/**
 * The `tea.health` score for one claim (ADR 0002 v2 §3), fetched once on
 * mount and refetched whenever `tea.health/state-changed` arrives for this
 * element over the case's existing SSE stream (`useCaseEvents`). A plain
 * refetch, not the event payload merged in directly: the payload happens to
 * carry the full state today (the machine evidence route emits it after
 * `recomputeHealthScore`), but a refetch keeps this hook's contract stable
 * regardless of what any given plugin event carries.
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
	const isClaim = elementType === "property";
	const [health, setHealth] = useState<HealthState | null>(null);
	const [status, setStatus] = useState<HealthStateStatus>(
		isClaim ? "loading" : "ready"
	);

	const refetch = useCallback(async () => {
		if (!isClaim) {
			return;
		}
		try {
			const result = await fetchHealthState(elementId);
			setHealth(result);
			setStatus("ready");
		} catch {
			setHealth(null);
			setStatus("error");
		}
	}, [elementId, isClaim]);

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

	return { health, status };
}
