/**
 * Tree Diff
 *
 * Computes differences between two assurance case tree structures.
 * Used by the JSON editor to determine what API calls are needed
 * to synchronise the edited JSON back to the database.
 *
 * IMPORTANT: Evidence elements use EvidenceLink (many-to-many) relationships
 * with claims, not parentId. This service tracks evidence links separately
 * and generates link/unlink changes for evidence moves.
 */

import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";

/**
 * Element data for creating a new element
 */
export interface CreateElementData {
	assumption?: string | null;
	context?: string[];
	defeatsElementId?: string;
	description: string;
	fromPattern?: boolean;
	id: string;
	inSandbox: boolean;
	isDefeater?: boolean;
	justification?: string | null;
	level?: number | null;
	modifiedFromPattern?: boolean;
	moduleEmbedType?: string;
	modulePublicSummary?: string | null;
	moduleReferenceId?: string;
	name: string | null;
	role?: string | null;
	type: string;
	url?: string | null;
}

/**
 * Element data for updating an existing element
 */
export interface UpdateElementData {
	assumption?: string | null;
	context?: string[];
	defeatsElementId?: string;
	description?: string;
	fromPattern?: boolean;
	inSandbox?: boolean;
	isDefeater?: boolean;
	justification?: string | null;
	level?: number | null;
	modifiedFromPattern?: boolean;
	moduleEmbedType?: string;
	modulePublicSummary?: string | null;
	moduleReferenceId?: string;
	name?: string | null;
	parentId?: string | null;
	role?: string | null;
	url?: string | null;
}

/**
 * A change operation to be applied to the database
 */
export type ElementChange =
	| {
			type: "create";
			elementId: string;
			data: CreateElementData;
			parentId: string | null;
	  }
	| { type: "update"; elementId: string; data: UpdateElementData }
	| { type: "delete"; elementId: string }
	| { type: "link_evidence"; evidenceId: string; claimId: string }
	| { type: "unlink_evidence"; evidenceId: string; claimId: string };

/**
 * Flat representation of a tree node for comparison
 */
interface FlatElement {
	assumption?: string | null;
	context?: string[];
	defeatsElementId?: string;
	description: string;
	fromPattern?: boolean;
	id: string;
	inSandbox: boolean;
	isDefeater?: boolean;
	justification?: string | null;
	level?: number | null;
	modifiedFromPattern?: boolean;
	moduleEmbedType?: string;
	modulePublicSummary?: string | null;
	moduleReferenceId?: string;
	name: string | null;
	parentId: string | null;
	role?: string | null;
	type: string;
	url?: string | null;
}

/**
 * Represents an evidence-to-claim link relationship.
 * Evidence uses EvidenceLink (many-to-many), not parentId.
 */
interface EvidenceLinkRecord {
	claimId: string;
	evidenceId: string;
}

/**
 * Result of flattening a tree - includes both elements and evidence links
 */
interface FlattenResult {
	elements: Map<string, FlatElement>;
	evidenceLinks: EvidenceLinkRecord[];
}

/**
 * Result of computing a tree diff
 */
export interface TreeDiffResult {
	changes: ElementChange[];
	summary: {
		created: number;
		updated: number;
		deleted: number;
		moved: number;
	};
}

/**
 * Element types that can have evidence linked to them
 */
const CLAIM_TYPES = new Set(["PROPERTY_CLAIM", "GOAL"]);

/**
 * Checks if an element type is EVIDENCE
 */
function isEvidenceType(type: string): boolean {
	return type === "EVIDENCE";
}

/**
 * Checks if an element type can have evidence linked to it
 */
function isClaimType(type: string): boolean {
	return CLAIM_TYPES.has(type);
}

/**
 * Creates a flat element from a tree node
 */
function createFlatElement(
	node: TreeNode,
	parentId: string | null
): FlatElement {
	return {
		id: node.id,
		type: node.type,
		name: node.name,
		description: node.description,
		inSandbox: node.inSandbox,
		parentId,
		role: node.role,
		assumption: node.assumption,
		justification: node.justification,
		context: node.context,
		url: node.url,
		level: node.level,
		moduleReferenceId: node.moduleReferenceId,
		moduleEmbedType: node.moduleEmbedType,
		modulePublicSummary: node.modulePublicSummary,
		fromPattern: node.fromPattern,
		modifiedFromPattern: node.modifiedFromPattern,
		isDefeater: node.isDefeater,
		defeatsElementId: node.defeatsElementId,
	};
}

/**
 * Flattens a tree structure into elements and evidence links.
 * Evidence children under claims are tracked as evidence links, not parent relationships.
 */
function flattenTreeWithLinks(
	node: TreeNode,
	parentId: string | null,
	result: FlattenResult
): void {
	// Add this node to the elements map
	// For evidence, parentId should be null (evidence uses links, not parent)
	const effectiveParentId = isEvidenceType(node.type) ? null : parentId;
	const flatElement = createFlatElement(node, effectiveParentId);
	result.elements.set(node.id, flatElement);

	// Process children
	for (const child of node.children) {
		if (isEvidenceType(child.type) && isClaimType(node.type)) {
			// This is evidence under a claim - track as evidence link
			result.evidenceLinks.push({
				evidenceId: child.id,
				claimId: node.id,
			});
			// Still need to add the evidence element itself (with null parentId)
			flattenTreeWithLinks(child, null, result);
		} else {
			// Regular parent-child relationship
			flattenTreeWithLinks(child, node.id, result);
		}
	}
}

/**
 * Flattens an entire case export into elements and evidence links
 */
function flattenCaseExportWithLinks(
	caseExport: CaseExportNested
): FlattenResult {
	const result: FlattenResult = {
		elements: new Map(),
		evidenceLinks: [],
	};
	flattenTreeWithLinks(caseExport.tree, null, result);
	return result;
}

/**
 * Legacy flatten function for backward compatibility
 */
function flattenCaseExport(
	caseExport: CaseExportNested
): Map<string, FlatElement> {
	return flattenCaseExportWithLinks(caseExport).elements;
}

/**
 * Compares two arrays for equality (shallow comparison)
 */
function arraysEqual(
	a: unknown[] | undefined,
	b: unknown[] | undefined
): boolean {
	if (a === b) {
		return true;
	}
	if (!(a || b)) {
		return true;
	}
	if (!(a && b)) {
		return false;
	}
	if (a.length !== b.length) {
		return false;
	}
	return a.every((val, i) => val === b[i]);
}

/**
 * List of scalar fields to compare between elements.
 * Note: parentId is only compared for non-evidence elements.
 */
const SCALAR_FIELDS = [
	"name",
	"description",
	"inSandbox",
	"role",
	"assumption",
	"justification",
	"url",
	"level",
	"moduleReferenceId",
	"moduleEmbedType",
	"modulePublicSummary",
	"fromPattern",
	"modifiedFromPattern",
	"isDefeater",
	"defeatsElementId",
] as const;

/**
 * Computes the field-level changes between two elements.
 * Returns undefined if there are no changes.
 */
function computeElementChanges(
	current: FlatElement,
	edited: FlatElement
): UpdateElementData | undefined {
	const changes: UpdateElementData = {};
	let hasChanges = false;

	// Compare scalar fields using data-driven approach
	for (const field of SCALAR_FIELDS) {
		if (current[field] !== edited[field]) {
			(changes as Record<string, unknown>)[field] = edited[field];
			hasChanges = true;
		}
	}

	// Only compare parentId for non-evidence elements
	// Evidence uses EvidenceLink, not parentId
	if (!isEvidenceType(current.type) && current.parentId !== edited.parentId) {
		changes.parentId = edited.parentId;
		hasChanges = true;
	}

	// Compare context array separately
	if (!arraysEqual(current.context, edited.context)) {
		changes.context = edited.context;
		hasChanges = true;
	}

	return hasChanges ? changes : undefined;
}

/**
 * Converts a flat element to create element data
 */
function toCreateElementData(element: FlatElement): CreateElementData {
	return {
		id: element.id,
		type: element.type,
		name: element.name,
		description: element.description,
		inSandbox: element.inSandbox,
		role: element.role,
		assumption: element.assumption,
		justification: element.justification,
		context: element.context,
		url: element.url,
		level: element.level,
		moduleReferenceId: element.moduleReferenceId,
		moduleEmbedType: element.moduleEmbedType,
		modulePublicSummary: element.modulePublicSummary,
		fromPattern: element.fromPattern,
		modifiedFromPattern: element.modifiedFromPattern,
		isDefeater: element.isDefeater,
		defeatsElementId: element.defeatsElementId,
	};
}

/**
 * Creates a unique key for an evidence link
 */
function evidenceLinkKey(link: EvidenceLinkRecord): string {
	return `${link.evidenceId}:${link.claimId}`;
}

/**
 * Computes evidence link changes between current and edited states
 */
function computeEvidenceLinkChanges(
	currentLinks: EvidenceLinkRecord[],
	editedLinks: EvidenceLinkRecord[]
): ElementChange[] {
	const changes: ElementChange[] = [];

	const currentSet = new Set(currentLinks.map(evidenceLinkKey));
	const editedSet = new Set(editedLinks.map(evidenceLinkKey));

	// Find links to remove (in current but not in edited)
	for (const link of currentLinks) {
		if (!editedSet.has(evidenceLinkKey(link))) {
			changes.push({
				type: "unlink_evidence",
				evidenceId: link.evidenceId,
				claimId: link.claimId,
			});
		}
	}

	// Find links to add (in edited but not in current)
	for (const link of editedLinks) {
		if (!currentSet.has(evidenceLinkKey(link))) {
			changes.push({
				type: "link_evidence",
				evidenceId: link.evidenceId,
				claimId: link.claimId,
			});
		}
	}

	return changes;
}

/**
 * Finds deleted elements (in current but not in edited)
 */
function findDeletedElements(
	currentMap: Map<string, FlatElement>,
	editedMap: Map<string, FlatElement>
): ElementChange[] {
	const changes: ElementChange[] = [];
	for (const [id] of currentMap) {
		if (!editedMap.has(id)) {
			changes.push({ type: "delete", elementId: id });
		}
	}
	return changes;
}

/**
 * Processes a single element to determine if it's created or modified
 */
function processElementChange(
	id: string,
	editedElement: FlatElement,
	currentElement: FlatElement | undefined
): { change: ElementChange; isMoveOnly: boolean } | null {
	if (currentElement) {
		const fieldChanges = computeElementChanges(currentElement, editedElement);
		if (!fieldChanges) {
			return null;
		}
		const isMoveOnly =
			fieldChanges.parentId !== undefined &&
			Object.keys(fieldChanges).length === 1;
		return {
			change: { type: "update", elementId: id, data: fieldChanges },
			isMoveOnly,
		};
	}

	// New element - for evidence, parentId should be null
	const parentId = isEvidenceType(editedElement.type)
		? null
		: editedElement.parentId;
	return {
		change: {
			type: "create",
			elementId: id,
			data: toCreateElementData(editedElement),
			parentId,
		},
		isMoveOnly: false,
	};
}

/**
 * Computes the diff between two case exports.
 *
 * @param currentExport - The current state from the server
 * @param editedExport - The edited state from the JSON editor
 * @returns Array of changes to apply and a summary
 */
export function computeTreeDiff(
	currentExport: CaseExportNested,
	editedExport: CaseExportNested
): TreeDiffResult {
	const currentResult = flattenCaseExportWithLinks(currentExport);
	const editedResult = flattenCaseExportWithLinks(editedExport);

	const currentMap = currentResult.elements;
	const editedMap = editedResult.elements;

	const changes: ElementChange[] = [];
	let movedCount = 0;

	// Find deleted elements
	changes.push(...findDeletedElements(currentMap, editedMap));

	// Find created and modified elements
	for (const [id, editedElement] of editedMap) {
		const result = processElementChange(id, editedElement, currentMap.get(id));
		if (result) {
			changes.push(result.change);
			if (result.isMoveOnly) {
				movedCount++;
			}
		}
	}

	// Compute evidence link changes
	changes.push(
		...computeEvidenceLinkChanges(
			currentResult.evidenceLinks,
			editedResult.evidenceLinks
		)
	);

	return {
		changes,
		summary: {
			created: changes.filter((c) => c.type === "create").length,
			updated: changes.filter((c) => c.type === "update").length - movedCount,
			deleted: changes.filter((c) => c.type === "delete").length,
			moved: movedCount,
		},
	};
}

/**
 * Orders changes for safe application:
 * 1. Unlink evidence (before deletes to avoid FK issues)
 * 2. Deletes (bottom-up to avoid orphan issues)
 * 3. Creates (top-down for parent availability)
 * 4. Updates
 * 5. Link evidence (after creates so elements exist)
 *
 * @param changes - Unordered changes
 * @param editedExport - The edited export (for parent ordering)
 * @returns Ordered changes safe for sequential application
 */
export function orderChangesForApplication(
	changes: ElementChange[],
	editedExport: CaseExportNested
): ElementChange[] {
	const unlinks = changes.filter((c) => c.type === "unlink_evidence");
	const deletes = changes.filter((c) => c.type === "delete");
	const creates = changes.filter((c) => c.type === "create");
	const updates = changes.filter((c) => c.type === "update");
	const links = changes.filter((c) => c.type === "link_evidence");

	// Build a depth map for ordering creates (parents first)
	const editedMap = flattenCaseExport(editedExport);
	const depthMap = new Map<string, number>();

	function getDepth(id: string): number {
		const cached = depthMap.get(id);
		if (cached !== undefined) {
			return cached;
		}
		const element = editedMap.get(id);
		if (!element?.parentId) {
			depthMap.set(id, 0);
			return 0;
		}
		const parentDepth = getDepth(element.parentId);
		const depth = parentDepth + 1;
		depthMap.set(id, depth);
		return depth;
	}

	// Calculate depths for all created elements
	for (const change of creates) {
		getDepth(change.elementId);
	}

	// Sort creates by depth (parents first)
	const orderedCreates = [...creates].sort((a, b) => {
		const depthA = depthMap.get(a.elementId) ?? 0;
		const depthB = depthMap.get(b.elementId) ?? 0;
		return depthA - depthB;
	});

	// Sort deletes by depth (children first, reverse order)
	const orderedDeletes = [...deletes].reverse();

	return [
		...unlinks,
		...orderedDeletes,
		...orderedCreates,
		...updates,
		...links,
	];
}

/**
 * Validates root element count (excluding evidence)
 */
function validateRootElements(editedMap: Map<string, FlatElement>): string[] {
	const rootElements = [...editedMap.values()].filter(
		(e) => e.parentId === null && !isEvidenceType(e.type)
	);

	if (rootElements.length === 0) {
		return ["Tree must have a root element"];
	}
	if (rootElements.length > 1) {
		return [`Tree has ${rootElements.length} root elements, expected 1`];
	}
	return [];
}

/**
 * Validates parent references exist for non-evidence elements
 */
function validateParentReferences(
	editedMap: Map<string, FlatElement>
): string[] {
	const errors: string[] = [];
	for (const [id, element] of editedMap) {
		if (isEvidenceType(element.type)) {
			continue;
		}
		if (element.parentId && !editedMap.has(element.parentId)) {
			errors.push(
				`Element "${element.name || id}" references non-existent parent`
			);
		}
	}
	return errors;
}

/**
 * Detects circular reference for a single element
 */
function detectCircularReference(
	id: string,
	editedMap: Map<string, FlatElement>
): string | null {
	const visited = new Set<string>();
	let currentId: string | null = id;

	while (currentId) {
		if (visited.has(currentId)) {
			return `Circular reference detected involving element "${id}"`;
		}
		visited.add(currentId);
		const current = editedMap.get(currentId);
		currentId = current?.parentId ?? null;
	}
	return null;
}

/**
 * Validates no circular references exist in non-evidence elements
 */
function validateNoCircularReferences(
	editedMap: Map<string, FlatElement>
): string[] {
	const errors: string[] = [];
	for (const [id, element] of editedMap) {
		if (isEvidenceType(element.type)) {
			continue;
		}
		const error = detectCircularReference(id, editedMap);
		if (error) {
			errors.push(error);
		}
	}
	return errors;
}

/**
 * Validates that the edited JSON would produce a valid tree structure.
 *
 * Checks for:
 * - Exactly one root element (parentId === null, excluding evidence)
 * - No circular references
 * - All parent references point to existing elements
 *
 * @param editedExport - The edited export to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateTreeStructure(
	editedExport: CaseExportNested
): string[] {
	const { elements: editedMap } = flattenCaseExportWithLinks(editedExport);

	return [
		...validateRootElements(editedMap),
		...validateParentReferences(editedMap),
		...validateNoCircularReferences(editedMap),
	];
}
