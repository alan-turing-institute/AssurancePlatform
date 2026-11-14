/**
 * Property claims operations for assurance cases
 * Handles adding, updating, moving, and listing property claims
 */

import type { PropertyClaimResponse } from "@/lib/services/case-response-types";
import { type CaseTreeNode, findCaseNode } from "./case-walk";

/**
 * Adds a new property claim to the claim or strategy with the given ID. The
 * parent is looked for in the given nodes and everywhere beneath them: nested
 * claims, strategies, and the counter-goals hanging from any of them.
 */
export const addPropertyClaimToNested = (
	nodes: readonly CaseTreeNode[],
	parentId: string,
	newPropertyClaim: PropertyClaimResponse
): boolean => {
	const parent = findCaseNode(nodes, parentId) as {
		propertyClaims?: PropertyClaimResponse[];
	} | null;
	if (!parent) {
		return false; // Indicates the parent was not found
	}
	if (!parent.propertyClaims) {
		parent.propertyClaims = [];
	}
	parent.propertyClaims.push(newPropertyClaim);
	return true; // Indicates the parent was found and updated
};
