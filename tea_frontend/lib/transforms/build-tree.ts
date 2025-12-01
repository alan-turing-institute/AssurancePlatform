/**
 * Builds a nested tree structure from flat elements for export.
 *
 * Takes elements from the database (with their evidence links) and builds
 * a hierarchical tree where evidence appears inline under claims.
 */

import type {
	ElementRole,
	ElementType,
	ExportComment,
	ModuleEmbedType,
	TreeNode,
} from "../schemas/case-export";
import { fieldAppliesTo } from "../schemas/element-validation";

/**
 * Element with evidence links as returned from Prisma query.
 */
export type ElementWithLinks = {
	id: string;
	elementType: ElementType;
	parentId: string | null;
	name: string | null;
	description: string;
	inSandbox: boolean;
	// Type-specific fields
	role: ElementRole | null;
	assumption: string | null;
	justification: string | null;
	url: string | null;
	level: number | null;
	// Module fields
	moduleReferenceId: string | null;
	moduleEmbedType: ModuleEmbedType | null;
	modulePublicSummary: string | null;
	// Pattern metadata
	fromPattern: boolean;
	modifiedFromPattern: boolean;
	// Dialogical reasoning
	isDefeater: boolean;
	defeatsElementId: string | null;
	// Evidence linked TO this element (this element is a claim)
	evidenceLinksTo?: Array<{
		evidence: ElementWithLinks;
	}>;
	// Comments (optional - only included when export includes comments)
	comments?: ExportComment[];
};

/**
 * Type-specific fields that require applicability check.
 * These fields are only included when applicable to the element type AND non-null.
 */
const TYPE_SPECIFIC_FIELDS = [
	"role",
	"assumption",
	"justification",
	"url",
	"level",
	"moduleReferenceId",
	"moduleEmbedType",
	"modulePublicSummary",
] as const;

/**
 * Adds type-specific fields to the node if applicable and non-null.
 */
function addTypeSpecificFields(
	node: TreeNode,
	element: ElementWithLinks,
	elementType: ElementType
): void {
	for (const field of TYPE_SPECIFIC_FIELDS) {
		const value = element[field];
		if (fieldAppliesTo(field, elementType) && value != null) {
			// biome-ignore lint/suspicious/noExplicitAny: Dynamic field assignment
			(node as any)[field] = value;
		}
	}
}

/**
 * Adds optional metadata fields (pattern and dialogical reasoning).
 */
function addMetadataFields(node: TreeNode, element: ElementWithLinks): void {
	if (element.fromPattern) {
		node.fromPattern = element.fromPattern;
	}
	if (element.modifiedFromPattern) {
		node.modifiedFromPattern = element.modifiedFromPattern;
	}
	if (element.isDefeater) {
		node.isDefeater = element.isDefeater;
	}
	if (element.defeatsElementId != null) {
		node.defeatsElementId = element.defeatsElementId;
	}
}

/**
 * Builds a clean TreeNode with only applicable fields for the element type.
 * Fields that don't apply to the element type are omitted entirely.
 */
function buildCleanNode(
	element: ElementWithLinks,
	children: TreeNode[]
): TreeNode {
	const elementType = element.elementType;

	// Required fields for all types
	const node: TreeNode = {
		id: element.id,
		type: elementType,
		name: element.name,
		description: element.description,
		inSandbox: element.inSandbox,
		children,
	};

	addTypeSpecificFields(node, element, elementType);
	addMetadataFields(node, element);

	// Add comments if present
	if (element.comments && element.comments.length > 0) {
		node.comments = element.comments;
	}

	return node;
}

/**
 * Builds a nested tree from flat elements.
 *
 * @param elements - Flat array of elements with evidence links
 * @returns Root tree node (the top-level GOAL)
 * @throws Error if no root goal is found
 */
export function buildTreeFromElements(elements: ElementWithLinks[]): TreeNode {
	if (elements.length === 0) {
		throw new Error("Cannot build tree from empty elements array");
	}

	// Build parent -> children map
	const childrenMap = new Map<string | null, ElementWithLinks[]>();
	for (const element of elements) {
		const parentId = element.parentId ?? null;
		const existing = childrenMap.get(parentId) ?? [];
		existing.push(element);
		childrenMap.set(parentId, existing);
	}

	// Find root element (GOAL with no parent)
	const roots =
		childrenMap.get(null)?.filter((el) => el.elementType === "GOAL") ?? [];
	if (roots.length === 0) {
		// Fallback: find any element with no parent
		const anyRoots = childrenMap.get(null) ?? [];
		if (anyRoots.length === 0) {
			throw new Error("No root element found (element with parentId = null)");
		}
		return buildNode(anyRoots[0], childrenMap);
	}

	// Use first root GOAL (cases typically have one)
	return buildNode(roots[0], childrenMap);
}

/**
 * Recursively builds a tree node from an element.
 */
function buildNode(
	element: ElementWithLinks,
	childrenMap: Map<string | null, ElementWithLinks[]>
): TreeNode {
	// Get direct children (via parentId relationship)
	const directChildren = childrenMap.get(element.id) ?? [];

	// Get evidence linked to this element (if it's a claim)
	const linkedEvidence =
		element.evidenceLinksTo?.map((link) => buildCleanNode(link.evidence, [])) ??
		[];

	// Build children nodes recursively
	const childNodes = directChildren.map((child) =>
		buildNode(child, childrenMap)
	);

	return buildCleanNode(element, [...childNodes, ...linkedEvidence]);
}
