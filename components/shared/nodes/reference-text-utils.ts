/**
 * Splits element text into the pieces a card draws: runs of plain text and
 * references to defined terms, cut to a number of visible characters. A
 * reference counts as the words it shows (its current name; for a variable,
 * its value), not the braces and id it is stored with. A name is never cut in
 * half, but a variable's value is cut like ordinary text.
 */

import {
	type DefinedTerm,
	findTermById,
	parseReferences,
	plainReferenceText,
	referenceDisplay,
} from "@/lib/case/defined-terms";

export type PreviewPart =
	| { type: "text"; text: string }
	| {
			type: "reference";
			id: string;
			/** The words to show: the entry's current name (the one stored in the text when the entry is out of reach); for a variable, its value, or `[name]` while it has none. */
			name: string;
			/** The definition, or undefined when it is out of reach. */
			term: DefinedTerm | undefined;
			/** Set on a variable that has no value yet. */
			unfilled?: true;
	  };

interface TextPreview {
	parts: PreviewPart[];
	/** Whether text was left out. */
	truncated: boolean;
}

/** Ends a cut-short preview at its last word, not at a space before the ellipsis. */
function cutShort(parts: PreviewPart[]): TextPreview {
	const last = parts.at(-1);
	if (last?.type === "text") {
		parts[parts.length - 1] = { type: "text", text: last.text.trimEnd() };
	}
	return { parts, truncated: true };
}

/** The pieces of `text` that fit in `maxLength` visible characters. */
export function previewParts(
	text: string,
	terms: readonly DefinedTerm[],
	maxLength: number
): TextPreview {
	const parts: PreviewPart[] = [];
	let remaining = maxLength;
	for (const segment of parseReferences(text)) {
		if (remaining <= 0) {
			return cutShort(parts);
		}
		if (segment.type === "text") {
			if (segment.text.length > remaining) {
				parts.push({ type: "text", text: segment.text.slice(0, remaining) });
				return cutShort(parts);
			}
			parts.push({ type: "text", text: segment.text });
			remaining -= segment.text.length;
			continue;
		}
		const term = findTermById(terms, segment.id);
		const shown = referenceDisplay(term, segment.name);
		const part = (name: string): PreviewPart => ({
			type: "reference",
			id: segment.id,
			name,
			term,
			...(shown.unfilled ? { unfilled: true as const } : {}),
		});
		if (shown.text.length > remaining) {
			// A name is left out whole; a value is cut like ordinary text.
			if (shown.variable && !shown.unfilled) {
				parts.push(part(shown.text.slice(0, remaining).trimEnd()));
			}
			return cutShort(parts);
		}
		parts.push(part(shown.text));
		remaining -= shown.text.length;
	}
	return { parts, truncated: false };
}

/** The terms in reach recorded on an element's card data, or none. */
function termsOf(data: { termsInReach?: unknown } | undefined): DefinedTerm[] {
	return Array.isArray(data?.termsInReach)
		? (data.termsInReach as DefinedTerm[])
		: [];
}

/**
 * The description of an element's card data as plain text: each reference is
 * written `{name}` using the entry's current name, except a variable, which is
 * written as its value (or `[name]` while it has none). The search results,
 * the move and attach lists and the options menu show this, never the stored
 * form.
 */
export function plainDescription(
	data: { description?: unknown; termsInReach?: unknown } | undefined
): string {
	const description =
		typeof data?.description === "string" ? data.description : "";
	return plainReferenceText(description, termsOf(data));
}

/**
 * The text a search is matched against: the description as
 * `plainDescription` shows it, followed by the name of each variable it
 * mentions, so that a search finds a variable by its name as well as by the
 * value the card shows in its place.
 */
export function searchableDescription(
	data: { description?: unknown; termsInReach?: unknown } | undefined
): string {
	const shown = plainDescription(data);
	const description =
		typeof data?.description === "string" ? data.description : "";
	const terms = termsOf(data);
	const names = parseReferences(description).flatMap((segment) => {
		if (segment.type !== "reference") {
			return [];
		}
		const term = findTermById(terms, segment.id);
		return term?.variable ? [term.name] : [];
	});
	return names.length > 0 ? `${shown} ${names.join(" ")}` : shown;
}
