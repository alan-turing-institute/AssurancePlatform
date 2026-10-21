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

import type {
	AssertionStatus,
	CaseExportNested,
	TreeNode,
} from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";

/**
 * Element data for creating a new element
 */
export interface CreateElementData {
	assertionStatus?: AssertionStatus | null;
	assumption?: string | null;
	context?: ContextEntry[];
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
	assertionStatus?: AssertionStatus | null;
	assumption?: string | null;
	context?: ContextEntry[];
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
	assertionStatus?: AssertionStatus | null;
	assumption?: string | null;
	context?: ContextEntry[];
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
	/**
	 * For each piece of evidence, the claims under which the tree shows what
	 * hangs from it (its counter-goals). The export shows that under one claim
	 * only; the evidence's other copies are leaves.
	 */
	expandedUnder: Map<string, Set<string>>;
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
		assertionStatus: node.assertionStatus,
	};
}

/**
 * Records that the tree shows what hangs from a piece of evidence under a claim.
 */
function noteExpansion(
	result: FlattenResult,
	evidenceId: string,
	claimId: string
): void {
	const claims = result.expandedUnder.get(evidenceId);
	if (claims) {
		claims.add(claimId);
	} else {
		result.expandedUnder.set(evidenceId, new Set([claimId]));
	}
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
			if (child.children.length > 0) {
				noteExpansion(result, child.id, node.id);
			}
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
		expandedUnder: new Map(),
	};
	flattenTreeWithLinks(caseExport.tree, null, result);
	return result;
}

/**
 * Carries what hangs from a piece of evidence into the edited state, unchanged:
 * everything beneath it by parent, and the evidence linked to claims in that
 * part with its own children.
 */
function carryOverBeneath(
	rootId: string,
	current: FlattenResult,
	edited: FlattenResult
): void {
	const childrenOf = groupByParent(current.elements.values());
	const seen = new Set([rootId]);
	const queue = [rootId];
	for (const id of queue) {
		const links = current.evidenceLinks.filter((link) => link.claimId === id);
		carryLinks(links, edited);
		const reached = [
			...(childrenOf.get(id) ?? []).map((element) => element.id),
			...links.map((link) => link.evidenceId),
		];
		for (const reachedId of reached) {
			const element = current.elements.get(reachedId);
			if (element && !seen.has(reachedId)) {
				seen.add(reachedId);
				queue.push(reachedId);
				if (!edited.elements.has(reachedId)) {
					edited.elements.set(reachedId, element);
				}
			}
		}
	}
}

/** The elements grouped by their parent. */
function groupByParent(
	elements: Iterable<FlatElement>
): Map<string, FlatElement[]> {
	const grouped = new Map<string, FlatElement[]>();
	for (const element of elements) {
		if (!element.parentId) {
			continue;
		}
		const siblings = grouped.get(element.parentId);
		if (siblings) {
			siblings.push(element);
		} else {
			grouped.set(element.parentId, [element]);
		}
	}
	return grouped;
}

/** Adds to the edited state the evidence links it does not have. */
function carryLinks(links: EvidenceLinkRecord[], edited: FlattenResult): void {
	const have = new Set(edited.evidenceLinks.map(evidenceLinkKey));
	for (const link of links) {
		if (!have.has(evidenceLinkKey(link))) {
			edited.evidenceLinks.push(link);
		}
	}
}

/**
 * The export shows what hangs from shared evidence (its counter-goals) under
 * one claim only, and the evidence's other copies are leaves. When an edit
 * removes the claim that showed it, or removes the evidence from that claim,
 * the edited tree keeps the evidence as a leaf and no longer shows what hangs
 * from it. The person did not delete that, so it is carried over unchanged.
 * Removing the counter-goal from the copy that shows it, or removing the
 * evidence everywhere, is still a deletion.
 */
function keepWhatHangsFromEvidenceNoLongerShown(
	current: FlattenResult,
	edited: FlattenResult
): void {
	for (const [evidenceId, shownUnder] of current.expandedUnder) {
		if (
			!edited.elements.has(evidenceId) ||
			edited.expandedUnder.has(evidenceId)
		) {
			continue;
		}
		const stillShown = edited.evidenceLinks.some(
			(link) => link.evidenceId === evidenceId && shownUnder.has(link.claimId)
		);
		if (!stillShown) {
			carryOverBeneath(evidenceId, current, edited);
		}
	}
}

/**
 * Whether two context entries are the same. A named entry is compared by its
 * four fields, so the order of its keys does not matter (the database returns
 * keys in its own order).
 */
function contextEntriesEqual(a: ContextEntry, b: ContextEntry): boolean {
	if (typeof a === "string" || typeof b === "string") {
		return a === b;
	}
	return (
		a.id === b.id &&
		a.name === b.name &&
		a.text === b.text &&
		a.value === b.value
	);
}

/**
 * Compares two context lists entry by entry, in order.
 */
function contextEqual(
	a: ContextEntry[] | undefined,
	b: ContextEntry[] | undefined
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
	return a.every((entry, i) => {
		const other = b[i];
		return other !== undefined && contextEntriesEqual(entry, other);
	});
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
	"assertionStatus",
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
	if (!contextEqual(current.context, edited.context)) {
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
		assertionStatus: element.assertionStatus,
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
	keepWhatHangsFromEvidenceNoLongerShown(currentResult, editedResult);

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
