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
 * Sanitise a string for use in filenames
 *
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * and removes leading/trailing hyphens.
 *
 * @param text - Text to sanitise
 * @returns Sanitised filename-safe string
 */
export function sanitiseForFilename(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

/**
 * Format a date for display in exports
 *
 * @param date - Date to format
 * @param locale - Locale for formatting (defaults to en-GB)
 * @returns Formatted date string
 */
export function formatDate(date: Date, locale = "en-GB"): string {
	return date.toLocaleDateString(locale);
}

/**
 * Format a date and time for display in exports
 *
 * @param date - Date to format
 * @param locale - Locale for formatting (defaults to en-GB)
 * @returns Formatted date-time string
 */
export function formatDateTime(date: Date, locale = "en-GB"): string {
	return date.toLocaleString(locale);
}

/**
 * Get a human-readable label for an element type
 *
 * @param type - Element type
 * @returns Human-readable label
 */
export function getElementTypeLabel(type: ElementType): string {
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
 * Strip HTML tags from text
 *
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

/**
 * Convert newlines to spaces (for single-line displays)
 *
 * @param text - Text with potential newlines
 * @returns Text with newlines replaced by spaces
 */
export function flattenText(text: string): string {
	return text.replace(/\s*\n\s*/g, " ").trim();
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

/**
 * Generate ISO date string for export metadata
 *
 * @param date - Date to format (defaults to now)
 * @returns ISO 8601 date string
 */
export function getISODateString(date: Date = new Date()): string {
	return date.toISOString();
}

/**
 * Generate date-only string for filenames (YYYY-MM-DD)
 *
 * @param date - Date to format (defaults to now)
 * @returns Date string in YYYY-MM-DD format
 */
export function getDateString(date: Date = new Date()): string {
	return date.toISOString().split("T")[0];
}

/**
 * Calculate the depth of a tree
 *
 * @param node - Root node
 * @param currentDepth - Current depth (for recursion)
 * @returns Maximum depth of the tree
 */
export function calculateTreeDepth(node: TreeNode, currentDepth = 0): number {
	let maxDepth = currentDepth;

	for (const child of node.children ?? []) {
		const childDepth = calculateTreeDepth(child, currentDepth + 1);
		maxDepth = Math.max(maxDepth, childDepth);
	}

	return maxDepth;
}

/**
 * Flatten a tree into an array of nodes with depth information
 *
 * @param node - Root node
 * @param depth - Current depth
 * @returns Array of nodes with their depths
 */
export function flattenTree(
	node: TreeNode,
	depth = 0
): Array<{ node: TreeNode; depth: number }> {
	const result: Array<{ node: TreeNode; depth: number }> = [{ node, depth }];

	for (const child of node.children ?? []) {
		result.push(...flattenTree(child, depth + 1));
	}

	return result;
}
