/**
 * Builds a nested tree structure from flat elements for export.
 *
 * Takes elements from the database (with their evidence links) and builds
 * a hierarchical tree where evidence appears inline under claims.
 */

import { compareElementNames } from "../case/identifier-utils";
import { elementKindRank } from "../case/node-type-resolver";
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
	// Placeholder metadata; the hint is written only for a placeholder
	isPlaceholder?: boolean;
	justification: string | null;
	level: number | null;
	modifiedFromPattern: boolean;
	moduleEmbedType: ModuleEmbedType | null;
	modulePublicSummary: string | null;
	// Module fields
	moduleReferenceId: string | null;
	name: string | null;
	parentId: string | null;
	placeholderHint?: string | null;
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
 * Adds optional metadata fields (pattern, placeholder and dialogical
 * reasoning). A hint is written only with the placeholder it guides: the
 * hint stored on an element that has since been filled in is not exported.
 */
function addMetadataFields(node: TreeNode, element: ElementWithLinks): void {
	if (element.fromPattern) {
		node.fromPattern = element.fromPattern;
	}
	if (element.modifiedFromPattern) {
		node.modifiedFromPattern = element.modifiedFromPattern;
	}
	if (element.isPlaceholder) {
		node.isPlaceholder = true;
		if (element.placeholderHint) {
			node.placeholderHint = element.placeholderHint;
		}
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
 * The order the diagram shows siblings in, and so the order they are written
 * in: by kind (strategies and claims, then evidence, then away goals and
 * modules), then by name in natural numeric order, then by id. The id settles
 * the order of elements with equal or missing names, so the same elements are
 * written the same way whatever order the rows arrive in.
 */
function compareSiblings(a: ElementWithLinks, b: ElementWithLinks): number {
	const byKind =
		elementKindRank(a.elementType) - elementKindRank(b.elementType);
	if (byKind !== 0) {
		return byKind;
	}
	const byName = compareElementNames(a.name, b.name);
	if (byName !== 0) {
		return byName;
	}
	if (a.id === b.id) {
		return 0;
	}
	return a.id < b.id ? -1 : 1;
}

/**
 * Builds a nested tree from flat elements. Siblings are written in the
 * diagram's order (see `compareSiblings`), not the order of the rows.
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

	// Find root element (GOAL with no parent), choosing among the candidates
	// in sibling order so the choice does not depend on the order of the rows
	const anyRoots = [...(childrenMap.get(null) ?? [])].sort(compareSiblings);
	const roots = anyRoots.filter((el) => el.elementType === "GOAL");
	if (roots.length === 0) {
		// Fallback: find any element with no parent
		const firstAnyRoot = anyRoots[0];
		if (!firstAnyRoot) {
			throw new Error("No root element found (element with parentId = null)");
		}
		return buildNode(firstAnyRoot, childrenMap, new Set());
	}

	// A case has one ordinary root goal. A goal defeater with no parent (stored
	// before such goals were refused) never stands in for it, whatever order
	// the rows come back in.
	const firstRoot = roots.find((root) => !root.isDefeater) ?? roots[0];
	if (!firstRoot) {
		throw new Error("No root element found");
	}
	return buildNode(firstRoot, childrenMap, new Set());
}

/**
 * Whether an element is a goal defeater (counter-goal), the only kind of
 * element that hangs from a piece of evidence.
 */
export function isGoalDefeater(
	elementType: string,
	isDefeater: boolean | undefined
): boolean {
	return elementType === "GOAL" && isDefeater === true;
}

/**
 * The warning for an element left out of an import because it hangs from a
 * piece of evidence and is not a counter-goal.
 */
export function leftOutBeneathEvidenceWarning(
	name: string | null | undefined
): string {
	return `${name ?? "element"}: only counter-goals can hang from evidence; the element has been left out`;
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
		isGoalDefeater(child.elementType, child.isDefeater)
	);
}

/**
 * Whether an earlier copy of this piece of evidence has already been built.
 * Evidence appears under every claim that links it, but what hangs from it is
 * built with the first copy only; later copies are leaves. Repeating it with
 * each copy would double the size of the tree at every level of shared
 * evidence. Records the element as built when it is evidence met for the
 * first time.
 */
function isLaterCopyOfEvidence(
	element: ElementWithLinks,
	builtEvidence: Set<string>
): boolean {
	if (element.elementType !== "EVIDENCE") {
		return false;
	}
	if (builtEvidence.has(element.id)) {
		return true;
	}
	builtEvidence.add(element.id);
	return false;
}

/**
 * Recursively builds a tree node from an element. The children are built in
 * the order they are written, so the first copy of a piece of evidence met
 * walking the finished tree is the one that carries what hangs from it.
 */
function buildNode(
	element: ElementWithLinks,
	childrenMap: Map<string | null, ElementWithLinks[]>,
	builtEvidence: Set<string>,
	ancestors: ReadonlySet<string> = new Set()
): TreeNode {
	if (
		ancestors.has(element.id) ||
		isLaterCopyOfEvidence(element, builtEvidence)
	) {
		return buildCleanNode(element, []);
	}
	const nextAncestors = new Set(ancestors);
	nextAncestors.add(element.id);
	// Direct children (via parentId) and linked evidence (if this is a claim),
	// together in sibling order
	const children = [
		...(childrenMap.get(element.id) ?? []).filter((child) =>
			isBuiltBeneath(element, child)
		),
		...(element.evidenceLinksTo ?? []).map((link) => link.evidence),
	].sort(compareSiblings);

	// Build children nodes recursively
	const childNodes = children.map((child) =>
		buildNode(child, childrenMap, builtEvidence, nextAncestors)
	);

	return buildCleanNode(element, childNodes);
}
