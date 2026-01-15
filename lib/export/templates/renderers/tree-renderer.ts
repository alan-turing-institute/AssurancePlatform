/**
 * Tree renderer utilities for converting TreeNode structures to content blocks.
 *
 * These functions transform the hierarchical case data into format-agnostic
 * content blocks that can be consumed by any exporter.
 */

import type { ElementType, TreeNode } from "@/lib/schemas/case-export";
import type { ContentBlock } from "../../types";
import { ELEMENT_TYPE_LABELS } from "../../types";

/**
 * Options for rendering tree elements
 */
export type TreeRenderOptions = {
	includeSandbox?: boolean;
	maxDepth?: number;
	includeTypes?: ElementType[];
	excludeTypes?: ElementType[];
};

/**
 * Rendered element with metadata
 */
export type RenderedElement = {
	node: TreeNode;
	depth: number;
	blocks: ContentBlock[];
};

/**
 * Check if an element should be included based on options
 */
export function shouldIncludeElement(
	node: TreeNode,
	depth: number,
	options: TreeRenderOptions
): boolean {
	// Check sandbox filter
	if (!options.includeSandbox && node.inSandbox) {
		return false;
	}

	// Check depth filter
	if (options.maxDepth !== undefined && depth > options.maxDepth) {
		return false;
	}

	// Check type filters
	if (options.includeTypes && !options.includeTypes.includes(node.type)) {
		return false;
	}

	if (options.excludeTypes?.includes(node.type)) {
		return false;
	}

	return true;
}

/**
 * Render a single element as content blocks
 *
 * Creates blocks for:
 * - Element heading (type + name)
 * - Description
 * - Type-specific fields (assumption, justification, context, url)
 */
export function renderElementAsBlocks(
	node: TreeNode,
	depth: number
): ContentBlock[] {
	const blocks: ContentBlock[] = [];
	const headingLevel = Math.min(depth + 2, 6) as 1 | 2 | 3 | 4 | 5 | 6;

	// Element heading with type and name
	const typeLabel = ELEMENT_TYPE_LABELS[node.type] ?? node.type;
	const elementTitle = node.name ? `${typeLabel}: ${node.name}` : typeLabel;
	blocks.push({ type: "heading", level: headingLevel, text: elementTitle });

	// Description
	if (node.description) {
		blocks.push({ type: "paragraph", text: node.description });
	}

	// Type-specific fields
	if (node.assumption) {
		blocks.push({
			type: "metadata",
			key: "Assumption",
			value: node.assumption,
		});
	}

	if (node.justification) {
		blocks.push({
			type: "metadata",
			key: "Justification",
			value: node.justification,
		});
	}

	if (node.context && node.context.length > 0) {
		blocks.push({
			type: "metadata",
			key: "Context",
			value: node.context.join(", "),
		});
	}

	if (node.url) {
		blocks.push({
			type: "metadata",
			key: "URL",
			value: node.url,
		});
	}

	// Module reference
	if (node.moduleReferenceId) {
		blocks.push({
			type: "metadata",
			key: "Module Reference",
			value: node.moduleReferenceId,
		});
		if (node.modulePublicSummary) {
			blocks.push({
				type: "metadata",
				key: "Module Summary",
				value: node.modulePublicSummary,
			});
		}
	}

	// Defeater info
	if (node.isDefeater) {
		blocks.push({
			type: "metadata",
			key: "Defeater",
			value: node.defeatsElementId
				? `Defeats: ${node.defeatsElementId}`
				: "Yes",
		});
	}

	return blocks;
}

/**
 * Recursively render tree nodes as a flat list of content blocks
 *
 * Traverses the tree depth-first, rendering each element in document order.
 */
export function renderTreeAsBlocks(
	node: TreeNode,
	depth: number,
	options: TreeRenderOptions = {}
): ContentBlock[] {
	const blocks: ContentBlock[] = [];

	if (shouldIncludeElement(node, depth, options)) {
		blocks.push(...renderElementAsBlocks(node, depth));
	}

	// Process children
	for (const child of node.children ?? []) {
		blocks.push(...renderTreeAsBlocks(child, depth + 1, options));
	}

	return blocks;
}

/**
 * Collect all elements of a specific type from tree
 */
export function collectElementsByType(
	node: TreeNode,
	type: ElementType,
	depth = 0,
	options: TreeRenderOptions = {}
): RenderedElement[] {
	const results: RenderedElement[] = [];

	if (node.type === type && shouldIncludeElement(node, depth, options)) {
		results.push({
			node,
			depth,
			blocks: renderElementAsBlocks(node, depth),
		});
	}

	for (const child of node.children ?? []) {
		results.push(...collectElementsByType(child, type, depth + 1, options));
	}

	return results;
}

/**
 * Collect all comments from tree with element context
 */
export function collectAllComments(
	node: TreeNode,
	depth = 0,
	options: TreeRenderOptions = {}
): Array<{
	elementId: string;
	elementName: string | null;
	elementType: ElementType;
	comments: NonNullable<TreeNode["comments"]>;
}> {
	const results: Array<{
		elementId: string;
		elementName: string | null;
		elementType: ElementType;
		comments: NonNullable<TreeNode["comments"]>;
	}> = [];

	if (
		node.comments &&
		node.comments.length > 0 &&
		shouldIncludeElement(node, depth, options)
	) {
		results.push({
			elementId: node.id,
			elementName: node.name,
			elementType: node.type,
			comments: node.comments,
		});
	}

	for (const child of node.children ?? []) {
		results.push(...collectAllComments(child, depth + 1, options));
	}

	return results;
}

/**
 * Count elements by type in tree
 */
export function countElementsByType(
	node: TreeNode,
	options: TreeRenderOptions = {}
): Record<ElementType, number> {
	const counts: Record<string, number> = {
		GOAL: 0,
		CONTEXT: 0,
		STRATEGY: 0,
		PROPERTY_CLAIM: 0,
		EVIDENCE: 0,
		JUSTIFICATION: 0,
		ASSUMPTION: 0,
		MODULE: 0,
		AWAY_GOAL: 0,
		CONTRACT: 0,
	};

	function traverse(n: TreeNode, d: number): void {
		if (shouldIncludeElement(n, d, options)) {
			counts[n.type] = (counts[n.type] ?? 0) + 1;
		}
		for (const child of n.children ?? []) {
			traverse(child, d + 1);
		}
	}

	traverse(node, 0);
	return counts as Record<ElementType, number>;
}

/**
 * Get total element count in tree
 */
export function getTotalElementCount(
	node: TreeNode,
	options: TreeRenderOptions = {}
): number {
	let count = 0;

	function traverse(n: TreeNode, d: number): void {
		if (shouldIncludeElement(n, d, options)) {
			count++;
		}
		for (const child of n.children ?? []) {
			traverse(child, d + 1);
		}
	}

	traverse(node, 0);
	return count;
}

/**
 * Get maximum depth of tree
 */
export function getTreeDepth(node: TreeNode): number {
	let maxDepth = 0;

	function traverse(n: TreeNode, d: number): void {
		maxDepth = Math.max(maxDepth, d);
		for (const child of n.children ?? []) {
			traverse(child, d + 1);
		}
	}

	traverse(node, 0);
	return maxDepth;
}
