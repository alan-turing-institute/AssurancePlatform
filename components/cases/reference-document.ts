/**
 * Converts an element's text to and from the editor's document.
 *
 * The stored text stays a plain string: lines separated by line breaks, with
 * each reference written `{name#id}`. The editor shows one paragraph per line
 * and one highlighted word per reference. Both directions walk the text line
 * by line and never read it as HTML, so characters such as `<` and `&` and
 * runs of spaces come back exactly as they went in.
 *
 * The name stored in a reference is only a fallback. Given the terms the text
 * can reach, a reference is shown, and written back, with the name its entry
 * has now; one whose entry is out of reach keeps the name it was stored with.
 */

import {
	type DefinedTerm,
	findTermById,
	formatReference,
	parseReferences,
	type TextSegment,
} from "@/lib/case/defined-terms";

/** The `char` the suggestion is started with, kept on each reference word. */
const REFERENCE_TRIGGER = "{";

interface TextNodeJson {
	text: string;
	type: "text";
}

interface ReferenceNodeJson {
	attrs: { id: string; label: string; mentionSuggestionChar: string };
	type: "mention";
}

interface ParagraphJson {
	content?: Array<TextNodeJson | ReferenceNodeJson>;
	type: "paragraph";
}

export interface ReferenceDocumentJson {
	content: ParagraphJson[];
	type: "doc";
}

/** The part of the editor's JSON that `documentToText` reads. */
interface ReferenceDocumentInput {
	content?: Array<{
		attrs?: Record<string, unknown>;
		content?: ReferenceDocumentInput["content"];
		text?: string;
		type?: string;
	}>;
}

/** The name a reference shows: its entry's current name, or the stored one when the entry is out of reach. */
function currentName(
	id: string,
	storedName: string,
	terms: readonly DefinedTerm[]
): string {
	return findTermById(terms, id)?.name ?? storedName;
}

function segmentToNode(
	segment: TextSegment,
	terms: readonly DefinedTerm[]
): TextNodeJson | ReferenceNodeJson {
	if (segment.type === "text") {
		return { type: "text", text: segment.text };
	}
	return {
		type: "mention",
		attrs: {
			id: segment.id,
			label: currentName(segment.id, segment.name, terms),
			mentionSuggestionChar: REFERENCE_TRIGGER,
		},
	};
}

/** Builds the editor's document from the stored text. */
export function textToDocument(
	text: string,
	terms: readonly DefinedTerm[] = []
): ReferenceDocumentJson {
	return {
		type: "doc",
		content: text.split("\n").map((line): ParagraphJson => {
			const content = parseReferences(line).map((segment) =>
				segmentToNode(segment, terms)
			);
			return content.length > 0
				? { type: "paragraph", content }
				: { type: "paragraph" };
		}),
	};
}

function inlineToText(
	node: {
		attrs?: Record<string, unknown>;
		text?: string;
		type?: string;
	},
	terms: readonly DefinedTerm[]
): string {
	if (node.type === "text") {
		return node.text ?? "";
	}
	if (node.type === "mention") {
		const id = String(node.attrs?.id ?? "");
		return formatReference(
			currentName(id, String(node.attrs?.label ?? ""), terms),
			id
		);
	}
	return "";
}

/** Writes the editor's document back as the stored text. */
export function documentToText(
	document: ReferenceDocumentInput,
	terms: readonly DefinedTerm[] = []
): string {
	return (document.content ?? [])
		.map((paragraph) =>
			(paragraph.content ?? [])
				.map((node) => inlineToText(node, terms))
				.join("")
		)
		.join("\n");
}
