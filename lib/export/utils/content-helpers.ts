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

/**
 * Escape special characters for Markdown
 *
 * @param text - Text to escape
 * @returns Markdown-safe text
 */
export function escapeMarkdown(text: string): string {
	return text.replace(/([*_`~[\]()#>+\-=|{}!\\<&])/g, "\\$1");
}

/** Characters escaped in free text, matched in one pass. */
const FREE_TEXT_SPECIAL = /[\\<[\]&`~]/g;

/**
 * Escape free text so Markdown shows it as typed, without reading it as
 * markup.
 *
 * Only the characters that start HTML, links, images, code or character
 * references are escaped. A `<` is written as the reference `&lt;`, not with a
 * backslash: a viewer that links a web address on sight reads a backslash as
 * part of the address, which would leave a tag written straight after it
 * standing. Every other special character gets a backslash, and a typed `&`
 * is escaped in the same pass so a reference is never read twice. Braces and
 * hyphens are left alone, so `{term}` references and hyphenated words stay
 * readable in the file.
 *
 * @param text - Text to escape
 * @returns Text that Markdown shows literally
 */
export function escapeMarkdownText(text: string): string {
	return text.replace(FREE_TEXT_SPECIAL, (character) =>
		character === "<" ? "&lt;" : `\\${character}`
	);
}
