/**
 * Identifier Utilities
 *
 * Shared utilities for parsing and comparing element identifiers (e.g., S1, P1.2, G3).
 * Used by reset identifiers API and layout helper to ensure consistent ordering.
 *
 * @module identifier-utils
 */

type ParsedIdentifier = {
	prefix: string;
	parts: number[];
};

/**
 * Regex pattern for parsing identifiers like "S2", "P1.3", "G1"
 * Matches: single uppercase letter followed by digits, optionally with dot-separated sub-numbers
 */
const IDENTIFIER_PATTERN = /^([A-Z])(\d+(?:\.\d+)*)$/;

/**
 * Parses an identifier like "S2", "P1.3", "G1" into sortable components.
 *
 * @param name - The identifier string to parse (e.g., "S2", "P1.3")
 * @returns Parsed identifier with prefix and numeric parts, or null if invalid
 *
 * @example
 * parseIdentifier("S2") // { prefix: "S", parts: [2] }
 * parseIdentifier("P1.3") // { prefix: "P", parts: [1, 3] }
 * parseIdentifier("invalid") // null
 */
export function parseIdentifier(name: string | null): ParsedIdentifier | null {
	if (!name) {
		return null;
	}
	const match = name.match(IDENTIFIER_PATTERN);
	if (!match) {
		return null;
	}
	return {
		prefix: match[1] ?? "",
		parts: (match[2] ?? "").split(".").map(Number),
	};
}

/**
 * Compares two identifier strings for sorting (handles P1.2 vs P1.10 correctly).
 *
 * Identifiers with the same prefix are sorted numerically by their parts.
 * Falls back to string comparison for different prefixes or invalid identifiers.
 *
 * @param a - First identifier string
 * @param b - Second identifier string
 * @returns Negative if a < b, positive if a > b, zero if equal
 *
 * @example
 * compareIdentifiers("S1", "S2") // -1 (S1 comes before S2)
 * compareIdentifiers("P1.2", "P1.10") // -1 (P1.2 comes before P1.10)
 * compareIdentifiers("S1", "P1") // string comparison (different prefixes)
 */
export function compareIdentifiers(a: string | null, b: string | null): number {
	const aParsed = parseIdentifier(a);
	const bParsed = parseIdentifier(b);

	if (aParsed && bParsed && aParsed.prefix === bParsed.prefix) {
		for (
			let i = 0;
			i < Math.max(aParsed.parts.length, bParsed.parts.length);
			i++
		) {
			const aNum = aParsed.parts[i] ?? 0;
			const bNum = bParsed.parts[i] ?? 0;
			if (aNum !== bNum) {
				return aNum - bNum;
			}
		}
		return 0;
	}

	// Fallback to string comparison
	return (a ?? "").localeCompare(b ?? "");
}
