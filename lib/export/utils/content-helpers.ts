/**
 * Content helper utilities for document generation.
 *
 * Common functions for text formatting, content manipulation,
 * and template rendering support.
 */

import type { ElementType, TreeNode } from "@/lib/schemas/case-export";
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
export function getElementTitle(node: TreeNode): string {
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
	return text.replace(/([*_`~[\]()#>+\-=|{}!\\])/g, "\\$1");
}
