import { logger } from "@/lib/logger";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { addHiddenProp } from "./tree-utils";

const log = logger.child({ component: "fetch-and-refresh-case" });

/**
 * Fetches a case from the API and applies the `addHiddenProp` transform
 * required by the Zustand store. Returns the transformed case, or `null`
 * if the fetch fails.
 *
 * Callers are responsible for error handling (redirects, toasts, etc.)
 * and pushing the result into the store.
 */
export async function fetchAndRefreshCase(
	caseId: string
): Promise<AssuranceCaseResponse | null> {
	const response = await fetch(`/api/cases/${caseId}`);
	if (!response.ok) {
		return null;
	}
	const caseData = await response.json();
	return addHiddenProp(caseData) as AssuranceCaseResponse;
}

/**
 * Reads the case again after a change the canvas did not place itself, and
 * hands it to `apply`, so the canvas ends on the server's state without
 * waiting for the live-update stream. A reply that arrives after the canvas has
 * moved to another case is dropped: `shownCaseId` names the case the canvas
 * shows now. A failed read is logged and leaves the canvas as it is.
 */
export function refreshCaseIfShown(
	caseId: string,
	shownCaseId: () => string | undefined,
	apply: (fresh: AssuranceCaseResponse) => void
): void {
	fetchAndRefreshCase(caseId)
		.then((fresh) => {
			if (fresh && shownCaseId() === caseId) {
				apply(fresh);
			}
		})
		.catch((error) => {
			log.warn("Failed to read the case again after a change", { error });
		});
}
