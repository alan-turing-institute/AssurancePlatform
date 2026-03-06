/**
 * Property claims operations for assurance cases
 * Handles adding, updating, moving, and listing property claims
 */

import type {
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

// Regular expressions
const NUMERIC_ID_PATTERN = /^\d+$/;

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

// Helper to update strategies with nested property claims immutably
const updateStrategiesWithClaim = (
	strategies: StrategyResponse[],
	id: string,
	newPropertyClaim: Partial<PropertyClaimResponse>
): { strategies: StrategyResponse[]; found: boolean } => {
	let found = false;
	const result = strategies.map((strategy) => {
		if (found || !strategy.propertyClaims?.length) {
			return strategy;
		}
		const updated = updatePropertyClaimNested(
			strategy.propertyClaims,
			id,
			newPropertyClaim
		);
		if (updated !== strategy.propertyClaims) {
			found = true;
			return { ...strategy, propertyClaims: updated };
		}
		return strategy;
	});
	return { strategies: found ? result : strategies, found };
};

// Helper to process a single property claim immutably
const processClaimUpdate = (
	claim: PropertyClaimResponse,
	id: string,
	newData: Partial<PropertyClaimResponse>,
	alreadyFound: boolean
): { claim: PropertyClaimResponse; found: boolean } => {
	if (alreadyFound) {
		return { claim, found: false };
	}

	// Direct match
	if (claim.id === id && claim.type === "property_claim") {
		return { claim: { ...claim, ...newData }, found: true };
	}

	// Check nested claims
	if (claim.propertyClaims?.length) {
		const nested = updatePropertyClaimNested(claim.propertyClaims, id, newData);
		if (nested !== claim.propertyClaims) {
			return {
				claim: { ...claim, propertyClaims: nested },
				found: true,
			};
		}
	}

	// Check strategies
	if (claim.strategies?.length) {
		const { strategies, found } = updateStrategiesWithClaim(
			claim.strategies,
			id,
			newData
		);
		if (found) {
			return { claim: { ...claim, strategies }, found: true };
		}
	}

	return { claim, found: false };
};

/**
 * Recursively updates a property claim in a nested structure using immutable patterns.
 * Returns a NEW array reference when updates are made, ensuring React detects changes.
 */
export const updatePropertyClaimNested = (
	array: PropertyClaimResponse[],
	id: string,
	newPropertyClaim: Partial<PropertyClaimResponse>
): PropertyClaimResponse[] => {
	if (!array || array.length === 0) {
		return array;
	}

	let found = false;
	const result = array.map((claim) => {
		const { claim: updated, found: wasFound } = processClaimUpdate(
			claim,
			id,
			newPropertyClaim,
			found
		);
		if (wasFound) {
			found = true;
		}
		return updated;
	});

	return found ? result : array;
};

/**
 * Recursively removes a property claim from its old location in a nested array structure by ID.
 * Uses immutable patterns - returns NEW object references to ensure React detects changes.
 */
const removePropertyClaimFromOldLocation = (
	array: PropertyClaimResponse[],
	id: string
): PropertyClaimResponse[] => {
	return array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaimResponse = { ...item };

		if (newItem.propertyClaims) {
			// Filter out the claim with the given id
			newItem.propertyClaims = newItem.propertyClaims.filter(
				(claim) => claim.id !== id
			);
			// Recursively remove the claim from nested propertyClaims
			newItem.propertyClaims = removePropertyClaimFromOldLocation(
				newItem.propertyClaims,
				id
			);
		}

		if (newItem.strategies) {
			// Recursively process each strategy with immutable updates
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.propertyClaims) {
					// Filter out the claim with the given id from the strategy's propertyClaims
					const filteredClaims = strategy.propertyClaims.filter(
						(claim) => claim.id !== id
					);
					// Recursively remove the claim from the strategy's nested propertyClaims
					return {
						...strategy,
						propertyClaims: removePropertyClaimFromOldLocation(
							filteredClaims,
							id
						),
					};
				}
				return strategy;
			});
		}

		return newItem;
	});
};

/**
 * Recursively adds a property claim to a specified location in a nested array structure.
 * Uses immutable patterns - returns NEW object references to ensure React detects changes.
 */
const addPropertyClaimToLocation = (
	array: PropertyClaimResponse[],
	propertyClaim: PropertyClaimResponse,
	newParentId: string
): PropertyClaimResponse[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaimResponse = { ...item };

		if (newItem.id === newParentId) {
			// Create new array with the added property claim
			newItem.propertyClaims = [
				...(newItem.propertyClaims || []),
				propertyClaim,
			];
		} else if (newItem.propertyClaims) {
			newItem.propertyClaims = addPropertyClaimToLocation(
				newItem.propertyClaims,
				propertyClaim,
				newParentId
			);
		}

		if (newItem.strategies) {
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.id === newParentId) {
					// Create new strategy with added property claim
					return {
						...strategy,
						propertyClaims: [...(strategy.propertyClaims || []), propertyClaim],
					};
				}

				if (strategy.propertyClaims) {
					return {
						...strategy,
						propertyClaims: addPropertyClaimToLocation(
							strategy.propertyClaims,
							propertyClaim,
							newParentId
						),
					};
				}
				return strategy;
			});
		}

		return newItem;
	});

// Helper function to search for property claim in item
const searchPropertyClaimInItem = (
	item: PropertyClaimResponse,
	id: string
): PropertyClaimResponse | null => {
	if (item.id === id && item.type === "property_claim") {
		return item;
	}
	return null;
};

// Helper function to search in property claims of strategies
const searchInStrategyPropertyClaims = (
	strategies: StrategyResponse[],
	id: string
): PropertyClaimResponse | null => {
	for (const strategy of strategies) {
		if (strategy.propertyClaims) {
			const found = searchInNestedPropertyClaimsRecursive(
				strategy.propertyClaims,
				id
			);
			if (found) {
				return found;
			}
		}
	}
	return null;
};

// Helper function to search a single item and its nested structure
const searchPropertyClaimItem = (
	item: PropertyClaimResponse,
	id: string
): PropertyClaimResponse | null => {
	const found = searchPropertyClaimInItem(item, id);
	if (found) {
		return found;
	}

	if (item.propertyClaims) {
		const nestedFound = searchInNestedPropertyClaimsRecursive(
			item.propertyClaims,
			id
		);
		if (nestedFound) {
			return nestedFound;
		}
	}

	if (item.strategies) {
		const strategyFound = searchInStrategyPropertyClaims(item.strategies, id);
		if (strategyFound) {
			return strategyFound;
		}
	}

	return null;
};

// Helper function to search in nested property claims recursively
const searchInNestedPropertyClaimsRecursive = (
	arr: PropertyClaimResponse[],
	id: string
): PropertyClaimResponse | null => {
	for (const item of arr) {
		const found = searchPropertyClaimItem(item, id);
		if (found) {
			return found;
		}
	}
	return null;
};

// Helper function to determine new parent ID
const determineNewParentId = (
	updatedPropertyClaim: PropertyClaimResponse
): string | null => {
	if (updatedPropertyClaim.goalId !== null) {
		return updatedPropertyClaim.goalId;
	}
	if (updatedPropertyClaim.strategyId !== null) {
		return updatedPropertyClaim.strategyId;
	}
	if (updatedPropertyClaim.propertyClaimId !== null) {
		return updatedPropertyClaim.propertyClaimId;
	}
	return null;
};

/**
 * Updates a property claim's location and properties in a nested array structure.
 */
export const updatePropertyClaimNestedMove = (
	array: PropertyClaimResponse[],
	id: string,
	newPropertyClaim: Partial<PropertyClaimResponse> & {
		propertyClaimId?: string;
	}
): PropertyClaimResponse[] => {
	// Find the existing property claim item
	const existingPropertyClaim = searchInNestedPropertyClaimsRecursive(
		array,
		id
	);

	// Remove evidence from its old location
	const arrayWithoutOldPropertyClaim = removePropertyClaimFromOldLocation(
		array,
		id
	);

	// Merge existing evidence properties with updated ones
	const updatedPropertyClaim = {
		...existingPropertyClaim,
		...newPropertyClaim,
	} as PropertyClaimResponse;

	// Determine the new parent ID
	const newParentId = determineNewParentId(updatedPropertyClaim);

	if (!newParentId) {
		return arrayWithoutOldPropertyClaim;
	}

	const updatedArray = addPropertyClaimToLocation(
		arrayWithoutOldPropertyClaim,
		updatedPropertyClaim,
		newParentId
	);

	return updatedArray;
};

// Helper function to check and add property claim to list
const addPropertyClaimToList = (
	item: PropertyClaimResponse,
	currentClaimName: string,
	claims: PropertyClaimResponse[]
): void => {
	// Skip null/undefined items
	if (!item || typeof item !== "object") {
		return;
	}

	// Check if currentClaimName is actually an ID (numeric string)
	const isIdComparison = NUMERIC_ID_PATTERN.test(currentClaimName);

	if (item.type === "property_claim") {
		if (isIdComparison) {
			// Compare by ID if currentClaimName is a numeric string
			if (item.id?.toString() !== currentClaimName) {
				claims.push(item);
			}
		} else if (item.name !== currentClaimName) {
			// Compare by name otherwise
			claims.push(item);
		}
	}
};

// Helper function to process strategies with property claims
const processStrategiesPropertyClaims = (
	strategies: StrategyResponse[],
	currentClaimName: string,
	claims: PropertyClaimResponse[]
): void => {
	for (const strategy of strategies) {
		if (strategy.propertyClaims && strategy.propertyClaims.length > 0) {
			listPropertyClaims(
				strategy.propertyClaims,
				currentClaimName,
				claims,
				true
			);
		}
	}
};

/**
 * Recursively lists all property claims except the specified current claim.
 */
export const listPropertyClaims = (
	array: PropertyClaimResponse[],
	currentClaimName: string,
	claims: PropertyClaimResponse[] = [],
	isNested = false
): PropertyClaimResponse[] => {
	// Handle null/undefined array
	if (!(array && Array.isArray(array))) {
		return claims;
	}

	// Iterate through the property claims array
	for (const item of array) {
		// Skip null/undefined items
		if (!item) {
			continue;
		}

		// Only add to list if this is a nested call (not top-level)
		if (isNested) {
			addPropertyClaimToList(item, currentClaimName, claims);
		}

		// If this item has nested property claims, recursively search within them
		if (item.propertyClaims && item.propertyClaims.length > 0) {
			listPropertyClaims(
				item.propertyClaims,
				currentClaimName,
				claims,
				true // Mark as nested
			);
		}

		// If this property claim has strategies, recursively search within them
		if (item.strategies && item.strategies.length > 0) {
			processStrategiesPropertyClaims(
				item.strategies,
				currentClaimName,
				claims
			);
		}
	}

	return claims;
};
