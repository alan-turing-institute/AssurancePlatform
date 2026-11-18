import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";

/**
 * Keys that describe how the canvas is being viewed or how busy the case is,
 * not what the case says: branch visibility and comment counts.
 */
const NON_CONTENT_KEYS = new Set([
	"hidden",
	"childrenHidden",
	"originalHidden",
	"commentCount",
]);

/**
 * A string that changes when what the dashboard thumbnail would show changes:
 * the case's elements and words, and the layout direction. Hiding or showing
 * a branch and comment activity leave it unchanged.
 */
export function caseFingerprint(
	assuranceCase: Pick<AssuranceCaseResponse, "id" | "goals">,
	layoutDirection: string
): string {
	return JSON.stringify(
		{
			id: assuranceCase.id,
			goals: assuranceCase.goals,
			layoutDirection,
		},
		(key, value) => (NON_CONTENT_KEYS.has(key) ? undefined : value)
	);
}
