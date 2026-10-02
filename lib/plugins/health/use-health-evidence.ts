"use client";

import { useCallback, useState } from "react";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthEvidenceLogItem, HealthEvidencePage } from "./health-types";
import { useClaimScopedFetch } from "./use-claim-scoped-fetch";

const PAGE_SIZE = 50;

async function fetchEvidencePage(
	claimId: string,
	before?: number
): Promise<HealthEvidencePage> {
	const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
	if (before !== undefined) {
		query.set("before", String(before));
	}
	const response = await fetch(
		`/api/machine/health/elements/${claimId}/evidence?${query}`
	);
	if (!response.ok) {
		throw new Error(`Failed to fetch evidence log (${response.status})`);
	}
	return (await response.json()) as HealthEvidencePage;
}

const fetchNewestPage = (claimId: string) => fetchEvidencePage(claimId);

export type HealthEvidenceStatus = "error" | "loading" | "ready";

export interface UseHealthEvidenceResult {
	evidence: HealthEvidenceLogItem[] | null;
	hasMore: boolean;
	loadingOlder: boolean;
	/** Appends the next, older page. */
	loadOlder: () => Promise<void>;
	/** True when the last attempt to load an older page failed. */
	olderFailed: boolean;
	/** Fetches the newest page again; older pages already loaded are dropped. */
	refetch: () => Promise<void>;
	status: HealthEvidenceStatus;
}

interface OlderPages {
	/** The newest page these were loaded behind; a different one makes them stale. */
	base: HealthEvidencePage;
	items: HealthEvidenceLogItem[];
	nextBefore: number | null;
}

/**
 * The `tea.health` evidence log for one claim, newest first, 50 at a time:
 * the newest page is fetched on mount and again on each
 * `tea.health/state-changed` for the element, and `loadOlder` appends the
 * next older page. A refetch of the newest page drops the older pages
 * already loaded, since a withdrawal or reinstatement may have changed
 * them. The endpoint is the machine one, which accepts a signed-in person
 * with view access.
 *
 * Non-claim callers get `status: "ready"`, `evidence: []` without a request.
 */
export function useHealthEvidence({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext): UseHealthEvidenceResult {
	const { data, status, refetch } =
		useClaimScopedFetch<HealthEvidencePage | null>({
			caseId,
			elementId,
			elementType,
			fetchFn: fetchNewestPage,
			errorValue: null,
			notApplicableValue: { evidence: [], next_before: null },
		});
	const [older, setOlder] = useState<OlderPages | null>(null);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [olderFailed, setOlderFailed] = useState(false);

	const current = older && older.base === data ? older : null;
	const nextBefore = current ? current.nextBefore : (data?.next_before ?? null);

	const loadOlder = useCallback(async () => {
		if (!data || nextBefore === null) {
			return;
		}
		setLoadingOlder(true);
		setOlderFailed(false);
		try {
			const page = await fetchEvidencePage(elementId, nextBefore);
			setOlder({
				base: data,
				items: [...(current?.items ?? []), ...page.evidence],
				nextBefore: page.next_before,
			});
		} catch {
			setOlderFailed(true);
		} finally {
			setLoadingOlder(false);
		}
	}, [current, data, elementId, nextBefore]);

	return {
		evidence: data ? [...data.evidence, ...(current?.items ?? [])] : null,
		hasMore: nextBefore !== null,
		loadingOlder,
		loadOlder,
		olderFailed,
		refetch,
		status,
	};
}
