/**
 * Splits element text into the pieces a card draws: runs of plain text and
 * references to defined terms, cut to a number of visible characters. A
 * reference counts as the word it shows (its current name), not the braces and
 * id it is stored with, and is never cut in half.
 */

import {
	type DefinedTerm,
	findTermById,
	parseReferences,
	plainReferenceText,
} from "@/lib/case/defined-terms";

export type PreviewPart =
	| { type: "text"; text: string }
	| {
			type: "reference";
			id: string;
			/** The name to show: the entry's current name, or the one stored in the text when the entry is out of reach. */
			name: string;
			/** The definition, or undefined when it is out of reach. */
			term: DefinedTerm | undefined;
	  };

export interface TextPreview {
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
		const name = term?.name ?? segment.name;
		if (name.length > remaining) {
			return cutShort(parts);
		}
		parts.push({ type: "reference", id: segment.id, name, term });
		remaining -= name.length;
	}
	return { parts, truncated: false };
}

/**
 * The description of an element's card data as plain text: each reference is
 * written `{name}` using the entry's current name. Search, the move and attach
 * lists and the options menu show this, never the stored form.
 */
export function plainDescription(
	data: { description?: unknown; termsInReach?: unknown } | undefined
): string {
	const description =
		typeof data?.description === "string" ? data.description : "";
	const terms = Array.isArray(data?.termsInReach)
		? (data.termsInReach as DefinedTerm[])
		: [];
	return plainReferenceText(description, terms);
}
