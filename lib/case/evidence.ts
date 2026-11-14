/**
 * Evidence operations for assurance cases
 * Handles adding, updating, and moving evidence
 */

import type {
	EvidenceResponse,
	PropertyClaimResponse,
} from "@/lib/services/case-response-types";
import { type CaseTreeNode, findCaseNode } from "./case-walk";

/**
 * Adds evidence to a specified property claim by ID. The claim is looked for
 * in the given nodes and everywhere beneath them: nested claims, strategies,
 * and the counter-goals hanging from any of them.
 */
export const addEvidenceToClaim = (
	nodes: readonly CaseTreeNode[],
	parentId: string,
	newEvidence: EvidenceResponse
): boolean => {
	const propertyClaim = findCaseNode(
		nodes,
		parentId
	) as PropertyClaimResponse | null;
	if (!propertyClaim) {
		return false; // Indicates the parent property claim was not found
	}
	if (!propertyClaim.evidence) {
		propertyClaim.evidence = [];
	}
	propertyClaim.evidence.push(newEvidence);
	return true; // Indicates the property claim was found and updated
};
