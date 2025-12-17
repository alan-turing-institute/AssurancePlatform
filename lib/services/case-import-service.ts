"use server";

import { prismaNew } from "@/lib/prisma";
import type { CaseExportV2, ElementV2 } from "@/lib/schemas/case-export";
import { detectAndValidate } from "@/lib/schemas/version-detection";
import { topologicalSort, transformV1ToV2 } from "@/lib/transforms/v1-to-v2";

export type ImportResult =
	| {
			success: true;
			caseId: string;
			caseName: string;
			elementCount: number;
			evidenceLinkCount: number;
			commentCount: number;
			warnings: string[];
	  }
	| { success: false; error: string; validationErrors?: string[] };

/**
 * Validates and transforms imported JSON data.
 * Returns v2 format data regardless of input version.
 */
async function processImportData(data: unknown): Promise<{
	success: boolean;
	data?: CaseExportV2;
	warnings: string[];
	errors?: string[];
}> {
	const result = detectAndValidate(data);

	if (!result.isValid) {
		return {
			success: false,
			warnings: [],
			errors: result.errors.map((e) => `${e.path}: ${e.message}`),
		};
	}

	// If legacy, transform to flat format
	if (result.version === "legacy") {
		const transformed = transformV1ToV2(result.data);
		return {
			success: true,
			data: transformed.case,
			warnings: transformed.warnings,
		};
	}

	// If nested, flatten to flat format
	if (result.version === "nested") {
		const { flattenNestedToFlat } = await import(
			"@/lib/transforms/nested-to-flat"
		);
		const v2Data = flattenNestedToFlat(result.data);
		return {
			success: true,
			data: v2Data,
			warnings: [],
		};
	}

	// Already v2
	return {
		success: true,
		data: result.data as CaseExportV2,
		warnings: [],
	};
}

/**
 * Creates a new UUID for an element.
 */
function generateUuid(): string {
	return crypto.randomUUID();
}

/**
 * Builds the ID mapping from temp/original IDs to new UUIDs.
 */
function buildIdMap(elements: ElementV2[]): Map<string, string> {
	const idMap = new Map<string, string>();
	for (const el of elements) {
		idMap.set(el.id, generateUuid());
	}
	return idMap;
}

/**
 * Creates the case and grants ADMIN permission to the user.
 */
async function createCaseWithPermission(
	caseData: CaseExportV2["case"],
	userId: string
): Promise<string> {
	const newCase = await prismaNew.assuranceCase.create({
		data: {
			name: caseData.name,
			description: caseData.description,
			createdById: userId,
		},
	});

	// Creator automatically has ADMIN access through createdById
	// No explicit permission needed

	return newCase.id;
}

/**
 * Creates all elements in the correct order (parents before children).
 */
async function createElements(
	caseId: string,
	elements: ElementV2[],
	idMap: Map<string, string>,
	userId: string
): Promise<number> {
	// Sort elements topologically
	const sortedElements = topologicalSort(elements);

	for (const el of sortedElements) {
		const newId = idMap.get(el.id);
		if (!newId) {
			continue;
		}

		// Resolve parentId
		let parentId: string | null = null;
		if (el.parentId) {
			parentId = idMap.get(el.parentId) ?? null;
		}

		await prismaNew.assuranceElement.create({
			data: {
				id: newId,
				caseId,
				elementType: el.elementType,
				role: el.role,
				parentId,
				name: el.name,
				description: el.description,
				assumption: el.assumption,
				justification: el.justification,
				context: el.context ?? [],
				url: el.url,
				level: el.level,
				inSandbox: el.inSandbox,
				fromPattern: el.fromPattern ?? false,
				modifiedFromPattern: el.modifiedFromPattern ?? false,
				createdById: userId,
			},
		});
	}

	return sortedElements.length;
}

/**
 * Creates all evidence links using the new ID mappings.
 * Note: EvidenceLink only has evidenceId and claimId - no caseId.
 */
async function createEvidenceLinks(
	links: CaseExportV2["evidenceLinks"],
	idMap: Map<string, string>
): Promise<number> {
	let created = 0;

	for (const link of links) {
		const evidenceId = idMap.get(link.evidenceId);
		const claimId = idMap.get(link.claimId);

		if (evidenceId && claimId) {
			await prismaNew.evidenceLink.create({
				data: {
					evidenceId,
					claimId,
				},
			});
			created += 1;
		}
	}

	return created;
}

/**
 * Creates comments for all elements that have them.
 */
async function createComments(
	elements: ElementV2[],
	idMap: Map<string, string>,
	userId: string
): Promise<number> {
	let created = 0;

	for (const el of elements) {
		if (!el.comments || el.comments.length === 0) {
			continue;
		}

		const elementId = idMap.get(el.id);
		if (!elementId) {
			continue;
		}

		for (const comment of el.comments) {
			// Parse the createdAt date, with fallback to now
			let createdAt: Date;
			try {
				createdAt = new Date(comment.createdAt);
				if (Number.isNaN(createdAt.getTime())) {
					createdAt = new Date();
				}
			} catch {
				createdAt = new Date();
			}

			await prismaNew.comment.create({
				data: {
					elementId,
					authorId: userId, // Import user becomes comment author
					content: comment.content,
					createdAt,
				},
			});
			created += 1;
		}
	}

	return created;
}

/**
 * Imports a case from JSON data.
 *
 * Accepts both v1 (legacy Django) and v2 (Prisma) formats.
 * V1 data is automatically transformed to v2 format.
 *
 * The importing user becomes the owner with ADMIN permission.
 */
export async function importCase(
	userId: string,
	jsonData: unknown
): Promise<ImportResult> {
	// Validate and transform input
	const processed = await processImportData(jsonData);

	if (!(processed.success && processed.data)) {
		return {
			success: false,
			error: "Invalid import data",
			validationErrors: processed.errors,
		};
	}

	const v2Data = processed.data;

	try {
		// Build ID mapping
		const idMap = buildIdMap(v2Data.elements);

		// Use a transaction to ensure atomicity
		const result = await prismaNew.$transaction(async () => {
			// Create case
			const caseId = await createCaseWithPermission(v2Data.case, userId);

			// Create elements
			const elementCount = await createElements(
				caseId,
				v2Data.elements,
				idMap,
				userId
			);

			// Create evidence links
			const evidenceLinkCount = await createEvidenceLinks(
				v2Data.evidenceLinks,
				idMap
			);

			// Create comments for elements that have them
			const commentCount = await createComments(v2Data.elements, idMap, userId);

			return {
				caseId,
				caseName: v2Data.case.name,
				elementCount,
				evidenceLinkCount,
				commentCount,
			};
		});

		return {
			success: true,
			...result,
			warnings: processed.warnings,
		};
	} catch (error) {
		console.error("Failed to import case:", error);
		return { success: false, error: "Failed to import case" };
	}
}

/**
 * Validates import data without creating anything.
 * Useful for preview/confirmation UI.
 */
export async function validateImportData(jsonData: unknown): Promise<{
	isValid: boolean;
	version: "legacy" | "flat" | "nested" | null;
	caseName?: string;
	elementCount?: number;
	evidenceLinkCount?: number;
	warnings: string[];
	errors?: string[];
}> {
	const processed = await processImportData(jsonData);

	if (!(processed.success && processed.data)) {
		return {
			isValid: false,
			version: null,
			warnings: [],
			errors: processed.errors,
		};
	}

	const result = detectAndValidate(jsonData);
	const version = result.isValid ? result.version : null;

	return {
		isValid: true,
		version,
		caseName: processed.data.case.name,
		elementCount: processed.data.elements.length,
		evidenceLinkCount: processed.data.evidenceLinks.length,
		warnings: processed.warnings,
	};
}
