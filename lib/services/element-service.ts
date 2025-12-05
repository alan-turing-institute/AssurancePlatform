"use server";

import { prismaNew } from "@/lib/prisma-new";
import type {
	PermissionLevel,
	ElementType as PrismaElementType,
} from "@/src/generated/prisma-new";

// Element types mapping from frontend to Prisma enum
const ELEMENT_TYPE_MAP: Record<string, string> = {
	goal: "GOAL",
	context: "CONTEXT",
	strategy: "STRATEGY",
	property: "PROPERTY_CLAIM",
	property_claim: "PROPERTY_CLAIM",
	propertyclaim: "PROPERTY_CLAIM",
	evidence: "EVIDENCE",
} as const;

// Reverse mapping for API responses
const ELEMENT_TYPE_REVERSE_MAP: Record<string, string> = {
	GOAL: "TopLevelNormativeGoal",
	CONTEXT: "Context",
	STRATEGY: "Strategy",
	PROPERTY_CLAIM: "PropertyClaim",
	EVIDENCE: "Evidence",
} as const;

// Element type prefixes for auto-generated names
const TYPE_PREFIXES: Record<string, string> = {
	GOAL: "G",
	STRATEGY: "S",
	PROPERTY_CLAIM: "P",
	EVIDENCE: "E",
	CONTEXT: "C",
};

export type CreateElementInput = {
	caseId: string;
	elementType: string;
	name?: string;
	description?: string;
	shortDescription?: string;
	longDescription?: string;
	parentId?: string | null;
	// For compatibility with Django format
	goal_id?: string | number | null;
	strategy_id?: string | number | null;
	property_claim_id?: string | number | number[] | null;
	assurance_case_id?: string | number;
	// Evidence-specific
	url?: string;
	URL?: string;
	// GSN-specific
	assumption?: string;
	justification?: string;
};

export type UpdateElementInput = {
	name?: string;
	description?: string;
	shortDescription?: string;
	longDescription?: string;
	parentId?: string | null;
	url?: string;
	URL?: string;
	assumption?: string;
	justification?: string;
	inSandbox?: boolean;
	// For compatibility with Django format
	goal_id?: string | number | null;
	strategy_id?: string | number | null;
	property_claim_id?: string | number | number[] | null;
};

export type ElementResponse = {
	id: string;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date: string;
	in_sandbox: boolean;
	assurance_case_id: string;
	goal_id?: string | null;
	strategy_id?: string | null;
	property_claim_id?: string | string[] | null;
	URL?: string;
	assumption?: string;
	justification?: string;
	level?: number;
	comments?: unknown[];
};

/**
 * Validates user has permission to access/modify a case
 */
async function validateCaseAccess(
	userId: string,
	caseId: string,
	requiredLevel: PermissionLevel = "VIEW"
): Promise<boolean> {
	const { canAccessCase } = await import("@/lib/permissions");
	return canAccessCase({ userId, caseId }, requiredLevel);
}

/**
 * Resolves parent ID from Django-style fields (goal_id, strategy_id, property_claim_id)
 * Returns undefined if no parent field is specified (to distinguish from explicitly setting null)
 */
function resolveParentId(
	input: CreateElementInput | UpdateElementInput
): string | null | undefined {
	// Direct parentId takes precedence - return exactly what's provided (including null)
	if ("parentId" in input && input.parentId !== undefined) {
		return input.parentId;
	}

	// Check Django-style parent references
	if (input.goal_id) {
		return String(input.goal_id);
	}
	if (input.strategy_id) {
		return String(input.strategy_id);
	}
	if (input.property_claim_id) {
		// Handle array format from evidence
		if (Array.isArray(input.property_claim_id)) {
			return String(input.property_claim_id[0]);
		}
		return String(input.property_claim_id);
	}

	// Return undefined to indicate no parent field was specified
	// (different from null which means explicitly clearing the parent)
	return;
}

/**
 * Maps element type from frontend format to Prisma enum
 */
function mapElementType(type: string): string {
	const normalised = type.toLowerCase().replace(/\s+/g, "_");
	return ELEMENT_TYPE_MAP[normalised] || type.toUpperCase();
}

/**
 * Adds parent reference to response in Django format
 */
function addParentReference(
	response: ElementResponse,
	parent: { id: string; elementType: string },
	elementType: string
): void {
	switch (parent.elementType) {
		case "GOAL":
			response.goal_id = parent.id;
			break;
		case "STRATEGY":
			response.strategy_id = parent.id;
			break;
		case "PROPERTY_CLAIM":
			// Evidence expects property_claim_id as an array (Django format)
			// Other elements get it as a string
			if (elementType === "EVIDENCE") {
				response.property_claim_id = [parent.id];
			} else {
				response.property_claim_id = parent.id;
			}
			break;
		default:
			// Unknown parent type - no reference added
			break;
	}
}

/**
 * Transforms Prisma element to Django-compatible response format
 */
function transformToResponse(element: {
	id: string;
	elementType: string;
	name: string | null;
	description: string;
	assumption: string | null;
	justification: string | null;
	url: string | null;
	inSandbox: boolean;
	level: number | null;
	caseId: string;
	parentId: string | null;
	createdAt: Date;
	parent?: {
		id: string;
		elementType: string;
	} | null;
}): ElementResponse {
	const response: ElementResponse = {
		id: element.id,
		type: ELEMENT_TYPE_REVERSE_MAP[element.elementType] || element.elementType,
		name: element.name || "",
		short_description: element.description || "",
		long_description: element.description || "",
		created_date: element.createdAt.toISOString(),
		in_sandbox: element.inSandbox,
		assurance_case_id: element.caseId,
		comments: [],
	};

	// Add parent reference in Django format
	if (element.parent) {
		addParentReference(response, element.parent, element.elementType);
	}

	// Add type-specific fields
	if (element.url) {
		response.URL = element.url;
	}
	if (element.assumption) {
		response.assumption = element.assumption;
	}
	if (element.justification) {
		response.justification = element.justification;
	}
	if (element.level !== null) {
		response.level = element.level;
	}

	return response;
}

/**
 * Generates an element name based on type and hierarchy.
 *
 * Naming conventions:
 * - For property claims under another property claim: hierarchical (P1.1, P1.1.1)
 * - For top-level property claims (under strategy/goal): case-wide sequential (P1, P2, P3...)
 * - For all other elements: case-wide sequential by type (G1, S1, S2, E1, E2, C1, C2...)
 *
 * Time complexity: O(1) DB query (indexed on caseId/elementType)
 * Space complexity: O(1) - only stores count
 */
async function generateElementName(
	elementType: string,
	caseId: string,
	parentId: string | null,
	parentInfo: { name: string | null; elementType: string } | null
): Promise<string> {
	const prefix = TYPE_PREFIXES[elementType] || "X";

	// Property claims with a property claim parent get hierarchical names (P1.1, P1.1.1)
	if (
		elementType === "PROPERTY_CLAIM" &&
		parentInfo?.elementType === "PROPERTY_CLAIM" &&
		parentInfo.name
	) {
		// Count existing siblings under the same parent (efficient indexed query)
		const siblingCount = await prismaNew.assuranceElement.count({
			where: {
				parentId,
				elementType: "PROPERTY_CLAIM",
			},
		});
		return `${parentInfo.name}.${siblingCount + 1}`;
	}

	// Top-level property claims (under strategy/goal, not under another property claim)
	// Count ALL level-1 property claims in the case for case-wide sequential numbering (P1, P2, P3...)
	if (
		elementType === "PROPERTY_CLAIM" &&
		parentId &&
		parentInfo?.elementType !== "PROPERTY_CLAIM"
	) {
		const caseWideCount = await prismaNew.assuranceElement.count({
			where: {
				caseId,
				elementType: "PROPERTY_CLAIM",
				level: 1,
			},
		});
		return `${prefix}${caseWideCount + 1}`;
	}

	// All other element types (Strategy, Evidence, Context) - count case-wide
	// This ensures unique identifiers across the entire case (S1, S2, E1, E2, C1, C2...)
	const caseWideCount = await prismaNew.assuranceElement.count({
		where: {
			caseId,
			elementType: elementType as PrismaElementType,
		},
	});
	return `${prefix}${caseWideCount + 1}`;
}

/**
 * Calculates level for property claims and retrieves parent info.
 */
async function calculatePropertyClaimLevel(parentId: string): Promise<{
	level: number;
	parentInfo: { name: string | null; elementType: string };
}> {
	const parent = await prismaNew.assuranceElement.findUnique({
		where: { id: parentId },
		select: { level: true, elementType: true, name: true },
	});

	const parentInfo = parent as {
		name: string | null;
		elementType: string;
		level?: number | null;
	};

	const level =
		parentInfo?.elementType === "PROPERTY_CLAIM"
			? (parentInfo.level || 1) + 1
			: 1;

	return { level, parentInfo };
}

/**
 * Creates a new element in a case
 */
export async function createElement(
	userId: string,
	input: CreateElementInput
): Promise<{ data?: ElementResponse; error?: string }> {
	const caseId = input.caseId || String(input.assurance_case_id);
	if (!caseId) {
		return { error: "Case ID is required" };
	}

	// Validate user has EDIT permission
	const hasAccess = await validateCaseAccess(userId, caseId, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	const elementType = mapElementType(input.elementType);
	const parentId = resolveParentId(input);

	// Prevent duplicate goals - a case can only have one goal
	if (elementType === "GOAL") {
		const existingGoal = await prismaNew.assuranceElement.findFirst({
			where: {
				caseId,
				elementType: "GOAL",
			},
			select: { id: true },
		});
		if (existingGoal) {
			return { error: "A case can only have one goal claim" };
		}
	}

	// Calculate level and get parent info for property claims
	let level: number | undefined;
	let parentInfo: { name: string | null; elementType: string } | null = null;

	if (elementType === "PROPERTY_CLAIM" && parentId) {
		const result = await calculatePropertyClaimLevel(parentId);
		level = result.level;
		parentInfo = result.parentInfo;
	}

	// Auto-generate name if not provided
	let elementName = input.name || "";
	if (!elementName) {
		elementName = await generateElementName(
			elementType,
			caseId,
			parentId ?? null,
			parentInfo
		);
	}

	try {
		const element = await prismaNew.assuranceElement.create({
			data: {
				caseId,
				elementType: elementType as
					| "GOAL"
					| "CONTEXT"
					| "STRATEGY"
					| "PROPERTY_CLAIM"
					| "EVIDENCE",
				name: elementName,
				description:
					input.description ||
					input.shortDescription ||
					input.longDescription ||
					"",
				parentId,
				url: input.url || input.URL,
				assumption: input.assumption,
				justification: input.justification,
				level,
				createdById: userId,
			},
			include: {
				parent: {
					select: { id: true, elementType: true },
				},
			},
		});

		return { data: transformToResponse(element) };
	} catch (error) {
		console.error("Failed to create element:", error);
		return { error: "Failed to create element" };
	}
}

/**
 * Gets a single element by ID
 */
export async function getElement(
	userId: string,
	elementId: string
): Promise<{ data?: ElementResponse; error?: string }> {
	try {
		const element = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			include: {
				parent: {
					select: { id: true, elementType: true },
				},
			},
		});

		if (!element) {
			return { error: "Element not found" };
		}

		// Validate user has VIEW permission on the case
		const hasAccess = await validateCaseAccess(userId, element.caseId, "VIEW");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		return { data: transformToResponse(element) };
	} catch (error) {
		console.error("Failed to get element:", error);
		return { error: "Failed to get element" };
	}
}

/**
 * Builds update data object from input, applying field mappings
 */
function buildUpdateData(input: UpdateElementInput): Record<string, unknown> {
	const updateData: Record<string, unknown> = {};

	if (input.name !== undefined) {
		updateData.name = input.name;
	}
	if (input.description !== undefined) {
		updateData.description = input.description;
	}
	if (input.shortDescription !== undefined) {
		updateData.description = input.shortDescription;
	}
	if (input.longDescription !== undefined) {
		updateData.description = input.longDescription;
	}
	if (input.url !== undefined) {
		updateData.url = input.url;
	}
	if (input.URL !== undefined) {
		updateData.url = input.URL;
	}
	if (input.assumption !== undefined) {
		updateData.assumption = input.assumption;
	}
	if (input.justification !== undefined) {
		updateData.justification = input.justification;
	}
	if (input.inSandbox !== undefined) {
		updateData.inSandbox = input.inSandbox;
	}

	return updateData;
}

/**
 * Calculates the new level for a property claim based on its new parent
 */
async function calculateNewLevel(newParentId: string): Promise<number> {
	const newParent = await prismaNew.assuranceElement.findUnique({
		where: { id: newParentId },
		select: { level: true, elementType: true },
	});
	if (newParent?.elementType === "PROPERTY_CLAIM") {
		return (newParent.level || 1) + 1;
	}
	return 1;
}

/**
 * Updates an existing element
 */
export async function updateElement(
	userId: string,
	elementId: string,
	input: UpdateElementInput
): Promise<{ data?: ElementResponse; error?: string }> {
	try {
		// Get existing element to check permissions
		const existing = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, elementType: true, level: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		// Build update data from input fields
		const updateData = buildUpdateData(input);

		// Handle parent change (for move operations)
		const newParentId = resolveParentId(input);
		if (newParentId !== undefined) {
			updateData.parentId = newParentId;

			// Recalculate level if it's a property claim
			if (existing.elementType === "PROPERTY_CLAIM" && newParentId) {
				updateData.level = await calculateNewLevel(newParentId);
			}
		}

		const element = await prismaNew.assuranceElement.update({
			where: { id: elementId },
			data: updateData,
			include: {
				parent: {
					select: { id: true, elementType: true },
				},
			},
		});

		return { data: transformToResponse(element) };
	} catch (error) {
		console.error("Failed to update element:", error);
		return { error: "Failed to update element" };
	}
}

/**
 * Deletes an element
 */
export async function deleteElement(
	userId: string,
	elementId: string
): Promise<{ success?: boolean; error?: string }> {
	try {
		// Get existing element to check permissions
		const existing = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		// Delete element (children will cascade)
		await prismaNew.assuranceElement.delete({
			where: { id: elementId },
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to delete element:", error);
		return { error: "Failed to delete element" };
	}
}

/**
 * Detaches an element (moves to sandbox)
 */
export async function detachElement(
	userId: string,
	elementId: string
): Promise<{ success?: boolean; error?: string }> {
	try {
		// Get existing element to check permissions
		const existing = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		// Move to sandbox by clearing parent and setting inSandbox
		await prismaNew.assuranceElement.update({
			where: { id: elementId },
			data: {
				parentId: null,
				inSandbox: true,
			},
		});

		return { success: true };
	} catch (error) {
		console.error("Failed to detach element:", error);
		return { error: "Failed to detach element" };
	}
}

/**
 * Recursively gets all descendant element IDs for a given parent
 */
async function getDescendantIds(parentId: string): Promise<string[]> {
	const children = await prismaNew.assuranceElement.findMany({
		where: { parentId },
		select: { id: true },
	});

	const descendantIds: string[] = [];
	for (const child of children) {
		descendantIds.push(child.id);
		const grandchildren = await getDescendantIds(child.id);
		descendantIds.push(...grandchildren);
	}

	return descendantIds;
}

/**
 * Attaches an element (moves from sandbox to parent)
 * Also cascades to all descendants, removing them from sandbox
 */
export async function attachElement(
	userId: string,
	elementId: string,
	parentId: string
): Promise<{ success?: boolean; error?: string }> {
	try {
		// Get existing element to check permissions
		const existing = await prismaNew.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, elementType: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Permission denied" };
		}

		// Calculate level if property claim
		let level: number | undefined;
		if (existing.elementType === "PROPERTY_CLAIM") {
			const parent = await prismaNew.assuranceElement.findUnique({
				where: { id: parentId },
				select: { level: true, elementType: true },
			});
			if (parent?.elementType === "PROPERTY_CLAIM") {
				level = (parent.level || 1) + 1;
			} else {
				level = 1;
			}
		}

		// Attach to parent and remove from sandbox
		await prismaNew.assuranceElement.update({
			where: { id: elementId },
			data: {
				parentId,
				inSandbox: false,
				...(level !== undefined ? { level } : {}),
			},
		});

		// Cascade: remove all descendants from sandbox as well
		const descendantIds = await getDescendantIds(elementId);
		if (descendantIds.length > 0) {
			await prismaNew.assuranceElement.updateMany({
				where: {
					id: { in: descendantIds },
				},
				data: {
					inSandbox: false,
				},
			});
		}

		return { success: true };
	} catch (error) {
		console.error("Failed to attach element:", error);
		return { error: "Failed to attach element" };
	}
}

/**
 * Gets all elements in sandbox for a case
 */
export async function getSandboxElements(
	userId: string,
	caseId: string
): Promise<{ data?: ElementResponse[]; error?: string }> {
	// Validate user has VIEW permission
	const hasAccess = await validateCaseAccess(userId, caseId, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		const elements = await prismaNew.assuranceElement.findMany({
			where: {
				caseId,
				inSandbox: true,
			},
			include: {
				parent: {
					select: { id: true, elementType: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return { data: elements.map(transformToResponse) };
	} catch (error) {
		console.error("Failed to get sandbox elements:", error);
		return { error: "Failed to get sandbox elements" };
	}
}
