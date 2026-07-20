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

interface SortContext {
	children: Map<string, ElementV2[]>;
	inDegree: Map<string, number>;
}

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
 * Batch-resolves citedElementId values (ADR 0004 D5, review fix item 1 —
 * P2003 trace) that are NOT already covered by this import's idMap. An id
 * present in idMap is import-internal and always resolves (see
 * resolveImportedCitedElementId below); everything else names an element in
 * a DIFFERENT case (the one referenced by moduleReferenceId), so it has to
 * be checked against the target DB before the insert — the createMany FK
 * (assurance_elements_cited_element_id_fkey) rejects unresolvable rows and
 * previously took the whole import's transaction down with it.
 *
 * One findMany for the whole batch (not one query per element), run BEFORE
 * the transaction opens — keeps the transaction short per CLAUDE.md and
 * avoids doing this lookup once per createElements call.
 */
async function resolveExternalCitedElementIds(
	elements: ElementV2[],
	idMap: Map<string, string>
): Promise<Set<string>> {
	const externalIds = new Set<string>();
	for (const el of elements) {
		if (el.citedElementId && !idMap.has(el.citedElementId)) {
			externalIds.add(el.citedElementId);
		}
	}

	if (externalIds.size === 0) {
		return externalIds;
	}

	const found = await prisma.assuranceElement.findMany({
		where: { id: { in: [...externalIds] } },
		select: { id: true },
	});

	return new Set(found.map((el) => el.id));
}

/**
 * Resolves a citedElementId (ADR 0004 D5) for the createMany row.
 *
 * citedElementId names an element in the case referenced by moduleReferenceId
 * — i.e. normally a DIFFERENT case from the one being imported here, so it is
 * almost never present in this import's own idMap. Lead ruling (dispatch
 * brief, cid 2026-07-19): try the idMap first (covers the edge case where a
 * test fixture or self-contained export happens to include the cited element
 * in the same payload — then the remap keeps the reference internally
 * consistent with the new ids); otherwise PRESERVE THE ORIGINAL ID VERBATIM
 * if — and only if — resolveExternalCitedElementIds proved it actually
 * exists in the target DB.
 *
 * Review fix item 1: a preserved id that resolves NOWHERE in the target DB
 * (the away-case wasn't part of this import and doesn't exist there under
 * that id) used to hit the createMany FK and roll back the entire import.
 * That is now a flagged, non-fatal outcome: citedElementId is dropped to
 * null and citationDangling is set, matching the existing detach/delete
 * dangling-citation contract in element-service.ts.
 */
function resolveImportedCitedElementId(
	citedElementId: string | null | undefined,
	idMap: Map<string, string>,
	resolvedExternalIds: Set<string>
): { citedElementId: string | null; citationDangling: boolean } {
	if (!citedElementId) {
		return { citedElementId: null, citationDangling: false };
	}

	const remapped = idMap.get(citedElementId);
	if (remapped) {
		return { citedElementId: remapped, citationDangling: false };
	}

	if (resolvedExternalIds.has(citedElementId)) {
		return { citedElementId, citationDangling: false };
	}

	// Unresolvable anywhere in the target DB — flag, don't fail the import.
	return { citedElementId: null, citationDangling: true };
}

/**
 * Creates all elements in the correct order (parents before children).
 */
async function createElements(
	caseId: string,
	elements: ElementV2[],
	idMap: Map<string, string>,
	resolvedExternalCitedElementIds: Set<string>,
	userId: string
): Promise<number> {
	// Sort elements topologically so parents are created before children
	const sortedElements = topologicalSort(elements);

	const data = sortedElements
		.map((el) => {
			const newId = idMap.get(el.id);
			if (!newId) {
				return null;
			}

			// Element-level citation (ADR 0004 D5) — see
			// resolveImportedCitedElementId's docstring for the
			// remap-else-preserve-verbatim-else-flag-dangling decision.
			const { citedElementId, citationDangling } =
				resolveImportedCitedElementId(
					el.citedElementId,
					idMap,
					resolvedExternalCitedElementIds
				);

			return {
				id: newId,
				caseId,
				elementType: el.elementType,
				role: el.role,
				parentId: el.parentId ? (idMap.get(el.parentId) ?? null) : null,
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
				// Per-assertion status (ADR 0004 D3) — lead ruling: import
				// PRESERVES a declared status rather than dropping it. This is a
				// direct createMany write (not through createElement/updateElement),
				// so it intentionally bypasses guardAssertionStatusWrite/
				// rejectDeclaredAsCited: import is a bulk data-load operation, not
				// an author declaring a NEW status, and the source data already
				// passed through export's own AS_CITED derivation.
				assertionStatus: el.assertionStatus,
				citedElementId,
				citationDangling,
				createdById: userId,
			};
		})
		.filter((d) => d !== null);

	await prisma.assuranceElement.createMany({ data });

	return data.length;
}

/**
 * Creates all evidence links using the new ID mappings.
 * Note: EvidenceLink only has evidenceId and claimId - no caseId.
 */
async function createEvidenceLinks(
	links: CaseExportV2["evidenceLinks"],
	idMap: Map<string, string>
): Promise<number> {
	const data = links
		.map((link) => {
			const evidenceId = idMap.get(link.evidenceId);
			const claimId = idMap.get(link.claimId);
			if (evidenceId && claimId) {
				return { evidenceId, claimId };
			}
			return null;
		})
		.filter((d) => d !== null);

	await prisma.evidenceLink.createMany({ data });

	return data.length;
}

/**
 * Creates comments for all elements that have them.
 */
async function createComments(
	elements: ElementV2[],
	idMap: Map<string, string>,
	userId: string
): Promise<number> {
	const data: {
		elementId: string;
		authorId: string;
		content: string;
		createdAt: Date;
	}[] = [];

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

			data.push({
				elementId,
				authorId: userId,
				content: comment.content,
				createdAt,
			});
		}
	}

	if (data.length > 0) {
		await prisma.comment.createMany({ data });
	}

	return data.length;
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

		// Review fix item 1: batch-resolve external citedElementIds against the
		// target DB BEFORE opening the transaction — keeps the transaction
		// short and means the createMany insert never has to guess.
		const resolvedExternalCitedElementIds =
			await resolveExternalCitedElementIds(v2Data.elements, idMap);

		// Use a transaction to ensure atomicity
		const result = await prisma.$transaction(async () => {
			// Create case
			const caseId = await createCaseWithPermission(v2Data.case, userId);

			// Create elements
			const elementCount = await createElements(
				caseId,
				v2Data.elements,
				idMap,
				resolvedExternalCitedElementIds,
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
