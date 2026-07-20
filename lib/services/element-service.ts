import { toPrefix, toPrismaType } from "@/lib/element-types";
import { prisma } from "@/lib/prisma";
import type {
	CreateElementSchemaOutput,
	UpdateElementSchemaOutput,
} from "@/lib/schemas/element";
import {
	fieldAppliesTo,
	fieldRequiredFor,
} from "@/lib/schemas/element-validation";
import { transformToResponse } from "@/lib/transforms/element-response";
import {
	getDeletedDescendantIds,
	getDescendantIds,
	type TxClient,
} from "@/lib/utils/tree-traversal";
import type {
	AssertionStatus,
	PermissionLevel,
	ElementType as PrismaElementType,
} from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

/**
 * Create element input — extends the Zod schema output with API-layer fields
 * that are not part of the validation schema (caseId, elementType, description aliases).
 */
export type CreateElementInput = CreateElementSchemaOutput & {
	caseId: string;
	elementType: string;
	shortDescription?: string;
	longDescription?: string;
};

/**
 * Update element input — derived directly from the Zod schema output.
 */
export type UpdateElementInput = UpdateElementSchemaOutput;

export interface ElementResponse {
	assertionStatus?: AssertionStatus | null;
	assumption?: string;
	assuranceCaseId: string;
	// Dangling-citation indicator: true when citedElementId was nullified
	// because the cited element was deleted/detached (see deleteElement /
	// detachElement below). Omitted (not false) when there is nothing to flag.
	citationDangling?: boolean;
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only
	citedElementId?: string | null;
	comments?: unknown[];
	context?: string[];
	createdDate: string;
	description: string;
	goalId?: string | null;
	id: string;
	inSandbox: boolean;
	justification?: string;
	level?: number;
	// Module reference (MODULE/AWAY_GOAL only) — names the referenced case
	moduleReferenceId?: string | null;
	name: string;
	propertyClaimId?: string | string[] | null;
	strategyId?: string | null;
	type: string;
	URL?: string;
	urls?: string[];
}

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
 * ADR 0004 D3 write rule: `assertionStatus` is author-declared and must
 * never be machine-overwritten. Case-level permission (`validateCaseAccess`)
 * is necessary but not sufficient — an integration's system user can hold a
 * genuine EDIT grant on a case (`grantIntegrationCaseAccess`) and would
 * otherwise pass that check identically to a human author. This is the
 * dedicated, defense-in-depth check that keeps the standard element
 * mutation path (`createElement`/`updateElement`) as the ONLY route that can
 * set the field, regardless of what future machine/plugin routes end up
 * calling into this service. Returns an error string (matching this
 * service's `ServiceResult` convention) when the acting user is a system
 * user; `undefined` when the write may proceed.
 */
async function guardAssertionStatusWrite(
	userId: string
): Promise<string | undefined> {
	const actor = await prisma.user.findUnique({
		where: { id: userId },
		select: { isSystemUser: true },
	});
	if (actor?.isSystemUser) {
		return "Permission denied: assertionStatus can only be set by a case author, not a machine or integration principal";
	}
	return;
}

/**
 * ADR 0004 D5: `citedElementId` is applicable to AWAY_GOAL only. On create,
 * the elementType is always known and the Prisma extension's
 * `cleanElementDataForType` (lib/prisma.ts) would silently strip an
 * inapplicable value anyway — but a silent drop is a worse UX than an
 * explicit rejection, so this is checked here too for a consistent error on
 * both routes. On update, `buildUpdateData` never puts `elementType` in the
 * Prisma payload, so the extension's cleaning step is a no-op there — this
 * check is the ONLY enforcement point on the update path.
 */
function rejectCitedElementIdIfNotApplicable(
	elementType: string,
	citedElementId: string | null | undefined
): string | undefined {
	if (citedElementId === undefined) {
		return;
	}
	if (!fieldAppliesTo("citedElementId", elementType)) {
		return "citedElementId is only applicable to AWAY_GOAL elements";
	}
	return;
}

/**
 * ADR 0004 D3: AS_CITED is transitively DERIVED by the exporter from the
 * cited element's own status (see build-tree.ts) — it is never author-
 * declared. This is a value constraint (applies to every acting principal,
 * including a genuine human author), so it is checked independently of
 * `guardAssertionStatusWrite`, which is a principal constraint. No live
 * exploit today (the D5 auto-derivation work hasn't landed), but the write
 * rule must hold before these routes open to authors.
 */
function rejectDeclaredAsCited(
	status: AssertionStatus | null | undefined
): string | undefined {
	if (status === "AS_CITED") {
		return "assertionStatus cannot be set to AS_CITED: it is derived automatically from the cited element's status, not author-declared";
	}
	return;
}

/**
 * ADR 0004 D5: `citedElementId` must reference an existing, non-deleted
 * element, and an element cannot cite itself. `ownElementId` is only
 * available (and only checked) on update — a not-yet-created element has no
 * id to collide with.
 */
async function validateCitedElementId(
	citedElementId: string | null | undefined,
	ownElementId?: string
): Promise<string | undefined> {
	if (!citedElementId) {
		return;
	}
	if (ownElementId && citedElementId === ownElementId) {
		return "citedElementId cannot reference the element itself";
	}
	const target = await prisma.assuranceElement.findFirst({
		where: { id: citedElementId, deletedAt: null },
		select: { id: true },
	});
	if (!target) {
		return "citedElementId must reference an existing element";
	}
	return;
}

/**
 * ADR 0004 D5: runs both citedElementId guards (applicability, then
 * existence/self-citation) in the order createElement and updateElement both
 * need — extracted so the checks live in exactly one place instead of being
 * duplicated verbatim at each call site. `ownElementId` is only meaningful
 * on update (see validateCitedElementId above).
 */
async function enforceCitedElementIdRules(
	elementType: string,
	citedElementId: string | null | undefined,
	ownElementId?: string
): Promise<string | undefined> {
	if (citedElementId === undefined) {
		return;
	}
	const applicabilityError = rejectCitedElementIdIfNotApplicable(
		elementType,
		citedElementId
	);
	if (applicabilityError) {
		return applicabilityError;
	}
	return await validateCitedElementId(citedElementId, ownElementId);
}

/**
 * `moduleReferenceId` is applicable to MODULE and AWAY_GOAL only
 * (FIELD_APPLICABILITY, lib/schemas/element-validation.ts). Checked whenever
 * the field is explicitly present in the input, mirroring
 * `rejectCitedElementIdIfNotApplicable` above — a silent drop is a worse UX
 * than an explicit rejection, and the single-element route has no
 * discriminated-union schema (unlike the batch path's AwayGoalSchema/
 * ModuleSchema) to lean on for this.
 */
function rejectModuleReferenceIdIfNotApplicable(
	elementType: string,
	moduleReferenceId: string | null | undefined
): string | undefined {
	if (moduleReferenceId === undefined) {
		return;
	}
	if (!fieldAppliesTo("moduleReferenceId", elementType)) {
		return "moduleReferenceId is only applicable to MODULE and AWAY_GOAL elements";
	}
	return;
}

/**
 * `moduleReferenceId` is required for MODULE and AWAY_GOAL on create
 * (REQUIRED_FIELDS, lib/schemas/element-validation.ts — the same rule the
 * batch path enforces via AwayGoalSchema/ModuleSchema's non-optional
 * `z.string().uuid()`). Create-only: the batch UPDATE path
 * (case-batch-update-service.ts) allows changing/clearing the field without
 * a requiredness guard, so `updateElement` below does not call this.
 */
function rejectMissingModuleReferenceId(
	elementType: string,
	moduleReferenceId: string | null | undefined
): string | undefined {
	if (!fieldRequiredFor("moduleReferenceId", elementType)) {
		return;
	}
	if (!moduleReferenceId) {
		return "moduleReferenceId is required for MODULE and AWAY_GOAL elements";
	}
	return;
}

/**
 * `moduleReferenceId` must reference an existing, non-trashed case.
 * Mirrors `validateCitedElementId`'s existence check (ADR 0004 D5) — the
 * batch path relies on the DB foreign key to reject a bad reference (which
 * would surface as an opaque 500), so this route holds itself to the
 * stricter, already-established precedent instead.
 */
async function validateModuleReferenceId(
	moduleReferenceId: string | null | undefined
): Promise<string | undefined> {
	if (!moduleReferenceId) {
		return;
	}
	const target = await prisma.assuranceCase.findFirst({
		where: { id: moduleReferenceId, deletedAt: null },
		select: { id: true },
	});
	if (!target) {
		return "moduleReferenceId must reference an existing case";
	}
	return;
}

/**
 * Runs the moduleReferenceId guards (applicability, then — create only —
 * requiredness, then existence) in the order createElement and updateElement
 * both need. Mirrors `enforceCitedElementIdRules`'s extraction rationale.
 */
async function enforceModuleReferenceIdRules(
	elementType: string,
	moduleReferenceId: string | null | undefined,
	options: { requireOnCreate: boolean }
): Promise<string | undefined> {
	const applicabilityError = rejectModuleReferenceIdIfNotApplicable(
		elementType,
		moduleReferenceId
	);
	if (applicabilityError) {
		return applicabilityError;
	}
	if (options.requireOnCreate) {
		const requiredError = rejectMissingModuleReferenceId(
			elementType,
			moduleReferenceId
		);
		if (requiredError) {
			return requiredError;
		}
	}
	return await validateModuleReferenceId(moduleReferenceId);
}

/**
 * ADR 0004 D3: runs both assertionStatus write guards (value constraint via
 * `rejectDeclaredAsCited`, then principal constraint via
 * `guardAssertionStatusWrite`) in the order createElement and updateElement
 * both need — extracted so the checks live in exactly one place instead of
 * being duplicated verbatim at each call site (mirrors
 * `enforceCitedElementIdRules` above, and keeps both mutation paths under
 * the cognitive-complexity budget). Exported so other write surfaces that
 * must obey the same D3 rule (currently: case-batch-update-service.ts) can
 * reuse it rather than re-implementing the principal/value checks.
 */
export async function enforceAssertionStatusRules(
	assertionStatus: AssertionStatus | null | undefined,
	userId: string
): Promise<string | undefined> {
	if (assertionStatus === undefined) {
		return;
	}
	const citedError = rejectDeclaredAsCited(assertionStatus);
	if (citedError) {
		return citedError;
	}
	return await guardAssertionStatusWrite(userId);
}

/**
 * Resolves parent ID from input.
 * Returns undefined if no parent field is specified (to distinguish from explicitly setting null).
 */
function resolveParentId(
	input: CreateElementInput | UpdateElementInput
): string | null | undefined {
	// Direct parentId takes precedence - return exactly what's provided (including null)
	if ("parentId" in input && input.parentId !== undefined) {
		return input.parentId;
	}

	// Return undefined to indicate no parent field was specified
	// (different from null which means explicitly clearing the parent)
	return;
}

/**
 * Resolves URLs from input, handling both legacy single URL and new array format.
 * Returns both the legacy url field and the urls array for backward compatibility.
 */
function resolveUrls(input: CreateElementInput | UpdateElementInput): {
	url: string | null;
	urls: string[];
} {
	const legacyUrl = input.url || input.URL;

	if (input.urls && input.urls.length > 0) {
		return { url: input.urls[0] ?? null, urls: input.urls };
	}
	if (legacyUrl) {
		return { url: legacyUrl, urls: [legacyUrl] };
	}
	return { url: null, urls: [] };
}

/**
 * Applies URL updates to the update data object if any URL fields are provided.
 */
function applyUrlUpdates(
	input: UpdateElementInput,
	updateData: Record<string, unknown>
): void {
	if (input.urls !== undefined) {
		updateData.urls = input.urls;
		updateData.url = input.urls.length > 0 ? input.urls[0] : null;
	} else if (input.url !== undefined || input.URL !== undefined) {
		const singleUrl = input.url ?? input.URL;
		updateData.url = singleUrl;
		updateData.urls = singleUrl ? [singleUrl] : [];
	}
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
	const prefix = toPrefix(elementType);

	// Property claims with a property claim parent get hierarchical names (P1.1, P1.1.1)
	if (
		elementType === "PROPERTY_CLAIM" &&
		parentInfo?.elementType === "PROPERTY_CLAIM" &&
		parentInfo.name
	) {
		// Count existing siblings under the same parent (efficient indexed query)
		const siblingCount = await prisma.assuranceElement.count({
			where: {
				parentId,
				elementType: "PROPERTY_CLAIM",
				deletedAt: null,
			},
		});
		return `${parentInfo.name}.${siblingCount + 1}`;
	}

	// Property claims under a strategy: transparent numbering
	// If the strategy's parent is a property claim, number as a child of that ancestor claim.
	// If the strategy's parent is a goal, fall through to top-level numbering below.
	if (
		elementType === "PROPERTY_CLAIM" &&
		parentId &&
		parentInfo?.elementType === "STRATEGY"
	) {
		// Look up the strategy's parent (one hop — strategies can't be under other strategies)
		const grandparent = await prisma.assuranceElement.findFirst({
			where: { id: parentId, deletedAt: null },
			select: { parentId: true },
		});

		if (grandparent?.parentId) {
			const ancestor = await prisma.assuranceElement.findFirst({
				where: { id: grandparent.parentId, deletedAt: null },
				select: { elementType: true, name: true, level: true },
			});

			if (ancestor?.elementType === "PROPERTY_CLAIM" && ancestor.name) {
				// Count effective siblings: direct PC children of ancestor + PC children of strategies under ancestor
				const strategyChildren = await prisma.assuranceElement.findMany({
					where: {
						parentId: grandparent.parentId,
						elementType: "STRATEGY",
						deletedAt: null,
					},
					select: { id: true },
				});
				const effectiveParentIds = [
					grandparent.parentId,
					...strategyChildren.map((s) => s.id),
				];

				const siblingCount = await prisma.assuranceElement.count({
					where: {
						parentId: { in: effectiveParentIds },
						elementType: "PROPERTY_CLAIM",
						deletedAt: null,
					},
				});
				return `${ancestor.name}.${siblingCount + 1}`;
			}
		}
		// Strategy is under a goal — fall through to top-level numbering
	}

	// Top-level property claims (under strategy/goal, not under another property claim)
	// Count ALL level-1 property claims in the case for case-wide sequential numbering (P1, P2, P3...)
	if (
		elementType === "PROPERTY_CLAIM" &&
		parentId &&
		parentInfo?.elementType !== "PROPERTY_CLAIM"
	) {
		const caseWideCount = await prisma.assuranceElement.count({
			where: {
				caseId,
				elementType: "PROPERTY_CLAIM",
				level: 1,
				deletedAt: null,
			},
		});
		return `${prefix}${caseWideCount + 1}`;
	}

	// All other element types (Strategy, Evidence, Context) - count case-wide
	// This ensures unique identifiers across the entire case (S1, S2, E1, E2, C1, C2...)
	const caseWideCount = await prisma.assuranceElement.count({
		where: {
			caseId,
			elementType: elementType as PrismaElementType,
			deletedAt: null,
		},
	});
	return `${prefix}${caseWideCount + 1}`;
}

/**
 * Calculates level for property claims and retrieves parent info.
 *
 * Strategies are transparent: if the parent is a strategy whose parent is a
 * property claim, the level is derived from that ancestor claim (one hop up).
 */
async function calculatePropertyClaimLevel(parentId: string): Promise<{
	level: number;
	parentInfo: { name: string | null; elementType: string };
}> {
	const parent = await prisma.assuranceElement.findFirst({
		where: { id: parentId, deletedAt: null },
		select: { level: true, elementType: true, name: true, parentId: true },
	});

	const parentInfo = parent as {
		name: string | null;
		elementType: string;
		level?: number | null;
		parentId?: string | null;
	};

	if (parentInfo?.elementType === "PROPERTY_CLAIM") {
		return { level: (parentInfo.level || 1) + 1, parentInfo };
	}

	// Transparent strategy: look one hop further to find ancestor property claim
	if (parentInfo?.elementType === "STRATEGY" && parentInfo.parentId) {
		const grandparent = await prisma.assuranceElement.findFirst({
			where: { id: parentInfo.parentId, deletedAt: null },
			select: { level: true, elementType: true, name: true },
		});

		if (grandparent?.elementType === "PROPERTY_CLAIM") {
			return { level: (grandparent.level || 1) + 1, parentInfo };
		}
	}

	return { level: 1, parentInfo };
}

/**
 * Checks if a case already has a goal element.
 * Returns true if a goal exists, false otherwise.
 */
async function caseHasGoal(caseId: string): Promise<boolean> {
	const existingGoal = await prisma.assuranceElement.findFirst({
		where: {
			caseId,
			elementType: "GOAL",
			deletedAt: null,
		},
		select: { id: true },
	});
	return !!existingGoal;
}

/**
 * Creates an evidence link between an evidence element and a claim.
 */
async function createEvidenceLink(
	evidenceId: string,
	claimId: string
): Promise<void> {
	await prisma.evidenceLink.create({
		data: {
			evidenceId,
			claimId,
		},
	});
}

/**
 * Resolves description from input fields with priority order.
 */
function resolveDescription(input: CreateElementInput): string {
	return (
		input.description || input.shortDescription || input.longDescription || ""
	);
}

/**
 * Creates the element in the database and handles evidence linking.
 */
async function createElementInDatabase(
	input: CreateElementInput,
	caseId: string,
	elementType: string,
	elementName: string,
	effectiveParentId: string | null | undefined,
	level: number | undefined,
	userId: string,
	intendedParentId: string | null
): Promise<{ data: ElementResponse } | { error: string }> {
	const element = await prisma.assuranceElement.create({
		data: {
			caseId,
			elementType: elementType as
				| "GOAL"
				| "STRATEGY"
				| "PROPERTY_CLAIM"
				| "EVIDENCE",
			name: elementName,
			description: resolveDescription(input),
			parentId: effectiveParentId,
			...resolveUrls(input),
			assumption: input.assumption,
			justification: input.justification,
			context: input.context ?? [],
			level,
			assertionStatus: input.assertionStatus,
			// Element-level citation (ADR 0004 D5) — applicability, existence,
			// and self-citation are validated in createElement before this
			// function is called.
			citedElementId: input.citedElementId,
			// Module reference (MODULE/AWAY_GOAL) — applicability, requiredness,
			// and existence are validated in createElement before this function
			// is called.
			moduleReferenceId: input.moduleReferenceId,
			createdById: userId,
		},
		include: {
			parent: { select: { id: true, elementType: true } },
		},
	});

	// Create EvidenceLink for evidence elements with an intended parent claim
	if (intendedParentId) {
		await createEvidenceLink(element.id, intendedParentId);
	}

	const response = transformToResponse(element);

	// Evidence has no parentId, so transformToResponse won't set propertyClaimId.
	// Add it from the evidence link we just created.
	if (intendedParentId) {
		response.propertyClaimId = [intendedParentId];
	}

	return { data: response };
}

/**
 * Creates a new element in a case
 */
export async function createElement(
	userId: string,
	input: CreateElementInput
): ServiceResult<ElementResponse> {
	const caseId = input.caseId;
	if (!caseId) {
		return { error: "Case ID is required" };
	}

	const hasAccess = await validateCaseAccess(userId, caseId, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	const assertionStatusError = await enforceAssertionStatusRules(
		input.assertionStatus,
		userId
	);
	if (assertionStatusError) {
		return { error: assertionStatusError };
	}

	const elementType = toPrismaType(input.elementType);
	const parentId = resolveParentId(input);

	if (elementType === "GOAL" && (await caseHasGoal(caseId))) {
		return { error: "A case can only have one goal claim" };
	}

	const moduleReferenceIdError = await enforceModuleReferenceIdRules(
		elementType,
		input.moduleReferenceId,
		{ requireOnCreate: true }
	);
	if (moduleReferenceIdError) {
		return { error: moduleReferenceIdError };
	}

	const citedElementIdError = await enforceCitedElementIdRules(
		elementType,
		input.citedElementId
	);
	if (citedElementIdError) {
		return { error: citedElementIdError };
	}

	const { level, parentInfo } =
		elementType === "PROPERTY_CLAIM" && parentId
			? await calculatePropertyClaimLevel(parentId)
			: { level: undefined, parentInfo: null };

	const elementName =
		input.name ||
		(await generateElementName(
			elementType,
			caseId,
			parentId ?? null,
			parentInfo
		));

	// Evidence uses evidence_links instead of parentId
	const isEvidence = elementType === "EVIDENCE";
	const intendedParentId = isEvidence ? (parentId ?? null) : null;
	const effectiveParentId = isEvidence ? null : parentId;

	try {
		return await createElementInDatabase(
			input,
			caseId,
			elementType,
			elementName,
			effectiveParentId,
			level,
			userId,
			intendedParentId
		);
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
): ServiceResult<ElementResponse> {
	try {
		const element = await prisma.assuranceElement.findFirst({
			where: { id: elementId, deletedAt: null },
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
			return { error: "Element not found" };
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
	applyUrlUpdates(input, updateData);
	if (input.assumption !== undefined) {
		updateData.assumption = input.assumption;
	}
	if (input.justification !== undefined) {
		updateData.justification = input.justification;
	}
	if (input.context !== undefined) {
		updateData.context = input.context;
	}
	if (input.inSandbox !== undefined) {
		updateData.inSandbox = input.inSandbox;
	}
	if (input.assertionStatus !== undefined) {
		updateData.assertionStatus = input.assertionStatus;
	}
	if (input.citedElementId !== undefined) {
		updateData.citedElementId = input.citedElementId;
		// The author explicitly set (or cleared) the citation — whatever
		// dangling flag was left over from a previous deletion/detachment no
		// longer describes the current state, declared or not.
		updateData.citationDangling = false;
	}
	if (input.moduleReferenceId !== undefined) {
		updateData.moduleReferenceId = input.moduleReferenceId;
	}

	return updateData;
}

/**
 * Calculates the new level for a property claim based on its new parent
 */
async function calculateNewLevel(newParentId: string): Promise<number> {
	const newParent = await prisma.assuranceElement.findFirst({
		where: { id: newParentId, deletedAt: null },
		select: { level: true, elementType: true },
	});
	if (newParent?.elementType === "PROPERTY_CLAIM") {
		return (newParent.level || 1) + 1;
	}
	return 1;
}

/**
 * Validates that setting a new parent doesn't create a circular reference.
 * Returns an error message if invalid, undefined if valid.
 */
async function validateParentChange(
	elementId: string,
	newParentId: string
): Promise<string | undefined> {
	// Cannot set parent to self
	if (elementId === newParentId) {
		return "Cannot set element as its own parent";
	}

	// Cannot set parent to a descendant (would create circular reference)
	const descendantIds = await getDescendantIds(elementId);
	if (descendantIds.includes(newParentId)) {
		return "Cannot move element to one of its descendants";
	}

	return;
}

/**
 * Updates an existing element
 */
export async function updateElement(
	userId: string,
	elementId: string,
	input: UpdateElementInput
): ServiceResult<ElementResponse> {
	try {
		// Get existing element to check permissions (include deleted to give proper error message)
		const existing = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, elementType: true, level: true, deletedAt: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		if (existing.deletedAt) {
			return { error: "Cannot update deleted element" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// ADR 0004 D3 write rule: assertionStatus is author-declared only —
		// see guardAssertionStatusWrite's docstring for why case-level EDIT
		// access alone isn't a sufficient gate.
		const assertionStatusError = await enforceAssertionStatusRules(
			input.assertionStatus,
			userId
		);
		if (assertionStatusError) {
			return { error: assertionStatusError };
		}

		// moduleReferenceId is MODULE/AWAY_GOAL-only and must reference an
		// existing case. No requiredness check on update — mirrors the batch
		// update path (case-batch-update-service.ts), see
		// enforceModuleReferenceIdRules's docstring.
		const moduleReferenceIdError = await enforceModuleReferenceIdRules(
			existing.elementType,
			input.moduleReferenceId,
			{ requireOnCreate: false }
		);
		if (moduleReferenceIdError) {
			return { error: moduleReferenceIdError };
		}

		// ADR 0004 D5: citedElementId is AWAY_GOAL-only, must reference an
		// existing element, and cannot reference the element itself.
		const citedElementIdError = await enforceCitedElementIdRules(
			existing.elementType,
			input.citedElementId,
			elementId
		);
		if (citedElementIdError) {
			return { error: citedElementIdError };
		}

		// Build update data from input fields
		const updateData = buildUpdateData(input);

		// Handle parent change (for move operations)
		const newParentId = resolveParentId(input);
		if (newParentId !== undefined && newParentId !== null) {
			// Validate new parent exists, is not deleted, and belongs to the same case
			const newParent = await prisma.assuranceElement.findUnique({
				where: { id: newParentId },
				select: { caseId: true, deletedAt: true },
			});

			if (
				!newParent ||
				newParent.deletedAt ||
				newParent.caseId !== existing.caseId
			) {
				return { error: "Element not found" };
			}

			// Validate parent change doesn't create circular reference
			const validationError = await validateParentChange(
				elementId,
				newParentId
			);
			if (validationError) {
				return { error: validationError };
			}

			updateData.parentId = newParentId;

			// Recalculate level if it's a property claim
			if (existing.elementType === "PROPERTY_CLAIM" && newParentId) {
				updateData.level = await calculateNewLevel(newParentId);
			}
		} else if (newParentId === null) {
			// Allow setting parent to null (detaching)
			updateData.parentId = null;
		}

		const element = await prisma.assuranceElement.update({
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
 * ADR 0004 D5 integrity rule (ruled by cid + Chris, 2026-07-19): when a cited
 * element is deleted or detached from its case, citing elements are NOT left
 * pointing at a dangling id — `citedElementId` is nullified and
 * `citationDangling` is set so the citing element's own response can surface
 * a "this citation broke" indicator (consistent with the rest of the
 * codebase's soft-delete conventions: nothing is silently lost, but nothing
 * blocks the deletion/detach either). Takes the Prisma client or an open
 * transaction so callers can run it atomically with the delete/detach itself.
 */
async function nullifyDanglingCitations(
	tx: TxClient,
	citedElementIds: string[]
): Promise<void> {
	if (citedElementIds.length === 0) {
		return;
	}
	await tx.assuranceElement.updateMany({
		where: { citedElementId: { in: citedElementIds } },
		data: { citedElementId: null, citationDangling: true },
	});
}

/**
 * Soft-deletes an element and all its descendants
 */
export async function deleteElement(
	userId: string,
	elementId: string
): ServiceResult {
	try {
		// Get existing element to check permissions
		const existing = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, deletedAt: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		if (existing.deletedAt) {
			return { error: "Element already deleted" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// Gather descendants, soft-delete, and nullify+flag any dangling
		// citations (ADR 0004 D5) atomically
		await prisma.$transaction(async (tx) => {
			const descendantIds = await getDescendantIds(elementId, tx);
			const allIds = [elementId, ...descendantIds];
			await tx.assuranceElement.updateMany({
				where: { id: { in: allIds } },
				data: { deletedAt: new Date(), deletedById: userId },
			});
			// Citations are cross-case by design (an AWAY_GOAL cites an element
			// in a DIFFERENT case), so this deliberately isn't scoped to
			// `existing.caseId` — every deleted id (the element and its
			// descendants) may be cited from anywhere.
			await nullifyDanglingCitations(tx, allIds);
		});

		return { data: true };
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
): ServiceResult {
	try {
		// Get existing element to check permissions
		const existing = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, deletedAt: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		if (existing.deletedAt) {
			return { error: "Cannot detach deleted element" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// Move to sandbox, clear parent, and nullify+flag any dangling
		// citations (ADR 0004 D5) atomically — a detached element is no
		// longer part of the case's argument tree, so a citation pointing at
		// it is just as broken as one pointing at a deleted element.
		await prisma.$transaction(async (tx) => {
			await tx.assuranceElement.update({
				where: { id: elementId },
				data: {
					parentId: null,
					inSandbox: true,
				},
			});
			await nullifyDanglingCitations(tx, [elementId]);
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to detach element:", error);
		return { error: "Failed to detach element" };
	}
}

/**
 * Attaches an element (moves from sandbox to parent)
 * Also cascades to all descendants, removing them from sandbox
 */
export async function attachElement(
	userId: string,
	elementId: string,
	parentId: string
): ServiceResult {
	try {
		// Get existing element to check permissions
		const existing = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, elementType: true, deletedAt: true },
		});

		if (!existing) {
			return { error: "Element not found" };
		}

		if (existing.deletedAt) {
			return { error: "Cannot attach deleted element" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, existing.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// Validate parent exists, is not deleted, and belongs to the same case
		const parentElement = await prisma.assuranceElement.findUnique({
			where: { id: parentId },
			select: { caseId: true, deletedAt: true },
		});

		if (
			!parentElement ||
			parentElement.deletedAt ||
			parentElement.caseId !== existing.caseId
		) {
			return { error: "Element not found" };
		}

		// Validate parent change doesn't create circular reference
		const validationError = await validateParentChange(elementId, parentId);
		if (validationError) {
			return { error: validationError };
		}

		// Calculate level, attach, and cascade sandbox removal atomically
		await prisma.$transaction(async (tx) => {
			let level: number | undefined;
			if (existing.elementType === "PROPERTY_CLAIM") {
				const parent = await tx.assuranceElement.findFirst({
					where: { id: parentId, deletedAt: null },
					select: { level: true, elementType: true },
				});
				if (parent?.elementType === "PROPERTY_CLAIM") {
					level = (parent.level || 1) + 1;
				} else {
					level = 1;
				}
			}

			await tx.assuranceElement.update({
				where: { id: elementId },
				data: {
					parentId,
					inSandbox: false,
					...(level !== undefined ? { level } : {}),
				},
			});

			const descendantIds = await getDescendantIds(elementId, tx);
			if (descendantIds.length > 0) {
				await tx.assuranceElement.updateMany({
					where: { id: { in: descendantIds } },
					data: { inSandbox: false },
				});
			}
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to attach element:", error);
		return { error: "Failed to attach element" };
	}
}

/**
 * Moves an element to a new parent within the same case.
 *
 * Validates:
 *  - Element exists and is not deleted
 *  - User has EDIT permission on the case
 *  - New parent exists, belongs to the same case, and is not deleted
 *  - Child/parent types are compatible (see element-compatibility)
 *  - The move does not create a circular reference
 *
 * Evidence elements use EvidenceLink rather than parentId.
 */
export async function moveElement(
	userId: string,
	elementId: string,
	newParentId: string
): ServiceResult {
	try {
		// Fetch element — validate exists and is not deleted
		const element = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { caseId: true, elementType: true, deletedAt: true },
		});

		if (!element) {
			return { error: "Element not found" };
		}

		if (element.deletedAt) {
			return { error: "Element not found" };
		}

		// Validate user has EDIT permission on the case (before any type-specific checks)
		const hasAccess = await validateCaseAccess(userId, element.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// Goals cannot be moved — they are the root of the hierarchy
		if (element.elementType === "GOAL") {
			return { error: "Element not found" };
		}

		// Fetch new parent — validate exists, same case, not deleted
		const newParent = await prisma.assuranceElement.findUnique({
			where: { id: newParentId },
			select: { caseId: true, elementType: true, deletedAt: true },
		});

		if (
			!newParent ||
			newParent.deletedAt ||
			newParent.caseId !== element.caseId
		) {
			return { error: "Element not found" };
		}

		// Check type compatibility
		const { canBeChildOf } = await import("@/lib/element-compatibility");
		const elementTypeLower = element.elementType.toLowerCase();
		const parentTypeLower = newParent.elementType.toLowerCase();

		if (!canBeChildOf(elementTypeLower, parentTypeLower)) {
			return {
				error: `${element.elementType.toLowerCase()} cannot be a child of ${newParent.elementType.toLowerCase()}`,
			};
		}

		// Validate the move does not create a circular reference
		const circularError = await validateParentChange(elementId, newParentId);
		if (circularError) {
			return { error: circularError };
		}

		// Perform the move atomically
		await prisma.$transaction(async (tx) => {
			if (element.elementType === "EVIDENCE") {
				// Evidence uses EvidenceLink rather than parentId
				// Remove existing evidence link(s) for this evidence element
				await tx.evidenceLink.deleteMany({
					where: { evidenceId: elementId },
				});

				// Create new evidence link to the new parent claim
				await tx.evidenceLink.create({
					data: {
						evidenceId: elementId,
						claimId: newParentId,
					},
				});
			} else {
				// Non-evidence: update parentId directly
				const updateData: Record<string, unknown> = { parentId: newParentId };

				// Recalculate level for property claims
				if (element.elementType === "PROPERTY_CLAIM") {
					const parent = await tx.assuranceElement.findFirst({
						where: { id: newParentId, deletedAt: null },
						select: { level: true, elementType: true },
					});
					updateData.level =
						parent?.elementType === "PROPERTY_CLAIM"
							? (parent.level || 1) + 1
							: 1;
				}

				await tx.assuranceElement.update({
					where: { id: elementId },
					data: updateData,
				});
			}
		});

		return { data: true };
	} catch (error) {
		console.error("[moveElement]", { elementId, newParentId, userId, error });
		return { error: "Failed to move element" };
	}
}

/**
 * Gets all elements in sandbox for a case
 */
export async function getSandboxElements(
	userId: string,
	caseId: string
): ServiceResult<ElementResponse[]> {
	// Validate user has VIEW permission
	const hasAccess = await validateCaseAccess(userId, caseId, "VIEW");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		const elements = await prisma.assuranceElement.findMany({
			where: {
				caseId,
				inSandbox: true,
				deletedAt: null,
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

/**
 * Restores a soft-deleted element and all its descendants
 */
export async function restoreElement(
	userId: string,
	elementId: string
): ServiceResult {
	try {
		// Get the element (including deleted ones)
		const element = await prisma.assuranceElement.findUnique({
			where: { id: elementId },
			select: { parentId: true, caseId: true, deletedAt: true },
		});

		if (!element) {
			return { error: "Element not found" };
		}

		if (!element.deletedAt) {
			return { error: "Element is not deleted" };
		}

		// Validate user has EDIT permission
		const hasAccess = await validateCaseAccess(userId, element.caseId, "EDIT");
		if (!hasAccess) {
			return { error: "Element not found" };
		}

		// Verify parent is not deleted (if exists)
		if (element.parentId) {
			const parent = await prisma.assuranceElement.findUnique({
				where: { id: element.parentId },
				select: { deletedAt: true },
			});
			if (parent?.deletedAt) {
				return { error: "Cannot restore: parent element is deleted" };
			}
		}

		// Gather deleted descendants and restore atomically
		await prisma.$transaction(async (tx) => {
			const descendantIds = await getDeletedDescendantIds(elementId, tx);
			const allIds = [elementId, ...descendantIds];
			await tx.assuranceElement.updateMany({
				where: { id: { in: allIds } },
				data: { deletedAt: null, deletedById: null },
			});
		});

		return { data: true };
	} catch (error) {
		console.error("Failed to restore element:", error);
		return { error: "Failed to restore element" };
	}
}
