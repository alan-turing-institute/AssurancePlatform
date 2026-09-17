/**
 * Property claims operations for assurance cases
 * Handles adding, updating, moving, and listing property claims
 */

import type {
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

// Helper function to add property claim to a specific claim
const addPropertyClaimToSpecificClaim = (
	propertyClaim: PropertyClaimResponse,
	newPropertyClaim: PropertyClaimResponse
): void => {
	if (!propertyClaim.propertyClaims) {
		propertyClaim.propertyClaims = [];
	}
	propertyClaim.propertyClaims.push(newPropertyClaim);
};

// Helper function to search in nested property claims
const searchInNestedPropertyClaims = (
	propertyClaims: PropertyClaimResponse[],
	parentId: string,
	newPropertyClaim: PropertyClaimResponse
): boolean => {
	const found = addPropertyClaimToNested(
		propertyClaims,
		parentId,
		newPropertyClaim
	);
	return found;
};

// Helper function to search in strategies
const searchInStrategies = (
	strategies: StrategyResponse[],
	parentId: string,
	newPropertyClaim: PropertyClaimResponse
): boolean => {
	for (const strategy of strategies) {
		// Check if this strategy matches the parent ID
		if (strategy.id === parentId) {
			// Initialise propertyClaims array if it doesn't exist
			if (!strategy.propertyClaims) {
				strategy.propertyClaims = [];
			}
			strategy.propertyClaims.push(newPropertyClaim);
			return true;
		}
		// If the strategy has property claims, search within them
		if (strategy.propertyClaims && strategy.propertyClaims.length > 0) {
			const found = addPropertyClaimToNested(
				strategy.propertyClaims,
				parentId,
				newPropertyClaim
			);
			if (found) {
				return true;
			}
		}
	}
	return false;
};

/**
 * Recursively adds a new property claim to a specified parent property claim by ID.
 */
export const addPropertyClaimToNested = (
	propertyClaims: PropertyClaimResponse[],
	parentId: string,
	newPropertyClaim: PropertyClaimResponse
): boolean => {
	// Iterate through the property claims array
	for (const propertyClaim of propertyClaims) {
		// Check if this property claim matches the parent ID
		if (propertyClaim.id === parentId) {
			addPropertyClaimToSpecificClaim(propertyClaim, newPropertyClaim);
			return true; // Indicates the property claim was found and updated
		}

		// If this property claim has nested property claims, recursively search within them
		if (
			propertyClaim.propertyClaims &&
			propertyClaim.propertyClaims.length > 0
		) {
			const found = searchInNestedPropertyClaims(
				propertyClaim.propertyClaims,
				parentId,
				newPropertyClaim
			);
			if (found) {
				return true; // Indicates the property claim was found and updated within nested property claims
			}
		}

		// If this property claim has strategies, recursively search within them
		if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
			const found = searchInStrategies(
				propertyClaim.strategies,
				parentId,
				newPropertyClaim
			);
			if (found) {
				return true; // Indicates the property claim was found and updated within nested property claims of strategy
			}
		}
	}

	return false; // Indicates the parent property claim was not found
};
