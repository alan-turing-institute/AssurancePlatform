/**
 * Identifier Utilities
 *
 * Shared utilities for parsing and comparing element identifiers (e.g., S1, P1.2, G3).
 * Used by reset identifiers API, layout helper and the case export to ensure consistent ordering.
 *
 * @module identifier-utils
 */

interface ParsedIdentifier {
	parts: number[];
	prefix: string;
}

/**
 * Regex pattern for parsing identifiers like "S2", "P1.3", "G1", "AG10",
 * "CP2", "CCt1" — one or more letters (the element's own prefix, plus the
 * "C" defeater marker prepended for a defeater's own prefix; see
 * `lib/element-names/prefix-registry.ts`'s `CORE_PREFIXES` and
 * `DEFEATER_PREFIX_MARKER`) followed by digits, optionally with dot-
 * separated sub-numbers. Case-sensitive — "Ct" (Contract) and "CCt" (a
 * Contract defeater) are distinct prefixes from "CT".
 */
const IDENTIFIER_PATTERN = /^([A-Za-z]+)(\d+(?:\.\d+)*)$/;

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
function parseIdentifier(name: string | null): ParsedIdentifier | null {
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

/**
 * Splits a name into its runs of ASCII digits and runs of everything else
 * ("P1.10" becomes "P", "1", ".", "10").
 */
const NAME_RUNS = /\d+|\D+/g;

const STARTS_WITH_DIGIT = /^\d/;
const LEADING_ZEROS = /^0+/;

/** Whether a run from `NAME_RUNS` is made of digits. */
function isDigitRun(run: string): boolean {
	return STARTS_WITH_DIGIT.test(run);
}

/** Orders two strings by UTF-16 code unit, whatever the locale. */
function compareByCharacterCode(a: string, b: string): number {
	if (a < b) {
		return -1;
	}
	return a > b ? 1 : 0;
}

/**
 * Orders two runs of digits by value, however long: the digits left after
 * leading zeros are compared by length, then digit by digit. Runs of equal
 * value ("01" and "1") compare as equal here.
 */
function compareDigitValues(a: string, b: string): number {
	const aDigits = a.replace(LEADING_ZEROS, "");
	const bDigits = b.replace(LEADING_ZEROS, "");
	return (
		aDigits.length - bDigits.length || compareByCharacterCode(aDigits, bDigits)
	);
}

/**
 * Orders two runs of a name by value alone: a run of digits comes before a
 * run of text, digits compare as numbers, and text compares lower-cased by
 * character code, so runs that differ only in letter case or leading zeros
 * compare as equal.
 */
function compareRunValues(a: string, b: string): number {
	const aIsDigits = isDigitRun(a);
	if (aIsDigits !== isDigitRun(b)) {
		return aIsDigits ? -1 : 1;
	}
	return aIsDigits
		? compareDigitValues(a, b)
		: compareByCharacterCode(a.toLowerCase(), b.toLowerCase());
}

/**
 * Orders two element names the way a person reads a list of identifiers:
 * "P2" before "P10", and "P1.2" before "P1.10". A name is read as runs of
 * digits and runs of text. The runs are compared from the left by value alone,
 * digits as numbers and text without regard to case, a run of digits before a
 * run of text. If every shared run is equal in value, the name with fewer runs
 * comes first. Only then do letter case and leading zeros count: names equal
 * in every run are ordered by their characters, so "P01.2" still comes after
 * "P1.1" and "p2" before "P10". A missing name comes before an empty one, and
 * both come before any other.
 *
 * Unlike `compareIdentifiers`, it gives one consistent order for any pair of
 * strings, identifiers or not, uses no locale, and returns 0 only for
 * identical names, so a sort that uses it comes out the same whatever order
 * the names arrive in.
 *
 * @param a - First element name
 * @param b - Second element name
 * @returns Negative if a < b, positive if a > b, zero if the names are identical
 *
 * @example
 * compareElementNames("P2", "P10") // negative
 * compareElementNames("P1.2", "P1.10") // negative
 * compareElementNames("P1", "P1a") // negative
 * compareElementNames(null, "") // negative
 */
export function compareElementNames(
	a: string | null,
	b: string | null
): number {
	if (a === null || b === null) {
		if (a === b) {
			return 0;
		}
		return a === null ? -1 : 1;
	}
	const aRuns = a.match(NAME_RUNS) ?? [];
	const bRuns = b.match(NAME_RUNS) ?? [];
	const shared = Math.min(aRuns.length, bRuns.length);
	for (let i = 0; i < shared; i++) {
		const order = compareRunValues(aRuns[i] ?? "", bRuns[i] ?? "");
		if (order !== 0) {
			return order;
		}
	}
	return aRuns.length - bRuns.length || compareByCharacterCode(a, b);
}
