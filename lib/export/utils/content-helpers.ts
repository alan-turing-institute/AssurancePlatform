/**
 * Content helper utilities for document generation.
 *
 * Common functions for text formatting, content manipulation,
 * and template rendering support.
 */

import type { PlainTreeNode } from "@/lib/case/defined-terms";
import type { ElementType } from "@/lib/schemas/case-export";
import { ELEMENT_TYPE_LABELS } from "../types";

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (including ellipsis)
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Get a human-readable label for an element type
 *
 * @param type - Element type
 * @returns Human-readable label
 */
function getElementTypeLabel(type: ElementType): string {
	return ELEMENT_TYPE_LABELS[type] ?? type;
}

/**
 * Create a title for an element combining type and name
 *
 * @param node - Tree node
 * @returns Title string like "Goal: G1" or "Evidence" if no name
 */
export function getElementTitle(node: PlainTreeNode): string {
	const typeLabel = getElementTypeLabel(node.type);
	return node.name ? `${typeLabel}: ${node.name}` : typeLabel;
}

/** A web or mail address: up to the first space, angle bracket or control character. */
const BARE_ADDRESS = /(?:https?:\/\/|mailto:)[^\s<>\p{Cc}]+/giu;

/** An address with something after its scheme. */
const ADDRESS_WITH_BODY = /^(?:https?:\/\/|mailto:)./i;

/** A character just before a scheme that makes it part of a longer word or address. */
const JOINS_ADDRESS = /[A-Za-z0-9.:/\-_@]/;

/** Marks that end a sentence or quote an address, so they are not part of it. */
const PUNCTUATION_AFTER_ADDRESS = ".,:;!?'\"";

function countOf(text: string, character: string): number {
	return text.split(character).length - 1;
}

/** True when the last character belongs to the sentence around the address. */
function endsOutsideAddress(address: string): boolean {
	const last = address.slice(-1);
	if (last === ")") {
		return countOf(address, ")") > countOf(address, "(");
	}
	return last !== "" && PUNCTUATION_AFTER_ADDRESS.includes(last);
}

/** The part of a candidate that is the address, or null when nothing follows the scheme. */
function addressWithin(candidate: string): string | null {
	let address = candidate;
	while (endsOutsideAddress(address)) {
		address = address.slice(0, -1);
	}
	return ADDRESS_WITH_BODY.test(address) ? address : null;
}

/**
 * Write each web or mail address in the text as a Markdown autolink, which a
 * viewer shows and links exactly as typed, and escape only the text around
 * it. A backslash inside a bare address is read by viewers as part of the
 * address, so an address is never escaped.
 */
function withAddressesAsAutolinks(
	text: string,
	escapeRest: (rest: string) => string
): string {
	let written = "";
	let cursor = 0;
	for (const match of text.matchAll(BARE_ADDRESS)) {
		const address = addressWithin(match[0]);
		if (address === null || JOINS_ADDRESS.test(text.charAt(match.index - 1))) {
			continue;
		}
		written += `${escapeRest(text.slice(cursor, match.index))}<${address}>`;
		cursor = match.index + address.length;
	}
	return written + escapeRest(text.slice(cursor));
}

/**
 * Escape every character Markdown could read as markup, with no special
 * handling of addresses. For text that is already inside a link.
 *
 * @param text - Text to escape
 * @returns Markdown-safe text
 */
export function escapeMarkdownCharacters(text: string): string {
	return text.replace(/([*_`~[\]()#>+\-=|{}!\\<&])/g, "\\$1");
}

/**
 * Escape special characters for Markdown. A web or mail address in the text is
 * written as an autolink and left unescaped.
 *
 * @param text - Text to escape
 * @returns Markdown-safe text
 */
export function escapeMarkdown(text: string): string {
	return withAddressesAsAutolinks(text, escapeMarkdownCharacters);
}

/** Characters escaped in free text, matched in one pass. */
const FREE_TEXT_SPECIAL = /[\\<[\]&`~]/g;

function escapeFreeTextCharacters(text: string): string {
	return text.replace(FREE_TEXT_SPECIAL, (character) =>
		character === "<" ? "&lt;" : `\\${character}`
	);
}

/**
 * Escape free text so Markdown shows it as typed, without reading it as
 * markup.
 *
 * Only the characters that start HTML, links, images, code or character
 * references are escaped. A `<` is written as the reference `&lt;`, and a
 * typed `&` is escaped in the same pass so a reference is never read twice.
 * Every other special character gets a backslash. Braces and hyphens are left
 * alone, so `{term}` references and hyphenated words stay readable in the
 * file. A web or mail address is written as an autolink and left unescaped, so
 * a tag typed straight after it stays outside the link.
 *
 * @param text - Text to escape
 * @returns Text that Markdown shows literally
 */
export function escapeMarkdownText(text: string): string {
	return withAddressesAsAutolinks(text, escapeFreeTextCharacters);
}
