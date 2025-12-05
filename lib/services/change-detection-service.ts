"use server";

import { canAccessCase } from "@/lib/permissions";
import { prismaNew } from "@/lib/prisma-new";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

// ============================================
// Types
// ============================================

export type ChangeSummary = {
	addedElements: number;
	removedElements: number;
	modifiedElements: number;
};

export type ChangeStatus = {
	hasChanges: boolean;
	publishedAt: Date | null;
	publishedId: string | null;
	changeSummary?: ChangeSummary;
};

// ============================================
// Service Functions
// ============================================

/**
 * Detects changes between the current case content and its last published version.
 * Returns change status and optionally a summary of what changed.
 *
 * @param userId - User ID for permission checking
 * @param caseId - The assurance case ID
 * @param includeDetails - When true, includes a summary of changes
 * @returns ChangeStatus or null if case not found or no permission
 */
export async function detectChanges(
	userId: string,
	caseId: string,
	includeDetails = false
): Promise<ChangeStatus | null> {
	// Check user has at least VIEW permission
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return null;
	}

	// Get the case with its latest published version
	const assuranceCase = await prismaNew.assuranceCase.findUnique({
		where: { id: caseId },
		select: {
			id: true,
			published: true,
			updatedAt: true,
			publishedVersions: {
				select: {
					id: true,
					content: true,
					createdAt: true,
				},
				orderBy: {
					createdAt: "desc",
				},
				take: 1,
			},
		},
	});

	if (!assuranceCase) {
		return null;
	}

	const latestPublished = assuranceCase.publishedVersions[0];

	// If not published, there are no changes to detect
	if (!(assuranceCase.published && latestPublished)) {
		return {
			hasChanges: false,
			publishedAt: null,
			publishedId: null,
		};
	}

	// Quick check: if updatedAt <= publishedAt, no changes
	if (assuranceCase.updatedAt <= latestPublished.createdAt) {
		return {
			hasChanges: false,
			publishedAt: latestPublished.createdAt,
			publishedId: latestPublished.id,
		};
	}

	// For detailed comparison, export current case and compare with published version
	if (includeDetails) {
		const exportResult = await exportCase(userId, caseId, {
			includeComments: false,
		});

		if (!exportResult.success) {
			// Fall back to timestamp-based detection
			return {
				hasChanges: true,
				publishedAt: latestPublished.createdAt,
				publishedId: latestPublished.id,
			};
		}

		// Parse the published content (stored as JSON)
		const publishedContent = latestPublished.content as CaseExportNested;

		const changeSummary = compareTreeStructures(
			exportResult.data.tree,
			publishedContent.tree
		);

		const hasChanges =
			changeSummary.addedElements > 0 ||
			changeSummary.removedElements > 0 ||
			changeSummary.modifiedElements > 0;

		return {
			hasChanges,
			publishedAt: latestPublished.createdAt,
			publishedId: latestPublished.id,
			changeSummary,
		};
	}

	// Timestamp-based detection (updatedAt > publishedAt)
	return {
		hasChanges: true,
		publishedAt: latestPublished.createdAt,
		publishedId: latestPublished.id,
	};
}

/**
 * Quickly checks if a case has changes since last publish.
 * Uses timestamp comparison for performance.
 *
 * @param userId - User ID for permission checking
 * @param caseId - The assurance case ID
 * @returns boolean indicating if changes exist, or null if case not found
 */
export async function hasChangesSincePublish(
	userId: string,
	caseId: string
): Promise<boolean | null> {
	const result = await detectChanges(userId, caseId, false);
	if (result === null) {
		return null;
	}
	return result.hasChanges;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Compares two tree structures and returns a summary of differences.
 * Compares by element ID to detect additions, removals, and modifications.
 */
function compareTreeStructures(
	currentTree: TreeNode[],
	publishedTree: TreeNode[]
): ChangeSummary {
	// Build maps of element ID -> element data for both trees
	const currentElements = flattenTree(currentTree);
	const publishedElements = flattenTree(publishedTree);

	const currentIds = new Set(currentElements.keys());
	const publishedIds = new Set(publishedElements.keys());

	let addedElements = 0;
	let removedElements = 0;
	let modifiedElements = 0;

	// Find added elements (in current but not in published)
	for (const id of currentIds) {
		if (!publishedIds.has(id)) {
			addedElements += 1;
		}
	}

	// Find removed elements (in published but not in current)
	for (const id of publishedIds) {
		if (!currentIds.has(id)) {
			removedElements += 1;
		}
	}

	// Find modified elements (in both but with different content)
	for (const id of currentIds) {
		if (publishedIds.has(id)) {
			const currentEl = currentElements.get(id);
			const publishedEl = publishedElements.get(id);

			if (
				currentEl &&
				publishedEl &&
				!elementsAreEqual(currentEl, publishedEl)
			) {
				modifiedElements += 1;
			}
		}
	}

	return {
		addedElements,
		removedElements,
		modifiedElements,
	};
}

/**
 * Flattens a tree structure into a map of ID -> element data.
 * Recursively processes all children.
 */
function flattenTree(nodes: TreeNode[]): Map<string, TreeNodeCompareData> {
	const result = new Map<string, TreeNodeCompareData>();

	function processNode(node: TreeNode) {
		result.set(node.id, extractCompareData(node));

		// Process children
		if (node.children) {
			for (const child of node.children) {
				processNode(child);
			}
		}

		// Process evidence
		if (node.evidence) {
			for (const ev of node.evidence) {
				result.set(ev.id, extractCompareData(ev));
			}
		}
	}

	for (const node of nodes) {
		processNode(node);
	}

	return result;
}

/**
 * Data structure for element comparison (excludes volatile fields).
 */
type TreeNodeCompareData = {
	id: string;
	elementType: string;
	name: string;
	description: string;
	parentId: string | null;
	role: string | null;
	url: string | null;
	level: string | null;
	isDefeater: boolean | null;
	defeatsElementId: string | null;
};

/**
 * Extracts comparison-relevant data from a tree node.
 * Excludes volatile fields like comments and timestamps.
 */
function extractCompareData(
	node:
		| TreeNode
		| {
				id: string;
				elementType: string;
				name: string;
				description: string;
				parentId?: string | null;
				role?: string | null;
				url?: string | null;
				level?: string | null;
				isDefeater?: boolean | null;
				defeatsElementId?: string | null;
		  }
): TreeNodeCompareData {
	return {
		id: node.id,
		elementType: node.elementType,
		name: node.name,
		description: node.description,
		parentId: node.parentId ?? null,
		role: node.role ?? null,
		url: node.url ?? null,
		level: node.level ?? null,
		isDefeater: node.isDefeater ?? null,
		defeatsElementId: node.defeatsElementId ?? null,
	};
}

/**
 * Compares two elements for equality based on their content fields.
 */
function elementsAreEqual(
	a: TreeNodeCompareData,
	b: TreeNodeCompareData
): boolean {
	return (
		a.elementType === b.elementType &&
		a.name === b.name &&
		a.description === b.description &&
		a.parentId === b.parentId &&
		a.role === b.role &&
		a.url === b.url &&
		a.level === b.level &&
		a.isDefeater === b.isDefeater &&
		a.defeatsElementId === b.defeatsElementId
	);
}
