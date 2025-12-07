"use server";

import { prismaNew } from "@/lib/prisma";
import type {
	CaseExportNested,
	ElementRole,
	ElementType,
	ExportComment,
	ModuleEmbedType,
} from "@/lib/schemas/case-export";
import {
	buildTreeFromElements,
	type ElementWithLinks,
} from "@/lib/transforms/build-tree";

export type ExportOptions = {
	includeComments?: boolean;
};

export type ExportResult =
	| { success: true; data: CaseExportNested }
	| { success: false; error: string };

/**
 * Validates user has VIEW permission on the case.
 */
async function validateViewAccess(
	userId: string,
	caseId: string
): Promise<boolean> {
	const { canAccessCase } = await import("@/lib/permissions");
	return canAccessCase({ userId, caseId }, "VIEW");
}

/**
 * Fetches comments for all elements in a case.
 * Returns a map of elementId -> ExportComment[]
 */
async function fetchCommentsForElements(
	elementIds: string[]
): Promise<Map<string, ExportComment[]>> {
	const commentsMap = new Map<string, ExportComment[]>();

	if (elementIds.length === 0) {
		return commentsMap;
	}

	const comments = await prismaNew.comment.findMany({
		where: {
			elementId: { in: elementIds },
		},
		select: {
			elementId: true,
			content: true,
			createdAt: true,
			author: {
				select: {
					username: true,
					email: true,
				},
			},
		},
		orderBy: {
			createdAt: "asc",
		},
	});

	for (const comment of comments) {
		if (!comment.elementId) {
			continue;
		}

		const exportComment: ExportComment = {
			author: comment.author?.username || comment.author?.email || "Unknown",
			content: comment.content,
			createdAt: comment.createdAt.toISOString(),
		};

		const existing = commentsMap.get(comment.elementId) ?? [];
		existing.push(exportComment);
		commentsMap.set(comment.elementId, existing);
	}

	return commentsMap;
}

/**
 * Fetches and exports a case in nested tree format.
 *
 * Export includes:
 * - Case metadata (name, description, colorProfile)
 * - Nested tree structure with evidence inline under claims
 * - Comments (when includeComments option is true, default)
 *
 * Does NOT export:
 * - Owner information
 * - Permission assignments
 * - Internal timestamps
 * - Lock state
 */
export async function exportCase(
	userId: string,
	caseId: string,
	options: ExportOptions = { includeComments: true }
): Promise<ExportResult> {
	const { includeComments = true } = options;

	// Validate user has VIEW permission
	const hasAccess = await validateViewAccess(userId, caseId);
	if (!hasAccess) {
		return { success: false, error: "Permission denied" };
	}

	try {
		// Fetch case with elements and their evidence links (for claims)
		const caseData = await prismaNew.assuranceCase.findUnique({
			where: { id: caseId },
			include: {
				elements: {
					select: {
						id: true,
						elementType: true,
						parentId: true,
						name: true,
						description: true,
						inSandbox: true,
						// Type-specific fields
						role: true,
						assumption: true,
						justification: true,
						context: true,
						url: true,
						level: true,
						// Module fields
						moduleReferenceId: true,
						moduleEmbedType: true,
						modulePublicSummary: true,
						// Pattern metadata
						fromPattern: true,
						modifiedFromPattern: true,
						// Dialogical reasoning
						isDefeater: true,
						defeatsElementId: true,
						// Include evidence linked TO this element (claims get their evidence)
						evidenceLinksTo: {
							select: {
								evidence: {
									select: {
										id: true,
										elementType: true,
										parentId: true,
										name: true,
										description: true,
										inSandbox: true,
										// Type-specific fields
										role: true,
										assumption: true,
										justification: true,
										context: true,
										url: true,
										level: true,
										// Module fields
										moduleReferenceId: true,
										moduleEmbedType: true,
										modulePublicSummary: true,
										// Pattern metadata
										fromPattern: true,
										modifiedFromPattern: true,
										// Dialogical reasoning
										isDefeater: true,
										defeatsElementId: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!caseData) {
			return { success: false, error: "Case not found" };
		}

		if (caseData.elements.length === 0) {
			return { success: false, error: "Case has no elements to export" };
		}

		// Fetch comments if requested
		let commentsMap = new Map<string, ExportComment[]>();
		if (includeComments) {
			// Collect all element IDs including evidence
			const allElementIds = new Set<string>();
			for (const el of caseData.elements) {
				allElementIds.add(el.id);
				for (const link of el.evidenceLinksTo) {
					allElementIds.add(link.evidence.id);
				}
			}
			commentsMap = await fetchCommentsForElements([...allElementIds]);
		}

		// Transform Prisma elements to ElementWithLinks format
		const elements: ElementWithLinks[] = caseData.elements.map((el) => ({
			id: el.id,
			elementType: el.elementType as ElementType,
			parentId: el.parentId,
			name: el.name,
			description: el.description,
			inSandbox: el.inSandbox,
			// Type-specific fields
			role: el.role as ElementRole | null,
			assumption: el.assumption,
			justification: el.justification,
			context: el.context,
			url: el.url,
			level: el.level,
			// Module fields
			moduleReferenceId: el.moduleReferenceId,
			moduleEmbedType: el.moduleEmbedType as ModuleEmbedType | null,
			modulePublicSummary: el.modulePublicSummary,
			// Pattern metadata
			fromPattern: el.fromPattern,
			modifiedFromPattern: el.modifiedFromPattern,
			// Dialogical reasoning
			isDefeater: el.isDefeater,
			defeatsElementId: el.defeatsElementId,
			// Comments (if requested)
			comments: includeComments ? commentsMap.get(el.id) : undefined,
			evidenceLinksTo: el.evidenceLinksTo.map((link) => ({
				evidence: {
					id: link.evidence.id,
					elementType: link.evidence.elementType as ElementType,
					parentId: link.evidence.parentId,
					name: link.evidence.name,
					description: link.evidence.description,
					inSandbox: link.evidence.inSandbox,
					// Type-specific fields
					role: link.evidence.role as ElementRole | null,
					assumption: link.evidence.assumption,
					justification: link.evidence.justification,
					context: link.evidence.context,
					url: link.evidence.url,
					level: link.evidence.level,
					// Module fields
					moduleReferenceId: link.evidence.moduleReferenceId,
					moduleEmbedType: link.evidence
						.moduleEmbedType as ModuleEmbedType | null,
					modulePublicSummary: link.evidence.modulePublicSummary,
					// Pattern metadata
					fromPattern: link.evidence.fromPattern,
					modifiedFromPattern: link.evidence.modifiedFromPattern,
					// Dialogical reasoning
					isDefeater: link.evidence.isDefeater,
					defeatsElementId: link.evidence.defeatsElementId,
					// Comments for evidence (if requested)
					comments: includeComments
						? commentsMap.get(link.evidence.id)
						: undefined,
				},
			})),
		}));

		// Build nested tree from flat elements
		const tree = buildTreeFromElements(elements);

		// Build the nested export (uses "1.0" as first officially versioned format)
		const exportData: CaseExportNested = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: {
				name: caseData.name,
				description: caseData.description,
				colorProfile: caseData.colorProfile,
			},
			tree,
		};

		return { success: true, data: exportData };
	} catch (error) {
		console.error("Failed to export case:", error);
		return { success: false, error: "Failed to export case" };
	}
}
