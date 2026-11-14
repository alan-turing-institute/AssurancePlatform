/** What a case row is called in interface copy: a pattern is a pattern, anything else a case. */
export type CaseItemName = "case" | "pattern";

/** The word that interface copy uses for a case row of the given kind. */
export function caseItemName(
	kind: "CASE" | "PATTERN" | undefined
): CaseItemName {
	return kind === "PATTERN" ? "pattern" : "case";
}
