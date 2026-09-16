import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import type { CaseExportV2, ElementV2 } from "@/lib/schemas/case-export";
import { validateElementName } from "@/lib/schemas/element-validation";
import { detectAndValidate } from "@/lib/schemas/version-detection";
import { resetIdentifiers } from "@/lib/services/identifier-service";
import { getEnabledPluginIdsForUser } from "@/lib/services/plugin-enablement-service";
import { Prisma } from "@/src/generated/prisma";

const log = logger.child({ component: "case-import-service" });

// Derived from `prisma.$transaction`'s own callback parameter — same pattern
// as `publish-service.ts` / `slug-service.ts` (kept local rather than
// imported: `Prisma.TransactionClient` does not structurally match this
// project's `.$extends()`-wrapped client from `lib/prisma.ts`).
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

/**
 * Prisma-compatible client that can run queries: either the global `prisma`
 * singleton (for calls made before/outside the import's transaction) or the
 * transaction-scoped `tx` client (for calls made from inside it). Used by
 * `resolveExternalCitedElementIds`, which is called both ways — once before
 * `prisma.$transaction` opens (keeps the transaction short) and once more,
 * against `tx`, from inside `createElements`' resolve-window race backstop.
 */
type PrismaLikeClient = typeof prisma | TransactionClient;

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
	tx: TransactionClient,
	caseData: CaseExportV2["case"],
	userId: string
): Promise<string> {
	const newCase = await tx.assuranceCase.create({
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
 * Returns id -> caseId (not just a Set of resolved ids) — citation integrity
 * follow-up, 2026-09-16: resolveImportedCitedElementId needs the resolved
 * element's OWN case to enforce the same case-membership rule element-
 * service.ts's validateCitedElementId does (an away goal's citedElementId
 * must belong to the case its moduleReferenceId names), not just prove the
 * id exists somewhere.
 *
 * `deletedAt: null` (vincent's review of 281faccf, 2026-09-16 — BLOCKER):
 * without it, a citedElementId naming a soft-deleted element in the right
 * case resolved as a valid citation here — citationDangling stayed false —
 * even though buildCitationContext (case-fetch-service.ts) filters
 * deletedAt: null when resolving the name to show on the card, so the away
 * goal rendered with a case name, no element name, and no dangling flag.
 * Matches validateCitedElementId's own `deletedAt: null` filter (the edit-
 * path rule this import path mirrors).
 *
 * One findMany for the whole batch (not one query per element), run BEFORE
 * the transaction opens — keeps the transaction short per CLAUDE.md and
 * avoids doing this lookup once per createElements call.
 *
 * Also reused (a second time, with a fresh query) by createElements' resolve-
 * window race backstop: if an id resolved here is deleted before the insert
 * actually runs, re-calling this same function after that P2003 correctly
 * comes back without it — see createElements' docstring.
 *
 * Takes a `client` (global `prisma` for the pre-transaction call in
 * `importCase`, or the transaction-scoped `tx` for the in-transaction retry
 * inside `createElements`) rather than being duplicated per call site.
 */
async function resolveExternalCitedElementIds(
	client: PrismaLikeClient,
	elements: ElementV2[],
	idMap: Map<string, string>
): Promise<Map<string, string>> {
	const externalIds = new Set<string>();
	for (const el of elements) {
		if (el.citedElementId && !idMap.has(el.citedElementId)) {
			externalIds.add(el.citedElementId);
		}
	}

	if (externalIds.size === 0) {
		return new Map();
	}

	const found = await client.assuranceElement.findMany({
		where: { id: { in: [...externalIds] }, deletedAt: null },
		select: { id: true, caseId: true },
	});

	return new Map(found.map((el) => [el.id, el.caseId]));
}

/**
 * Batch-resolves moduleReferenceId values (ADR 0004 D5 / D3 — "TEA — Import
 * fails outright when an away goal or module cites a case absent from the
 * target environment", Chris's ruling 2026-09-16: degrade and flag, mirroring
 * citedElementId exactly) against the target DB's cases, run BEFORE the
 * transaction opens (same reason as resolveExternalCitedElementIds above).
 * moduleReferenceId names a CASE, never an id in this import's own idMap
 * (idMap only maps ELEMENT ids) — every non-null value is checked. A
 * moduleReferenceId that doesn't resolve here would otherwise hit the
 * createMany FK (assurance_elements_module_reference_id_fkey) and roll back
 * the whole import, the exact failure this ruling replaces.
 */
async function resolveExternalModuleReferenceIds(
	client: PrismaLikeClient,
	elements: ElementV2[]
): Promise<Set<string>> {
	const caseIds = new Set<string>();
	for (const el of elements) {
		if (el.moduleReferenceId) {
			caseIds.add(el.moduleReferenceId);
		}
	}

	if (caseIds.size === 0) {
		return caseIds;
	}

	const found = await client.assuranceCase.findMany({
		where: { id: { in: [...caseIds] }, deletedAt: null },
		select: { id: true },
	});

	return new Set(found.map((c) => c.id));
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
 *
 * Case-membership check (citation integrity follow-up, 2026-09-16): the same
 * rule element-service.ts's validateCitedElementId enforces on the edit
 * path — an away goal's citedElementId must belong to the case its
 * moduleReferenceId names — applied here as blank-and-flag instead of
 * reject, since import is non-fatal by design. `effectiveModuleReferenceId`
 * is the ALREADY-RESOLVED value (see resolveImportedModuleReferenceId):
 * when it's null — no case, whether the source data never named one or
 * moduleReferenceId itself didn't resolve in this environment — a
 * citedElementId cannot be valid, mirroring validateCitedElementId's
 * unconditional rejection when moduleReferenceId is falsy (ADR 0004 D5
 * round-3 security fix). `newCaseId` is this import's own freshly-created
 * case: when citedElementId remaps through idMap (the cited element is
 * ALSO part of this import), its post-import case IS newCaseId, so that's
 * what effectiveModuleReferenceId must match for the remapped case too.
 */
function resolveImportedCitedElementId(
	citedElementId: string | null | undefined,
	idMap: Map<string, string>,
	resolvedExternalCitedElementIds: Map<string, string>,
	effectiveModuleReferenceId: string | null,
	newCaseId: string
): { citedElementId: string | null; citationDangling: boolean } {
	if (!citedElementId) {
		return { citedElementId: null, citationDangling: false };
	}

	if (!effectiveModuleReferenceId) {
		// No case to belong to — flag, don't fail the import.
		return { citedElementId: null, citationDangling: true };
	}

	const remapped = idMap.get(citedElementId);
	const citedElementCaseId = remapped
		? newCaseId
		: resolvedExternalCitedElementIds.get(citedElementId);

	if (citedElementCaseId === effectiveModuleReferenceId) {
		return {
			citedElementId: remapped ?? citedElementId,
			citationDangling: false,
		};
	}

	// Unresolvable anywhere in the target DB, or resolved but in the WRONG
	// case — flag, don't fail the import.
	return { citedElementId: null, citationDangling: true };
}

/**
 * Resolves a moduleReferenceId (ADR 0004 D5 / D3, Chris's ruling 2026-09-16)
 * for the createMany row — MODULE and AWAY_GOAL both name a case they
 * reference/cite, and unlike citedElementId there is no import-internal
 * idMap to remap through (idMap only maps ELEMENT ids; the case this import
 * itself creates is a NEW id no export could have predicted). A value that
 * doesn't resolve in the target DB is dropped to null and
 * moduleReferenceDangling is set, instead of hitting the createMany FK
 * (assurance_elements_module_reference_id_fkey) and failing the whole
 * import — mirrors resolveImportedCitedElementId's degrade contract exactly.
 */
function resolveImportedModuleReferenceId(
	moduleReferenceId: string | null | undefined,
	resolvedCaseIds: Set<string>
): { moduleReferenceId: string | null; moduleReferenceDangling: boolean } {
	if (!moduleReferenceId) {
		return { moduleReferenceId: null, moduleReferenceDangling: false };
	}

	if (resolvedCaseIds.has(moduleReferenceId)) {
		return { moduleReferenceId, moduleReferenceDangling: false };
	}

	// Unresolvable in the target environment — flag, don't fail the import.
	return { moduleReferenceId: null, moduleReferenceDangling: true };
}

/**
 * Resolves a `defeatsElementId` (dialogical reasoning) for the createMany
 * row. Unlike `citedElementId`, a defeater's target always names an element
 * within the SAME import payload — dialogical reasoning has no cross-case
 * concept the way AWAY_GOAL's element-level citation does — so the only
 * lookup needed is this import's own `idMap`; there is no target-DB
 * resolution pass to run before the insert.
 *
 * Chris's ruling (2026-09-14): a `defeatsElementId` that doesn't resolve in
 * `idMap` — because the target wasn't part of this import, or the field was
 * set with no target at all — is imported anyway with the reference blanked
 * and `defeatsDangling` flagged, never rejected. Mirrors
 * `resolveImportedCitedElementId`'s non-fatal degrade-instead-of-fail
 * contract exactly.
 *
 * Self-reference (`defeatsElementId === ownId`, both in the import's
 * ORIGINAL id space, before remapping): the edit path rejects this outright
 * (`validateDefeatsElementId` — "defeatsElementId cannot reference the
 * element itself"), but import is non-fatal by design (Chris's ruling,
 * 2026-09-14 / QA round 1), so a self-referencing defeater is treated the
 * same as an unresolvable one — blanked and flagged, not rejected.
 */
function resolveImportedDefeatsElementId(
	defeatsElementId: string | null | undefined,
	ownId: string,
	idMap: Map<string, string>
): { defeatsElementId: string | null; defeatsDangling: boolean } {
	if (!defeatsElementId) {
		return { defeatsElementId: null, defeatsDangling: false };
	}

	if (defeatsElementId === ownId) {
		return { defeatsElementId: null, defeatsDangling: true };
	}

	const remapped = idMap.get(defeatsElementId);
	if (remapped) {
		return { defeatsElementId: remapped, defeatsDangling: false };
	}

	// Unresolvable within this import — flag, don't fail the import.
	return { defeatsElementId: null, defeatsDangling: true };
}

/**
 * Foreign key constraint name for `citedElementId` (see the ADR 0004 D5
 * migration, `assurance_elements_cited_element_id_fkey`). Anchoring the P2003
 * catch below to this exact constraint name — rather than treating any
 * P2003 from this insert as recoverable — matters because the same
 * `createMany` call also carries `caseId`, `parentId`, `defeatsElementId`
 * (populated by `resolveImportedDefeatsElementId`'s idMap-remap-or-null-and-
 * flag below — same-case reference only, so this FK should never actually
 * fire from our own resolved rows) foreign keys: a P2003 on any of THOSE
 * means real corrupt/inconsistent import data and must still fail the whole
 * import loudly, not be silently downgraded. `moduleReferenceId` is no
 * longer in that list (citation integrity follow-up, 2026-09-16): it is now
 * pre-resolved by `resolveExternalModuleReferenceIds`/
 * `resolveImportedModuleReferenceId` the same way `citedElementId` is, so an
 * ordinary "case absent from this environment" import never reaches the
 * insert with an unresolved value. A P2003 on it now would mean the same
 * resolve-window race this catch already exists for (narrower: this module
 * doesn't backstop-retry that specific race, only citedElementId's) — still
 * correctly falls through to `throw error` below and fails the import, which
 * is the same fail-loud outcome a genuine data-corruption P2003 needs.
 */
const CITED_ELEMENT_ID_FK_CONSTRAINT =
	"assurance_elements_cited_element_id_fkey";

/**
 * True when `error` is the specific FK violation this module knows how to
 * recover from: a `citedElementId` that pointed at a real row when
 * `resolveExternalCitedElementIds` checked it, but was deleted before this
 * `createMany` actually ran (the resolve-window race — see `createElements`'
 * docstring). Matches on the Postgres constraint name Prisma echoes into the
 * error message (verified against a live P2003: `error.message` contains
 * "Foreign key constraint violated on the constraint: `<name>`"), not on
 * `error.meta`'s shape, which is adapter-internal and not a stable contract.
 */
export function isCitedElementIdForeignKeyError(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2003" &&
		error.message.includes(CITED_ELEMENT_ID_FK_CONSTRAINT)
	);
}

/**
 * Import warnings (TEA — citation integrity + import degrade follow-up,
 * 2026-09-16, Chris agreed): one warning per reference this import cleared,
 * naming the CLEARING element by its identifier (`el.name` — TEA-syntax
 * identifiers like AG1/CP1 are always app-assigned, per D8). Without this,
 * `resolveImportedDefeatsElementId`/`resolveImportedCitedElementId`/
 * `resolveImportedModuleReferenceId` set their dangling flags silently — the
 * import-modal's "Continue to case" hold-open (#963) only triggers on a
 * non-empty `warnings` array, so a user importing a stale/cross-environment
 * export learned of a lost reference only from a missing edge on the canvas
 * (staging re-run 2026-09-16, finding 7). Deliberately independent per axis:
 * a defeater warning and a citation-axis warning can both fire for the same
 * element (unrelated fields), but the citation axis fires AT MOST ONE of its
 * two messages — when moduleReferenceDangling is set, the citation is a
 * DIRECT CONSEQUENCE of the absent case, not a second independent finding,
 * so only the module-reference message is pushed.
 */
function collectDegradeWarnings(
	el: ElementV2,
	citationDangling: boolean,
	moduleReferenceDangling: boolean,
	defeatsDangling: boolean
): string[] {
	const name = el.name ?? "element";
	const warnings: string[] = [];
	if (defeatsDangling) {
		warnings.push(
			`${name}: challenge target not found in this file; the reference has been cleared`
		);
	}
	if (moduleReferenceDangling) {
		warnings.push(
			`${name}: cited case not available in this environment; the reference has been cleared`
		);
	} else if (citationDangling) {
		warnings.push(
			`${name}: cited element not found; the reference has been cleared`
		);
	}
	return warnings;
}

/**
 * Builds the createMany row (plus any degrade warnings) for one element,
 * resolving its moduleReferenceId against the given (already-resolved) case
 * set, its citedElementId against that EFFECTIVE moduleReferenceId and the
 * (already-resolved) external cited-element map, and its defeatsElementId
 * against the import's own idMap. Extracted from createElements so the
 * resolve-window race backstop there can rebuild rows a second time, against
 * a freshly re-resolved set, without duplicating the per-row field mapping.
 *
 * Resolution order matters: moduleReferenceId resolves FIRST because
 * resolveImportedCitedElementId needs the EFFECTIVE (post-degrade) value —
 * an away goal's citedElementId cannot be valid without its case, so a
 * dangling moduleReferenceId cascades into a dangling citation too (Chris's
 * ruling, 2026-09-16).
 */
function buildElementRow(
	el: ElementV2,
	idMap: Map<string, string>,
	resolvedExternalCitedElementIds: Map<string, string>,
	resolvedModuleReferenceCaseIds: Set<string>,
	caseId: string,
	userId: string
) {
	const newId = idMap.get(el.id);
	if (!newId) {
		return null;
	}

	// Module reference (MODULE/AWAY_GOAL) — see
	// resolveImportedModuleReferenceId's docstring for the
	// preserve-verbatim-else-flag-dangling decision (Chris's ruling,
	// 2026-09-16).
	const { moduleReferenceId, moduleReferenceDangling } =
		resolveImportedModuleReferenceId(
			el.moduleReferenceId,
			resolvedModuleReferenceCaseIds
		);

	// Element-level citation (ADR 0004 D5) — see
	// resolveImportedCitedElementId's docstring for the
	// remap-else-preserve-verbatim-else-flag-dangling decision, and for why
	// this uses the EFFECTIVE (already-degraded) moduleReferenceId above.
	const { citedElementId, citationDangling } = resolveImportedCitedElementId(
		el.citedElementId,
		idMap,
		resolvedExternalCitedElementIds,
		moduleReferenceId,
		caseId
	);

	// Dialogical reasoning (defeaters) — see
	// resolveImportedDefeatsElementId's docstring for the
	// remap-else-flag-dangling decision (Chris's ruling, 2026-09-14).
	const { defeatsElementId, defeatsDangling } = resolveImportedDefeatsElementId(
		el.defeatsElementId,
		el.id,
		idMap
	);

	const warnings = collectDegradeWarnings(
		el,
		citationDangling,
		moduleReferenceDangling,
		defeatsDangling
	);

	const row = {
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
		moduleReferenceId,
		moduleReferenceDangling,
		// Dialogical reasoning (defeaters) — see
		// resolveImportedDefeatsElementId's docstring above for the
		// remap-else-flag-dangling decision.
		isDefeater: el.isDefeater ?? false,
		defeatsElementId,
		defeatsDangling,
		createdById: userId,
	};

	return { row, warnings };
}

type ElementRow = NonNullable<ReturnType<typeof buildElementRow>>["row"];

function buildElementRows(
	sortedElements: ElementV2[],
	idMap: Map<string, string>,
	resolvedExternalCitedElementIds: Map<string, string>,
	resolvedModuleReferenceCaseIds: Set<string>,
	caseId: string,
	userId: string
): { rows: ElementRow[]; warnings: string[] } {
	const rows: ElementRow[] = [];
	const warnings: string[] = [];
	for (const el of sortedElements) {
		const built = buildElementRow(
			el,
			idMap,
			resolvedExternalCitedElementIds,
			resolvedModuleReferenceCaseIds,
			caseId,
			userId
		);
		if (!built) {
			continue;
		}
		rows.push(built.row);
		warnings.push(...built.warnings);
	}
	return { rows, warnings };
}

/**
 * Creates all elements in the correct order (parents before children).
 *
 * Resolve-window race backstop: `resolveExternalCitedElementIds` (called by
 * `importCase` before this function runs) confirms each external
 * citedElementId exists, but that check and this insert are not atomic —
 * the cited element can be deleted in between. Before this fix, that raced
 * insert would throw a raw P2003 on `assurance_elements_cited_element_id_fkey`
 * and roll back the ENTIRE import (case, unrelated elements, everything),
 * for a single citation that should just degrade to dangling like the
 * already-unresolvable case review fix item 1 handles. The catch below is
 * the backstop: on exactly that FK error, re-resolve the external
 * citedElementIds against the DB (this time the raced-away id correctly
 * comes back unresolved), rebuild the rows, and retry the insert once. A
 * P2003 on any OTHER foreign key (caseId, parentId, defeatsElementId, or the
 * narrower resolve-window race on moduleReferenceId this module does not
 * backstop — see the CITED_ELEMENT_ID_FK_CONSTRAINT docstring above) — or a
 * second failure on retry — is not this module's to recover from and
 * propagates, failing the import as before.
 *
 * SAVEPOINT/ROLLBACK TO SAVEPOINT around the first attempt (verified against
 * a real Postgres, see case-import-service.test.ts and the issue writeup):
 * now that this whole import runs inside one real `prisma.$transaction`,
 * Postgres aborts the transaction on ANY error — including the P2003 this
 * catch recovers from — and every statement after an aborted-but-uncaught-
 * at-the-database-level error fails with `25P02 current transaction is
 * aborted` until the transaction ends. Catching the P2003 in JS is not
 * enough to make the connection usable again. A `SAVEPOINT` taken
 * immediately before the first `createMany` gives the retry somewhere to
 * roll back to — `ROLLBACK TO SAVEPOINT` undoes exactly (and only) the
 * failed insert, clears the aborted state, and lets the retry's `createMany`
 * run on the same transaction. This also removes the createMany-chunking
 * caveat noted at the fix's original review (2026-07-20): the retry
 * re-inserts the entire element row set, which was previously safe only
 * because `createMany` happened to be a single non-transactional INSERT — if
 * a future change chunked it into several statements, a partial success
 * before the failing chunk would have already committed under the old
 * auto-commit-per-statement code. Under this savepoint, nothing commits
 * until the OUTER transaction commits, so `ROLLBACK TO SAVEPOINT` undoes
 * every chunk executed since the savepoint was taken, not just the one that
 * failed — chunking `createMany` in future would remain safe to retry
 * whole-batch without re-introducing this caveat.
 */
async function createElements(
	tx: TransactionClient,
	caseId: string,
	elements: ElementV2[],
	idMap: Map<string, string>,
	resolvedExternalCitedElementIds: Map<string, string>,
	resolvedModuleReferenceCaseIds: Set<string>,
	userId: string
): Promise<{ count: number; warnings: string[] }> {
	// Sort elements topologically so parents are created before children
	const sortedElements = topologicalSort(elements);

	const { rows: data, warnings } = buildElementRows(
		sortedElements,
		idMap,
		resolvedExternalCitedElementIds,
		resolvedModuleReferenceCaseIds,
		caseId,
		userId
	);

	// Savepoint name is generated internally (crypto.randomUUID, never
	// user input) so interpolating it into raw SQL carries no injection
	// risk; Prisma has no parameterised SAVEPOINT API.
	const savepoint = `import_elements_${crypto.randomUUID().replaceAll("-", "_")}`;
	await tx.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);

	let finalCount = data.length;
	let finalWarnings = warnings;
	try {
		await tx.assuranceElement.createMany({ data });
		// Success path: deliberately not RELEASE-ing the savepoint here.
		// Postgres releases it automatically when the enclosing
		// transaction commits; an explicit RELEASE could race with a
		// later ROLLBACK TO SAVEPOINT issued by another helper further
		// down the import chain. Do not "fix" this by adding one.
	} catch (error) {
		if (!isCitedElementIdForeignKeyError(error)) {
			throw error;
		}

		// Undo the failed insert and clear the transaction's aborted state
		// before issuing any further statement on this connection.
		await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);

		const reResolvedExternalCitedElementIds =
			await resolveExternalCitedElementIds(tx, elements, idMap);
		const retry = buildElementRows(
			sortedElements,
			idMap,
			reResolvedExternalCitedElementIds,
			resolvedModuleReferenceCaseIds,
			caseId,
			userId
		);
		// Read the retry's OWN row/warning counts (vincent's nit, 2026-09-16)
		// rather than the pre-retry `data`/`warnings` — equal in practice
		// (the retry only ever nulls one already-degraded citation, never
		// adds or drops a row), but reading the retry's own result reads as
		// correct rather than merely coincidentally equal.
		finalCount = retry.rows.length;
		finalWarnings = retry.warnings;
		await tx.assuranceElement.createMany({ data: retry.rows });
	}

	return { count: finalCount, warnings: finalWarnings };
}

/**
 * Creates all evidence links using the new ID mappings.
 * Note: EvidenceLink only has evidenceId and claimId - no caseId.
 */
async function createEvidenceLinks(
	tx: TransactionClient,
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

	await tx.evidenceLink.createMany({ data });

	return data.length;
}

/**
 * Creates comments for all elements that have them.
 */
async function createComments(
	tx: TransactionClient,
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
		await tx.comment.createMany({ data });
	}

	return data.length;
}

/**
 * Whether ANY imported defeater element's name is a LEGACY plain-form TEA-
 * syntax identifier for its type (Chris's ruling, 2026-09-15 — D8 of ADR
 * 0005): an export made before that ruling can carry a defeater still named
 * in the plain form (e.g. a property-claim defeater named "P1.1" rather
 * than "CP1"). Deliberately narrow in TWO ways: it only looks at defeaters,
 * never at plain elements, and within defeaters it only flags a name that
 * validates as a PLAIN identifier for the type (fails the defeater form,
 * passes the plain form) — an arbitrary free-text name (fails both forms,
 * e.g. test/demo fixtures like "Defeater Claim") is left untouched, exactly
 * as import already leaves every other non-conforming name untouched
 * (import does not otherwise validate name format for any element type —
 * see `buildElementRow`, which writes `el.name` verbatim).
 */
async function hasNonConformingDefeaterNames(
	userId: string,
	elements: ElementV2[]
): Promise<boolean> {
	const defeaters = elements.filter((el) => el.isDefeater && el.name);
	if (defeaters.length === 0) {
		return false;
	}
	const enabledPluginIds = await getEnabledPluginIdsForUser(userId);
	return defeaters.some((el) => {
		const asDefeaterName = validateElementName(
			el.elementType,
			el.name,
			enabledPluginIds,
			true
		);
		if (asDefeaterName.valid) {
			return false;
		}
		const asPlainName = validateElementName(
			el.elementType,
			el.name,
			enabledPluginIds,
			false
		);
		return asPlainName.valid;
	});
}

/**
 * Import decision (Chris's ruling on the naming-class issue, 2026-09-15,
 * recorded on "TEA — Defeater identifiers follow GSN"): rather than reject
 * an older export whose defeaters are named in the pre-D8 plain form,
 * renumber the WHOLE just-imported case via the existing renumber action
 * (`resetIdentifiers`) — the same mechanism `update-ids` exposes in the UI.
 * This is a decision, not a discovered fact: it renames every element in
 * the imported case to keep the naming CONSISTENT end-to-end, not just the
 * offending defeaters, at the cost of also renaming already-correct plain
 * names in that one import. A fresh export made after this ruling ships
 * has conforming defeater names already, so this never fires for it and
 * every other name is preserved exactly as exported (the existing, deliberate
 * import behaviour — see `buildElementRow`). Runs OUTSIDE the import's own
 * transaction (already committed) — `resetIdentifiers` opens its own.
 * Failure is logged and surfaced as a warning, not a failed import: the
 * case and its data are already committed correctly, just not renumbered.
 */
async function renumberIfDefeaterNamesNonConforming(
	userId: string,
	caseId: string,
	elements: ElementV2[]
): Promise<string | null> {
	if (!(await hasNonConformingDefeaterNames(userId, elements))) {
		return null;
	}
	const result = await resetIdentifiers(caseId, userId);
	if ("error" in result) {
		log.error("Failed to renumber imported case with legacy defeater names", {
			caseId,
			error: result.error,
		});
		return 'This case was imported from an older export with pre-GSN defeater names (e.g. P1.1 instead of CP1) and could not be renumbered automatically — use "Reset identifiers" from the case menu.';
	}
	return "This case was imported from an older export with pre-GSN defeater names (e.g. P1.1 instead of CP1) — every identifier in the case has been renumbered to the current CP1/CG1/CE1 scheme.";
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
			await resolveExternalCitedElementIds(prisma, v2Data.elements, idMap);

		// TEA — Import fails outright when an away goal or module cites a case
		// absent from the target environment (Chris's ruling, 2026-09-16):
		// batch-resolve external moduleReferenceIds the same way, and BEFORE
		// the transaction opens for the same reason.
		const resolvedModuleReferenceCaseIds =
			await resolveExternalModuleReferenceIds(prisma, v2Data.elements);

		// Use a transaction to ensure atomicity. The callback takes the
		// transaction-scoped `tx` client and threads it through every helper
		// below — the whole import is one atomic Postgres transaction, so a
		// mid-import failure rolls back everything written so far instead of
		// leaving a partial case (each helper previously called the global
		// `prisma` singleton, which auto-commits per statement regardless of
		// this wrapper).
		// No explicit timeout/maxWait: the default 5s interactive-transaction
		// timeout is fine here because the in-transaction round-trips are
		// O(1) — a fixed ~4-6 calls (createCaseWithPermission, createElements,
		// createEvidenceLinks, createComments, plus one retry on the
		// savepoint path) — regardless of import payload size, not O(elements).
		const result = await prisma.$transaction(async (tx) => {
			// Create case
			const caseId = await createCaseWithPermission(tx, v2Data.case, userId);

			// Create elements
			const { count: elementCount, warnings: elementWarnings } =
				await createElements(
					tx,
					caseId,
					v2Data.elements,
					idMap,
					resolvedExternalCitedElementIds,
					resolvedModuleReferenceCaseIds,
					userId
				);

			// Create evidence links
			const evidenceLinkCount = await createEvidenceLinks(
				tx,
				v2Data.evidenceLinks,
				idMap
			);

			// Create comments for elements that have them
			const commentCount = await createComments(
				tx,
				v2Data.elements,
				idMap,
				userId
			);

			return {
				caseId,
				caseName: v2Data.case.name,
				elementCount,
				evidenceLinkCount,
				commentCount,
				elementWarnings,
			};
		});

		// Renumber-on-mismatch (Chris's ruling, 2026-09-15 — D8 of ADR 0005):
		// runs after the transaction commits, since it opens its own.
		const renumberWarning = await renumberIfDefeaterNamesNonConforming(
			userId,
			result.caseId,
			v2Data.elements
		);

		const { elementWarnings, ...resultData } = result;
		return {
			data: {
				...resultData,
				warnings: renumberWarning
					? [...processed.warnings, ...elementWarnings, renumberWarning]
					: [...processed.warnings, ...elementWarnings],
			},
		};
	} catch (error) {
		log.error("Failed to import case", { error });
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
