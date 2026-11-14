"use client";

import { useCallback, useState } from "react";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import type {
	HealthEvidenceLogItem,
	HealthEvidencePage,
	HealthStatus,
} from "./health-types";
import { useClaimScopedFetch } from "./use-claim-scoped-fetch";
import { fetchHealthStatus } from "./use-health-state";

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

interface NewestLoad {
	/** The claim's status, or null when it has none or could not be read. */
	healthStatus: HealthStatus | null;
	page: HealthEvidencePage;
}

/**
 * The newest page and the claim's status together, so the panel needs only
 * one live-update subscription and one refetch path. A status that cannot
 * be read leaves the header out; it does not hide the log.
 */
async function fetchNewestLoad(claimId: string): Promise<NewestLoad> {
	const [page, healthStatus] = await Promise.all([
		fetchEvidencePage(claimId),
		fetchHealthStatus(claimId).catch(() => null),
	]);
	return { page, healthStatus };
}

export type HealthEvidenceStatus = "error" | "loading" | "ready";

export interface UseHealthEvidenceResult {
	evidence: HealthEvidenceLogItem[] | null;
	hasMore: boolean;
	/** The claim's status, for the panel header; null when it has none. */
	healthStatus: HealthStatus | null;
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
	base: NewestLoad;
	items: HealthEvidenceLogItem[];
	nextBefore: number | null;
}

/**
 * The `tea.health` evidence log for one claim, newest first, 50 at a time:
 * the newest page (with the claim's status) is fetched on mount and again on each
 * `tea.health/state-changed` for the element, and `loadOlder` appends the
 * next older page. A refetch of the newest page drops the older pages
 * already loaded, since a withdrawal or reinstatement may have changed
 * them. The endpoint is the machine one, which accepts a signed-in person
 * with view access.
 *
 * Non-claim callers get `status: "ready"`, `evidence: []` without a request.
 */
export function useHealthEvidence(
	{ caseId, elementId, elementType }: ElementSlotContext,
	onStateChanged?: () => void
): UseHealthEvidenceResult {
	const { data, status, refetch } = useClaimScopedFetch<NewestLoad | null>({
		caseId,
		elementId,
		elementType,
		onStateChanged,
		fetchFn: fetchNewestLoad,
		errorValue: null,
		notApplicableValue: {
			healthStatus: null,
			page: { evidence: [], next_before: null },
		},
	});
	const [older, setOlder] = useState<OlderPages | null>(null);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [olderFailed, setOlderFailed] = useState(false);

	const current = older && older.base === data ? older : null;
	const nextBefore = current
		? current.nextBefore
		: (data?.page.next_before ?? null);

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
		evidence: data ? [...data.page.evidence, ...(current?.items ?? [])] : null,
		healthStatus: data?.healthStatus ?? null,
		hasMore: nextBefore !== null,
		loadingOlder,
		loadOlder,
		olderFailed,
		refetch,
		status,
	};
}
