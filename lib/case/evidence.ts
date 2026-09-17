/**
 * Evidence operations for assurance cases
 * Handles adding, updating, and moving evidence
 */

import type {
	EvidenceResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

// Helper function to add evidence to a specific claim
const addEvidenceToSpecificClaim = (
	propertyClaim: PropertyClaimResponse,
	newEvidence: EvidenceResponse
): void => {
	if (!propertyClaim.evidence) {
		propertyClaim.evidence = [];
	}
	propertyClaim.evidence.push(newEvidence);
};

// Helper function to search in nested property claims for evidence
const searchInNestedClaimsForEvidence = (
	propertyClaims: PropertyClaimResponse[],
	parentId: string,
	newEvidence: EvidenceResponse
): boolean => {
	const found = addEvidenceToClaim(propertyClaims, parentId, newEvidence);
	return found;
};

// Helper function to search in strategies for evidence
const searchInStrategiesForEvidence = (
	strategies: StrategyResponse[],
	parentId: string,
	newEvidence: EvidenceResponse
): boolean => {
	for (const strategy of strategies) {
		if (strategy.propertyClaims && strategy.propertyClaims.length > 0) {
			const found = addEvidenceToClaim(
				strategy.propertyClaims,
				parentId,
				newEvidence
			);
			if (found) {
				return true;
			}
		}
	}
	return false;
};

/**
 * Adds evidence to a specified property claim by ID.
 */
export const addEvidenceToClaim = (
	array: PropertyClaimResponse[],
	parentId: string,
	newEvidence: EvidenceResponse
): boolean => {
	// Iterate through the property claims array
	for (const propertyClaim of array) {
		// Check if this property claim matches the parent ID
		if (propertyClaim.id === parentId) {
			addEvidenceToSpecificClaim(propertyClaim, newEvidence);
			return true; // Indicates the property claim was found and updated
		}

		// If this property claim has nested property claims, recursively search within them
		if (
			propertyClaim.propertyClaims &&
			propertyClaim.propertyClaims.length > 0
		) {
			const found = searchInNestedClaimsForEvidence(
				propertyClaim.propertyClaims,
				parentId,
				newEvidence
			);
			if (found) {
				return true; // Indicates the property claim was found and updated within nested property claims
			}
		}

		// If this property claim has strategies, recursively search within them
		if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
			const found = searchInStrategiesForEvidence(
				propertyClaim.strategies,
				parentId,
				newEvidence
			);
			if (found) {
				return true; // Indicates the property claim was found and updated within nested property claims of strategy
			}
		}
	}

	return false; // Indicates the parent property claim was not found
};
