import type { AssuranceCase } from "@/types";
import { addHiddenProp } from "./tree-utils";

/**
 * Fetches a case from the API and applies the `addHiddenProp` transform
 * required by the Zustand store. Returns the transformed case, or `null`
 * if the fetch fails.
 *
 * Callers are responsible for error handling (redirects, toasts, etc.)
 * and pushing the result into the store.
 */
export async function fetchAndRefreshCase(
	caseId: string,
): Promise<AssuranceCase | null> {
	const response = await fetch(`/api/cases/${caseId}`);
	if (!response.ok) {
		return null;
	}
	const caseData = await response.json();
	return addHiddenProp(caseData) as AssuranceCase;
}
