/**
 * Builds a nested tree structure from flat elements for export.
 *
 * Takes elements from the database (with their evidence links) and builds
 * a hierarchical tree where evidence appears inline under claims.
 */

import type {
	AssertionStatus,
	ElementRole,
	ElementType,
	ExportComment,
	ModuleEmbedType,
	TreeNode,
} from "../schemas/case-export";
import type { ContextEntry } from "../schemas/context-entry";
import { fieldAppliesTo } from "../schemas/element-validation";

/**
 * Element with evidence links as returned from Prisma query.
 */
export interface ElementWithLinks {
	// ADR 0004 D3 — null means unset; buildCleanNode resolves it to
	// "ASSERTED" (SACM's own default) rather than omitting the field, unlike
	// every other field below.
	assertionStatus: AssertionStatus | null;
	assumption: string | null;
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only
	citedElementId: string | null;
	// Comments (optional - only included when export includes comments)
	comments?: ExportComment[];
	context: ContextEntry[];
	defeatsElementId: string | null;
	description: string;
	elementType: ElementType;
	// Evidence linked TO this element (this element is a claim)
	evidenceLinksTo?: Array<{
		evidence: ElementWithLinks;
	}>;
	// Pattern metadata
	fromPattern: boolean;
	id: string;
	inSandbox: boolean;
	// Dialogical reasoning
	isDefeater: boolean;
	justification: string | null;
	level: number | null;
	modifiedFromPattern: boolean;
	moduleEmbedType: ModuleEmbedType | null;
	modulePublicSummary: string | null;
	// Module fields
	moduleReferenceId: string | null;
	name: string | null;
	parentId: string | null;
	// Type-specific fields
	role: ElementRole | null;
	url: string | null;
}

/**
 * Type-specific fields that require applicability check.
 * These fields are only included when applicable to the element type AND non-null.
 */
const TYPE_SPECIFIC_FIELDS = [
	"role",
	"assumption",
	"justification",
	"context",
	"url",
	"level",
	"moduleReferenceId",
	"moduleEmbedType",
	"modulePublicSummary",
	"citedElementId",
] as const;

/**
 * Type for keys that can be dynamically assigned to TreeNode
 */
type TypeSpecificFieldKey = (typeof TYPE_SPECIFIC_FIELDS)[number];

/**
 * Writable version of TreeNode for dynamic field assignment
 */
type TreeNodeWritable = Record<TypeSpecificFieldKey, unknown>;

/**
 * Adds type-specific fields to the node if applicable and non-null/non-empty.
 */
function addTypeSpecificFields(
	node: TreeNode,
	element: ElementWithLinks,
	elementType: ElementType
): void {
	for (const field of TYPE_SPECIFIC_FIELDS) {
		const value = element[field];
		if (!fieldAppliesTo(field, elementType)) {
			continue;
		}
		// For array fields, only include if non-empty
		if (Array.isArray(value)) {
			if (value.length > 0) {
				(node as TreeNodeWritable)[field] = value;
			}
		} else if (value != null) {
			(node as TreeNodeWritable)[field] = value;
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
 * Children are added last for better readability in JSON exports.
 */
function buildCleanNode(
	element: ElementWithLinks,
	children: TreeNode[]
): TreeNode {
	const elementType = element.elementType;

	// Build node WITHOUT children first (to control key ordering)
	const nodeWithoutChildren: Omit<TreeNode, "children"> & {
		children?: TreeNode[];
	} = {
		id: element.id,
		type: elementType,
		name: element.name,
		description: element.description,
		inSandbox: element.inSandbox,
		// ADR 0004 D3: always present on export, never omitted — null/unset
		// resolves to the SACM default rather than disappearing like the
		// TYPE_SPECIFIC_FIELDS below.
		assertionStatus: element.assertionStatus ?? "ASSERTED",
	};

	// Cast to allow dynamic field assignment
	const node = nodeWithoutChildren as TreeNode;

	addTypeSpecificFields(node, element, elementType);
	addMetadataFields(node, element);

	// Add comments if present
	if (element.comments && element.comments.length > 0) {
		node.comments = element.comments;
	}

	// Add children LAST for better readability in JSON exports
	node.children = children;

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
		const firstAnyRoot = anyRoots[0];
		if (!firstAnyRoot) {
			throw new Error("No root element found (element with parentId = null)");
		}
		return buildNode(firstAnyRoot, childrenMap);
	}

	// A case has one ordinary root goal. A goal defeater with no parent (stored
	// before such goals were refused) never stands in for it, whatever order
	// the rows come back in.
	const firstRoot = roots.find((root) => !root.isDefeater) ?? roots[0];
	if (!firstRoot) {
		throw new Error("No root element found");
	}
	return buildNode(firstRoot, childrenMap);
}

/**
 * Whether a child is drawn beneath its parent. Beneath a piece of evidence
 * only goal defeaters (counter-goals) are, as on the diagram; everything else
 * hangs from a claim, strategy or goal.
 */
function isBuiltBeneath(
	parent: ElementWithLinks,
	child: ElementWithLinks
): boolean {
	return (
		parent.elementType !== "EVIDENCE" ||
		(child.elementType === "GOAL" && child.isDefeater)
	);
}

/**
 * Recursively builds a tree node from an element.
 */
function buildNode(
	element: ElementWithLinks,
	childrenMap: Map<string | null, ElementWithLinks[]>,
	ancestors: ReadonlySet<string> = new Set()
): TreeNode {
	if (ancestors.has(element.id)) {
		return buildCleanNode(element, []);
	}
	const nextAncestors = new Set(ancestors);
	nextAncestors.add(element.id);
	// Get direct children (via parentId relationship)
	const directChildren = (childrenMap.get(element.id) ?? []).filter((child) =>
		isBuiltBeneath(element, child)
	);

	// Get evidence linked to this element (if it's a claim)
	const linkedEvidence =
		element.evidenceLinksTo?.map((link) =>
			buildNode(link.evidence, childrenMap, nextAncestors)
		) ?? [];

	// Build children nodes recursively
	const childNodes = directChildren.map((child) =>
		buildNode(child, childrenMap, nextAncestors)
	);

	return buildCleanNode(element, [...childNodes, ...linkedEvidence]);
}
