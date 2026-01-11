import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { getCasePermission, hasPermissionLevel } from "@/lib/permissions";
import { prismaNew } from "@/lib/prisma";

const TYPE_PREFIXES: Record<string, string> = {
	GOAL: "G",
	STRATEGY: "S",
	PROPERTY_CLAIM: "P",
	EVIDENCE: "E",
};

type ElementWithChildren = {
	id: string;
	elementType: string;
	parentId: string | null;
	createdAt: Date;
	name: string | null;
	children: ElementWithChildren[];
};

/**
 * Builds a tree structure from flat element list
 */
function buildElementTree(
	elements: Array<{
		id: string;
		elementType: string;
		parentId: string | null;
		createdAt: Date;
		name: string | null;
	}>
): ElementWithChildren[] {
	const elementMap = new Map<string, ElementWithChildren>();
	const roots: ElementWithChildren[] = [];

	// Create nodes with empty children arrays
	for (const element of elements) {
		elementMap.set(element.id, { ...element, children: [] });
	}

	// Build parent-child relationships
	for (const element of elements) {
		const node = elementMap.get(element.id);
		if (!node) {
			continue;
		}

		if (element.parentId && elementMap.has(element.parentId)) {
			const parent = elementMap.get(element.parentId);
			if (parent) {
				parent.children.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	// Sort children by creation date at each level
	const sortChildren = (nodes: ElementWithChildren[]): void => {
		nodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		for (const node of nodes) {
			sortChildren(node.children);
		}
	};
	sortChildren(roots);

	return roots;
}

/**
 * Find a parent node by ID in the tree
 */
function findParentNode(
	nodes: ElementWithChildren[],
	parentId: string | null
): ElementWithChildren | null {
	if (!parentId) {
		return null;
	}
	for (const node of nodes) {
		if (node.id === parentId) {
			return node;
		}
		const found = findParentNode(node.children, parentId);
		if (found) {
			return found;
		}
	}
	return null;
}

/**
 * Get the 1-based index of a node among its siblings of the same type
 */
function getSiblingIndex(
	parent: ElementWithChildren,
	nodeId: string,
	elementType: string
): number {
	const siblingsOfType = parent.children.filter(
		(c) => c.elementType === elementType
	);
	const index = siblingsOfType.findIndex((c) => c.id === nodeId);
	return index + 1;
}

type PropertyClaimNameOptions = {
	node: ElementWithChildren;
	parentName: string | null;
	parentType: string | null;
	roots: ElementWithChildren[];
	globalCounters: Record<string, number>;
};

/**
 * Generate name for a property claim element
 */
function generatePropertyClaimName(options: PropertyClaimNameOptions): string {
	const { node, parentName, parentType, roots, globalCounters } = options;
	const prefix = TYPE_PREFIXES.PROPERTY_CLAIM;

	if (parentType === "PROPERTY_CLAIM" && parentName) {
		// Sub-property claim: use parent's name as base
		const parent = findParentNode(roots, node.parentId);
		const siblingIndex = parent
			? getSiblingIndex(parent, node.id, "PROPERTY_CLAIM")
			: 1;
		return `${parentName}.${siblingIndex}`;
	}

	// Top-level property claim: use global counter
	const count = (globalCounters.PROPERTY_CLAIM || 0) + 1;
	globalCounters.PROPERTY_CLAIM = count;
	return `${prefix}${count}`;
}

/**
 * Generates hierarchical names for elements by traversing the tree
 * Returns a map of element ID to new name
 *
 * Naming rules:
 * - Goals, Strategies, Evidence, Context: Global sequential (G1, G2, S1, S2, E1, E2, C1, C2)
 * - Top-level Property Claims (under goal/strategy): Global sequential (P1, P2, P3)
 * - Sub-Property Claims (under another property claim): Hierarchical (P1.1, P1.2, P1.1.1)
 */
function generateHierarchicalNames(
	roots: ElementWithChildren[]
): Map<string, string> {
	const nameMap = new Map<string, string>();
	const globalCounters: Record<string, number> = {};

	function processNode(
		node: ElementWithChildren,
		parentName: string | null,
		parentType: string | null
	): void {
		let newName: string;

		if (node.elementType === "PROPERTY_CLAIM") {
			newName = generatePropertyClaimName({
				node,
				parentName,
				parentType,
				roots,
				globalCounters,
			});
		} else {
			const prefix = TYPE_PREFIXES[node.elementType] || "X";
			const count = (globalCounters[node.elementType] || 0) + 1;
			globalCounters[node.elementType] = count;
			newName = `${prefix}${count}`;
		}

		nameMap.set(node.id, newName);

		for (const child of node.children) {
			processNode(child, newName, node.elementType);
		}
	}

	for (const root of roots) {
		processNode(root, null, null);
	}

	return nameMap;
}

/**
 * Resets element identifiers using Prisma with hierarchical naming for property claims
 */
async function resetIdentifiersWithPrisma(
	caseId: string,
	userId: string
): Promise<{ success: boolean; error?: string; status: number }> {
	// Check user has edit permission on this case (includes creator check)
	const permissionResult = await getCasePermission({ userId, caseId });

	const hasEditAccess =
		permissionResult.hasAccess &&
		permissionResult.permission &&
		hasPermissionLevel(permissionResult.permission, "EDIT");

	if (!hasEditAccess) {
		return { success: false, error: "Permission denied", status: 403 };
	}

	// Get all elements for this case, ordered by creation date
	const elements = await prismaNew.assuranceElement.findMany({
		where: { caseId },
		orderBy: { createdAt: "asc" },
		select: {
			id: true,
			elementType: true,
			parentId: true,
			createdAt: true,
			name: true,
		},
	});

	// Build tree structure and generate hierarchical names
	const tree = buildElementTree(elements);
	const nameMap = generateHierarchicalNames(tree);

	// Update all elements with new names
	const updates = elements.map((element) => {
		const newName = nameMap.get(element.id) || element.name || "X";
		return prismaNew.assuranceElement.update({
			where: { id: element.id },
			data: { name: newName },
		});
	});

	await Promise.all(updates);

	// Emit SSE event for real-time updates
	// Note: Don't pass userId to ensure the triggering user also receives the event
	// (the frontend doesn't update optimistically for reset identifiers)
	const { emitSSEEvent } = await import(
		"@/lib/services/sse-connection-manager"
	);
	emitSSEEvent("case:updated", caseId, { action: "identifiers-reset" });

	return { success: true, status: 200 };
}

/**
 * POST /api/cases/[id]/update-ids
 * Resets all element identifiers (names) with hierarchical naming for property claims
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const result = await resetIdentifiersWithPrisma(caseId, validated.userId);

		if (!result.success) {
			return NextResponse.json(
				{ error: result.error },
				{ status: result.status }
			);
		}

		return NextResponse.json(
			{ message: "Identifiers reset successfully" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Error resetting identifiers:", error);
		return NextResponse.json(
			{ error: "Failed to reset identifiers" },
			{ status: 500 }
		);
	}
}
