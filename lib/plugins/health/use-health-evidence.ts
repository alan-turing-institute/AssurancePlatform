"use client";

import { useCallback, useEffect, useState } from "react";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";

const HEALTH_STATE_EVENT_TYPE = "tea.health/state-changed";

export type HealthEvidenceVerdict = "DEGRADED" | "FAIL" | "PASS";

/**
 * One evidence-format-v0.1 item as returned by
 * `GET /api/machine/health/elements/[id]/evidence` — mirrors
 * `PluginHealthEvidence` (`prisma/schema.prisma`) field-for-field so a mock
 * fixture can be checked with `satisfies` against the real response shape.
 */
export interface HealthEvidenceLogItem {
	chainSequence: number;
	claimId: string;
	createdAt: string;
	createdById: string;
	evaluatedAt: string;
	formatVersion: string;
	id: string;
	metricName: string;
	oddDimensions: string[];
	previousRecordHash: string | null;
	provenance: Record<string, unknown>;
	recordHash: string;
	sourceSystem: string;
	threshold: number | null;
	value: number | null;
	verdict: HealthEvidenceVerdict;
}

interface EvidenceResponseBody {
	evidence: HealthEvidenceLogItem[];
}

async function fetchEvidenceLog(
	claimId: string
): Promise<HealthEvidenceLogItem[]> {
	const response = await fetch(
		`/api/machine/health/elements/${claimId}/evidence`
	);
	if (!response.ok) {
		throw new Error(`Failed to fetch evidence log (${response.status})`);
	}
	const body = (await response.json()) as EvidenceResponseBody;
	return body.evidence;
}

export type HealthEvidenceStatus = "error" | "loading" | "ready";

export interface UseHealthEvidenceResult {
	evidence: HealthEvidenceLogItem[] | null;
	status: HealthEvidenceStatus;
}

/**
 * The `tea.health` append-only evidence log for one claim (ADR 0002 v2 §3),
 * via the existing machine endpoint's human-session auth path — a session
 * with case VIEW access is an accepted caller of
 * `GET /api/machine/health/elements/[id]/evidence` alongside a scoped bearer
 * token (verified in the server-core review). No new route: the
 * `element-panel` slot is simply the second, already-anticipated consumer of
 * an endpoint built for DARTER.
 *
 * Only meaningful for `PROPERTY_CLAIM` elements — see `useHealthState`'s
 * doc. Non-claim callers get `status: "ready"`, `evidence: []` without a
 * request ever being made, so the panel can render a distinct "not
 * applicable" state instead of a misleading fetch error.
 */
export function useHealthEvidence({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext): UseHealthEvidenceResult {
	const isClaim = elementType === "property";
	const [evidence, setEvidence] = useState<HealthEvidenceLogItem[] | null>(
		isClaim ? null : []
	);
	const [status, setStatus] = useState<HealthEvidenceStatus>(
		isClaim ? "loading" : "ready"
	);

	const refetch = useCallback(async () => {
		if (!isClaim) {
			return;
		}
		try {
			const log = await fetchEvidenceLog(elementId);
			setEvidence(log);
			setStatus("ready");
		} catch {
			setEvidence(null);
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
			if (
				event.type === HEALTH_STATE_EVENT_TYPE &&
				event.payload?.claimId === elementId
			) {
				refetch();
			}
		},
	});

	return { evidence, status };
}
