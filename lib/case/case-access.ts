export type CaseAccessLevel = "view" | "comment" | "edit" | "manage";

const ORDER: readonly CaseAccessLevel[] = ["view", "comment", "edit", "manage"];

/**
 * Whether the case permission the page holds is at least the given level,
 * ordered view, comment, edit, manage. Anything outside those four values,
 * including a case that has not loaded yet, grants nothing.
 */
export function caseAccessAtLeast(
	permissions: unknown,
	level: CaseAccessLevel
): boolean {
	if (typeof permissions !== "string") {
		return false;
	}
	const held = ORDER.indexOf(permissions as CaseAccessLevel);
	return held !== -1 && held >= ORDER.indexOf(level);
}
