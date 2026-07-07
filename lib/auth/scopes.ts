/**
 * The v1 machine-access scope vocabulary (ADR 0002 v2 §2.4).
 *
 * Scopes gate verbs, not resources: *which* cases an integration may touch
 * rides the existing per-case permission model via its system user, not a
 * parallel machine ACL. Core scopes are unprefixed (`case:read`); scopes
 * that gate a plugin's own endpoints are plugin-namespaced
 * (`health:evidence:write`).
 *
 * This list is deliberately closed — extend it only via an ADR amendment,
 * never ad hoc at a call site. `Integration.scopes` is an open `String[]`
 * at the database level (Prisma has no enum-array constraint), so this
 * registry is what makes an unknown scope string a loud, rejected error
 * instead of a silently persisted typo.
 */
export const SCOPES = [
	"case:read",
	"health:evidence:read",
	"health:evidence:write",
] as const;

export type Scope = (typeof SCOPES)[number];

const SCOPE_SET: ReadonlySet<string> = new Set(SCOPES);

/** Type guard: is `value` a member of the current scope vocabulary? */
export function isValidScope(value: string): value is Scope {
	return SCOPE_SET.has(value);
}

/**
 * Returns the subset of `values` that are NOT in the scope registry.
 * Empty array means every value is a known scope.
 */
export function findUnknownScopes(values: readonly string[]): string[] {
	return values.filter((value) => !isValidScope(value));
}

/**
 * Order-independent equality check for two scope sets. Used wherever a
 * caller needs to detect scope drift without treating `["a", "b"]` and
 * `["b", "a"]` as a change — e.g. `scripts/seed-darter-integration.ts`
 * reconciling a re-run's expected scopes against what's persisted.
 */
export function sameScopes(
	a: readonly string[],
	b: readonly string[]
): boolean {
	if (a.length !== b.length) {
		return false;
	}
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((value, index) => value === sortedB[index]);
}
