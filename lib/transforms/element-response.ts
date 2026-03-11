import { toDisplayType } from "@/lib/element-types";
import type { ElementResponse } from "@/lib/services/element-service";

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

	return response;
}
