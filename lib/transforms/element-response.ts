import { toDisplayType } from "@/lib/element-types";
import type { ElementResponse } from "@/lib/services/element-service";
import type { AssertionStatus } from "@/src/generated/prisma";

/**
 * Adds parent reference to response based on parent element type
 */
function addParentReference(
	response: ElementResponse,
	parent: { id: string; elementType: string },
	elementType: string
): void {
	switch (parent.elementType) {
		case "GOAL":
			response.goalId = parent.id;
			break;
		case "STRATEGY":
			response.strategyId = parent.id;
			break;
		case "PROPERTY_CLAIM":
			// Evidence expects propertyClaimId as an array
			// Other elements get it as a string
			if (elementType === "EVIDENCE") {
				response.propertyClaimId = [parent.id];
			} else {
				response.propertyClaimId = parent.id;
			}
			break;
		default:
			// Unknown parent type — no reference added
			break;
	}
}

/**
 * Applies the dialogical-reasoning (defeater) response fields. Split out of
 * applyOptionalFields — same reason that function itself was split out of
 * transformToResponse: adding defeatsDangling alongside isDefeater/
 * defeatsElementId pushed applyOptionalFields over the cognitive-complexity
 * budget.
 */
function applyDialogicalReasoningFields(
	response: ElementResponse,
	element: {
		isDefeater?: boolean;
		defeatsElementId?: string | null;
		defeatsDangling?: boolean;
	}
): void {
	if (element.isDefeater) {
		response.isDefeater = true;
	}
	if (element.defeatsElementId) {
		response.defeatsElementId = element.defeatsElementId;
	}
	if (element.defeatsDangling) {
		response.defeatsDangling = true;
	}
}

/**
 * Applies the optional single-value response fields (URLs, prose fields,
 * assertion status, and the citation/module-reference metadata) that are
 * only present on the response when the underlying element data is present.
 * Extracted out of transformToResponse — verbatim, same conditions, same
 * assignments — to keep that function under the cognitive-complexity budget.
 */
function applyOptionalFields(
	response: ElementResponse,
	element: {
		assumption: string | null;
		justification: string | null;
		context: string[];
		url: string | null;
		urls: string[];
		level: number | null;
		assertionStatus?: AssertionStatus | null;
		citedElementId?: string | null;
		citationDangling?: boolean;
		moduleReferenceId?: string | null;
		moduleReferenceDangling?: boolean;
		isDefeater?: boolean;
		defeatsElementId?: string | null;
		defeatsDangling?: boolean;
	}
): void {
	// Handle URLs: prefer urls array, fall back to legacy url field
	if (element.urls && element.urls.length > 0) {
		response.urls = element.urls;
		response.URL = element.urls[0]; // Backward compatibility: first URL
	} else if (element.url) {
		response.URL = element.url;
		response.urls = [element.url]; // Backward compatibility
	}
	if (element.assumption) {
		response.assumption = element.assumption;
	}
	if (element.justification) {
		response.justification = element.justification;
	}
	if (element.context && element.context.length > 0) {
		response.context = element.context;
	}
	if (element.level !== null) {
		response.level = element.level;
	}
	if (element.assertionStatus) {
		response.assertionStatus = element.assertionStatus;
	}
	if (element.citedElementId) {
		response.citedElementId = element.citedElementId;
	}
	if (element.citationDangling) {
		response.citationDangling = true;
	}
	if (element.moduleReferenceId) {
		response.moduleReferenceId = element.moduleReferenceId;
	}
	if (element.moduleReferenceDangling) {
		response.moduleReferenceDangling = true;
	}
	applyDialogicalReasoningFields(response, element);
}

/**
 * Transforms a Prisma element to API response format
 */
export function transformToResponse(element: {
	id: string;
	elementType: string;
	name: string | null;
	description: string;
	assumption: string | null;
	justification: string | null;
	context: string[];
	url: string | null;
	urls: string[];
	inSandbox: boolean;
	level: number | null;
	// ADR 0004 D3 — nullable; null means unset (interpreted as ASSERTED at
	// export time in build-tree.ts, not here — this response mirrors the
	// raw stored value for the canvas/JSON-editor UI).
	assertionStatus?: AssertionStatus | null;
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only
	citedElementId?: string | null;
	// Dangling-citation indicator (ADR 0004 D5) — true when citedElementId
	// was nullified because the cited element was deleted/detached
	citationDangling?: boolean;
	// Module reference (MODULE/AWAY_GOAL only) — names the referenced case
	moduleReferenceId?: string | null;
	// Dangling-module-reference indicator (see resolveImportedModuleReferenceId,
	// case-import-service.ts) — true when moduleReferenceId was nullified
	// because the imported target case doesn't exist in this environment.
	moduleReferenceDangling?: boolean;
	// Dialogical reasoning (defeaters) — applies to every element type.
	isDefeater?: boolean;
	defeatsElementId?: string | null;
	// Dangling-defeat indicator (see resolveImportedDefeatsElementId,
	// case-import-service.ts) — true when defeatsElementId was blanked
	// because the imported target wasn't part of the same import.
	defeatsDangling?: boolean;
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
		type: toDisplayType(element.elementType),
		name: element.name || "",
		description: element.description || "",
		createdDate: element.createdAt.toISOString(),
		inSandbox: element.inSandbox,
		assuranceCaseId: element.caseId,
		comments: [],
	};

	// Add parent reference
	if (element.parent) {
		addParentReference(response, element.parent, element.elementType);
	}

	applyOptionalFields(response, element);

	return response;
}
