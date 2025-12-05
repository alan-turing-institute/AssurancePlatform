/**
 * Transforms nested (tree) format to flat (elements array) format for import.
 *
 * Key transformations:
 * 1. Flattens nested tree into flat elements array with parentId references
 * 2. Deduplicates evidence that appears under multiple claims (by name+url)
 * 3. Creates evidence links for the many-to-many relationship
 */

import type {
	CaseExportNested,
	CaseExportV2,
	ElementV2,
	EvidenceLinkV2,
	TreeNode,
} from "../schemas/case-export";

/**
 * Context object for flattening operations.
 * Groups accumulators to reduce function parameter count.
 */
type FlattenContext = {
	elements: ElementV2[];
	evidenceLinks: EvidenceLinkV2[];
	evidenceMap: Map<string, string>;
};

/**
 * Flattens a nested tree export to flat format.
 *
 * Evidence deduplication:
 * - Evidence nodes with identical name+url are merged into one element
 * - Multiple EvidenceLink records are created for multi-linked evidence
 *
 * @param nestedCase - The nested export to flatten
 * @returns Flat format with elements and evidenceLinks arrays
 */
export function flattenNestedToFlat(
	nestedCase: CaseExportNested
): CaseExportV2 {
	const ctx: FlattenContext = {
		elements: [],
		evidenceLinks: [],
		evidenceMap: new Map<string, string>(),
	};

	// Recursively flatten the tree
	flattenNode(nestedCase.tree, null, ctx);

	return {
		version: "2.0",
		exportedAt: nestedCase.exportedAt,
		case: nestedCase.case,
		elements: ctx.elements,
		evidenceLinks: ctx.evidenceLinks,
	};
}

/**
 * Creates a deduplication key for evidence.
 * Uses name + url to identify duplicate evidence.
 */
function getEvidenceDedupKey(node: TreeNode): string {
	return `${node.name ?? ""}|${node.url ?? ""}`;
}

/**
 * Converts a tree node to a flat element.
 */
function nodeToElement(node: TreeNode, parentId: string | null): ElementV2 {
	const element: ElementV2 = {
		id: node.id,
		elementType: node.type,
		role: node.role,
		parentId,
		name: node.name,
		description: node.description,
		assumption: node.assumption,
		justification: node.justification,
		url: node.url,
		level: node.level,
		inSandbox: node.inSandbox,
		fromPattern: node.fromPattern,
		modifiedFromPattern: node.modifiedFromPattern,
	};

	// Preserve comments if present
	if (node.comments && node.comments.length > 0) {
		element.comments = node.comments;
	}

	return element;
}

/**
 * Recursively flattens a tree node into elements and evidence links.
 *
 * @param node - Current tree node to process
 * @param parentId - ID of the parent element (null for root)
 * @param ctx - Context object containing accumulators
 */
function flattenNode(
	node: TreeNode,
	parentId: string | null,
	ctx: FlattenContext
): void {
	if (node.type === "EVIDENCE") {
		// Handle evidence specially - deduplicate and create links
		const dedupKey = getEvidenceDedupKey(node);
		let evidenceId = ctx.evidenceMap.get(dedupKey);

		if (!evidenceId) {
			// First occurrence - add to elements
			evidenceId = node.id;
			ctx.evidenceMap.set(dedupKey, evidenceId);
			// Evidence has no parent in the flat structure (linked via EvidenceLink)
			ctx.elements.push(nodeToElement(node, null));
		}

		// Create link from evidence to parent claim (if parent exists)
		if (parentId) {
			ctx.evidenceLinks.push({
				evidenceId,
				claimId: parentId,
			});
		}
		return;
	}

	// Add non-evidence element with parentId
	ctx.elements.push(nodeToElement(node, parentId));

	// Process children recursively
	for (const child of node.children) {
		flattenNode(child, node.id, ctx);
	}
}
