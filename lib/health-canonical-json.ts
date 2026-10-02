/**
 * Canonical (sorted-key) JSON serialization. Used for hash-chain
 * content and for comparing two values, never for storage or the API response: Postgres's `jsonb` type
 * does not guarantee it will hand back object keys in their original
 * insertion order, so re-deriving `recordHash` from a rehydrated row using
 * plain `JSON.stringify` would let an unmodified record fail its own hash
 * check purely from key reordering. Sorting keys at every level makes the
 * serialization depend only on content.
 *
 * Shared by the evidence hash chain and by the comparison of a record's
 * settings with the declared ones, where two objects are equal when their
 * canonical forms are.
 */
export function canonicalJSON(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJSON(item)).join(",")}]`;
	}
	const entries = Object.keys(value as Record<string, unknown>)
		.sort()
		.map(
			(key) =>
				`${JSON.stringify(key)}:${canonicalJSON((value as Record<string, unknown>)[key])}`
		);
	return `{${entries.join(",")}}`;
}
