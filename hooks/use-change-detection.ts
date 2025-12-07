"use client";

import { useCallback, useEffect, useState } from "react";

type ChangeSummary = {
	addedElements: number;
	removedElements: number;
	modifiedElements: number;
};

type ChangeDetectionResult = {
	hasChanges: boolean;
	publishedAt: string | null;
	publishedId: string | null;
	changeSummary?: ChangeSummary;
};

type UseChangeDetectionOptions = {
	/** Case ID to check for changes */
	caseId: string | null;
	/** Whether to include detailed change summary */
	includeDetails?: boolean;
	/** Whether the hook is enabled */
	enabled?: boolean;
	/** Poll interval in milliseconds (0 to disable polling) */
	pollInterval?: number;
};

type UseChangeDetectionReturn = {
	/** Whether changes were detected */
	hasChanges: boolean;
	/** When the case was last published */
	publishedAt: string | null;
	/** ID of the published version */
	publishedId: string | null;
	/** Detailed change summary (if includeDetails is true) */
	changeSummary: ChangeSummary | null;
	/** Whether the hook is loading */
	isLoading: boolean;
	/** Error message if fetch failed */
	error: string | null;
	/** Manually refresh the change detection */
	refresh: () => Promise<void>;
};

type ChangeDetectionState = {
	hasChanges: boolean;
	publishedAt: string | null;
	publishedId: string | null;
	changeSummary: ChangeSummary | null;
	isLoading: boolean;
	error: string | null;
};

const initialState: ChangeDetectionState = {
	hasChanges: false,
	publishedAt: null,
	publishedId: null,
	changeSummary: null,
	isLoading: false,
	error: null,
};

function buildUrl(caseId: string, includeDetails: boolean): string {
	const params = new URLSearchParams();
	if (includeDetails) {
		params.set("includeDetails", "true");
	}
	const query = params.toString();
	return `/api/cases/${caseId}/changes${query ? `?${query}` : ""}`;
}

async function fetchChangeDetection(
	caseId: string,
	includeDetails: boolean
): Promise<ChangeDetectionResult> {
	const url = buildUrl(caseId, includeDetails);
	const response = await fetch(url);
	const text = await response.text();

	// Handle empty response
	if (!text) {
		throw new Error("Empty response from server");
	}

	let data: ChangeDetectionResult & { error?: string };
	try {
		data = JSON.parse(text);
	} catch {
		throw new Error("Invalid JSON response from server");
	}

	if (!response.ok) {
		throw new Error(data.error || "Failed to fetch changes");
	}

	return data;
}

/**
 * React hook for detecting changes between the current case and its published version.
 *
 * @example
 * ```tsx
 * const { hasChanges, publishedAt, isLoading, refresh } = useChangeDetection({
 *   caseId: "abc123",
 *   enabled: status === "PUBLISHED",
 * });
 *
 * if (hasChanges) {
 *   // Show "Update Published" button
 * }
 * ```
 */
export function useChangeDetection({
	caseId,
	includeDetails = false,
	enabled = true,
	pollInterval = 0,
}: UseChangeDetectionOptions): UseChangeDetectionReturn {
	const [state, setState] = useState<ChangeDetectionState>(initialState);

	const fetchChanges = useCallback(async () => {
		if (!caseId) {
			return;
		}

		setState((prev) => ({ ...prev, isLoading: true, error: null }));

		try {
			const result = await fetchChangeDetection(caseId, includeDetails);
			setState({
				hasChanges: result.hasChanges,
				publishedAt: result.publishedAt,
				publishedId: result.publishedId,
				changeSummary: result.changeSummary ?? null,
				isLoading: false,
				error: null,
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to detect changes";
			setState((prev) => ({ ...prev, isLoading: false, error: message }));
			console.error("[useChangeDetection] Error:", message);
		}
	}, [caseId, includeDetails]);

	// Initial fetch and when dependencies change
	useEffect(() => {
		if (enabled && caseId) {
			fetchChanges();
		} else {
			setState(initialState);
		}
	}, [enabled, caseId, fetchChanges]);

	// Optional polling
	useEffect(() => {
		if (!(enabled && caseId && pollInterval > 0)) {
			return;
		}

		const interval = setInterval(fetchChanges, pollInterval);
		return () => clearInterval(interval);
	}, [enabled, caseId, pollInterval, fetchChanges]);

	return {
		...state,
		refresh: fetchChanges,
	};
}
