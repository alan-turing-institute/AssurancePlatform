import { prisma } from "@/lib/prisma";
import type { CaseExportV2, ElementV2 } from "@/lib/schemas/case-export";
import { detectAndValidate } from "@/lib/schemas/version-detection";

export type ImportResult =
	| {
			data: {
				caseId: string;
				caseName: string;
				elementCount: number;
				evidenceLinkCount: number;
				commentCount: number;
				warnings: string[];
			};
	  }
	| { error: string; validationErrors?: string[] };

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm) — ensures parents are created before children
// ---------------------------------------------------------------------------

type SortContext = {
	inDegree: Map<string, number>;
	children: Map<string, ElementV2[]>;
};

function initSortGraph(elements: ElementV2[]): SortContext {
	const inDegree = new Map<string, number>();
	const children = new Map<string, ElementV2[]>();

	for (const el of elements) {
		inDegree.set(el.id, 0);
		children.set(el.id, []);
	}

	for (const el of elements) {
		if (el.parentId && inDegree.has(el.parentId)) {
			inDegree.set(el.id, (inDegree.get(el.id) ?? 0) + 1);
			children.get(el.parentId)?.push(el);
		}
	}

	return { inDegree, children };
}

function processSortQueue(queue: ElementV2[], ctx: SortContext): ElementV2[] {
	const result: ElementV2[] = [];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			break;
		}

		result.push(current);

		for (const child of ctx.children.get(current.id) ?? []) {
			const newDegree = (ctx.inDegree.get(child.id) ?? 1) - 1;
			ctx.inDegree.set(child.id, newDegree);
			if (newDegree === 0) {
				queue.push(child);
			}
		}
	}

	return result;
}

/**
 * Topologically sorts elements so parents come before children.
 * Uses Kahn's algorithm.
 */
function topologicalSort(elements: ElementV2[]): ElementV2[] {
	const ctx = initSortGraph(elements);

	// Queue elements with no dependencies (roots)
	const queue = elements.filter((el) => ctx.inDegree.get(el.id) === 0);
	const result = processSortQueue(queue, ctx);

	// Handle orphaned elements (parent not in import)
	const resultIds = new Set(result.map((el) => el.id));
	const orphans = elements.filter((el) => !resultIds.has(el.id));

	return [...result, ...orphans];
}

// ---------------------------------------------------------------------------
// Import pipeline
// ---------------------------------------------------------------------------

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
	const newCase = await prisma.assuranceCase.create({
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

		await prisma.assuranceElement.create({
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
			await prisma.evidenceLink.create({
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

			await prisma.comment.create({
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
 * Accepts nested (v1.0) and flat (v2.0) formats.
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
			error: "Invalid import data",
			validationErrors: processed.errors,
		};
	}

	const v2Data = processed.data;

	try {
		// Build ID mapping
		const idMap = buildIdMap(v2Data.elements);

		// Use a transaction to ensure atomicity
		const result = await prisma.$transaction(async () => {
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
			data: {
				...result,
				warnings: processed.warnings,
			},
		};
	} catch (error) {
		console.error("Failed to import case:", error);
		return { error: "Failed to import case" };
	}
}

/**
 * Validates import data without creating anything.
 * Useful for preview/confirmation UI.
 */
export async function validateImportData(jsonData: unknown): Promise<{
	isValid: boolean;
	version: "flat" | "nested" | null;
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
