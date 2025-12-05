/**
 * Property claims operations for assurance cases
 * Handles adding, updating, moving, and listing property claims
 */

import type { PropertyClaim, Strategy } from "@/types";

// Regular expressions
const NUMERIC_ID_PATTERN = /^\d+$/;

// Helper function to add property claim to a specific claim
const addPropertyClaimToSpecificClaim = (
	propertyClaim: PropertyClaim,
	newPropertyClaim: PropertyClaim
): void => {
	if (!propertyClaim.property_claims) {
		propertyClaim.property_claims = [];
	}
	propertyClaim.property_claims.push(newPropertyClaim);
};

// Helper function to search in nested property claims
const searchInNestedPropertyClaims = (
	propertyClaims: PropertyClaim[],
	parentId: number,
	newPropertyClaim: PropertyClaim
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
	strategies: Strategy[],
	parentId: number,
	newPropertyClaim: PropertyClaim
): boolean => {
	for (const strategy of strategies) {
		// Check if this strategy matches the parent ID
		if (strategy.id === parentId) {
			// Initialize property_claims array if it doesn't exist
			if (!strategy.property_claims) {
				strategy.property_claims = [];
			}
			strategy.property_claims.push(newPropertyClaim);
			return true;
		}
		// If the strategy has property claims, search within them
		if (strategy.property_claims && strategy.property_claims.length > 0) {
			const found = addPropertyClaimToNested(
				strategy.property_claims,
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
	propertyClaims: PropertyClaim[],
	parentId: number,
	newPropertyClaim: PropertyClaim
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
			propertyClaim.property_claims &&
			propertyClaim.property_claims.length > 0
		) {
			const found = searchInNestedPropertyClaims(
				propertyClaim.property_claims,
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
	strategies: Strategy[],
	id: number,
	newPropertyClaim: Partial<PropertyClaim>
): { strategies: Strategy[]; found: boolean } => {
	let found = false;
	const result = strategies.map((strategy) => {
		if (found || !strategy.property_claims?.length) {
			return strategy;
		}
		const updated = updatePropertyClaimNested(
			strategy.property_claims,
			id,
			newPropertyClaim
		);
		if (updated !== strategy.property_claims) {
			found = true;
			return { ...strategy, property_claims: updated };
		}
		return strategy;
	});
	return { strategies: found ? result : strategies, found };
};

// Helper to process a single property claim immutably
const processClaimUpdate = (
	claim: PropertyClaim,
	id: number,
	newData: Partial<PropertyClaim>,
	alreadyFound: boolean
): { claim: PropertyClaim; found: boolean } => {
	if (alreadyFound) {
		return { claim, found: false };
	}

	// Direct match - check for both API format ("property_claim") and legacy format ("PropertyClaim")
	if (
		claim.id === id &&
		(claim.type === "property_claim" || claim.type === "PropertyClaim")
	) {
		return { claim: { ...claim, ...newData }, found: true };
	}

	// Check nested claims
	if (claim.property_claims?.length) {
		const nested = updatePropertyClaimNested(
			claim.property_claims,
			id,
			newData
		);
		if (nested !== claim.property_claims) {
			return {
				claim: { ...claim, property_claims: nested },
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
	array: PropertyClaim[],
	id: number,
	newPropertyClaim: Partial<PropertyClaim>
): PropertyClaim[] => {
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
	array: PropertyClaim[],
	id: number
): PropertyClaim[] => {
	return array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaim = { ...item };

		if (newItem.property_claims) {
			// Filter out the claim with the given id
			newItem.property_claims = newItem.property_claims.filter(
				(claim) => claim.id !== id
			);
			// Recursively remove the claim from nested property_claims
			newItem.property_claims = removePropertyClaimFromOldLocation(
				newItem.property_claims,
				id
			);
		}

		if (newItem.strategies) {
			// Recursively process each strategy with immutable updates
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.property_claims) {
					// Filter out the claim with the given id from the strategy's property_claims
					const filteredClaims = strategy.property_claims.filter(
						(claim) => claim.id !== id
					);
					// Recursively remove the claim from the strategy's nested property_claims
					return {
						...strategy,
						property_claims: removePropertyClaimFromOldLocation(
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
	array: PropertyClaim[],
	property_claim: PropertyClaim,
	newParentId: number
): PropertyClaim[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaim = { ...item };

		if (newItem.id === newParentId) {
			// Create new array with the added property claim
			newItem.property_claims = [
				...(newItem.property_claims || []),
				property_claim,
			];
		} else if (newItem.property_claims) {
			newItem.property_claims = addPropertyClaimToLocation(
				newItem.property_claims,
				property_claim,
				newParentId
			);
		}

		if (newItem.strategies) {
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.id === newParentId) {
					// Create new strategy with added property claim
					return {
						...strategy,
						property_claims: [
							...(strategy.property_claims || []),
							property_claim,
						],
					};
				}

				if (strategy.property_claims) {
					return {
						...strategy,
						property_claims: addPropertyClaimToLocation(
							strategy.property_claims,
							property_claim,
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
	item: PropertyClaim,
	id: number
): PropertyClaim | null => {
	if (
		item.id === id &&
		(item.type === "property_claim" || item.type === "PropertyClaim")
	) {
		return item;
	}
	return null;
};

// Helper function to search in property claims of strategies
const searchInStrategyPropertyClaims = (
	strategies: Strategy[],
	id: number
): PropertyClaim | null => {
	for (const strategy of strategies) {
		if (strategy.property_claims) {
			const found = searchInNestedPropertyClaimsRecursive(
				strategy.property_claims,
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
	item: PropertyClaim,
	id: number
): PropertyClaim | null => {
	const found = searchPropertyClaimInItem(item, id);
	if (found) {
		return found;
	}

	if (item.property_claims) {
		const nestedFound = searchInNestedPropertyClaimsRecursive(
			item.property_claims,
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
	arr: PropertyClaim[],
	id: number
): PropertyClaim | null => {
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
	updatedPropertyClaim: PropertyClaim
): number | null => {
	if (updatedPropertyClaim.goal_id !== null) {
		return updatedPropertyClaim.goal_id;
	}
	if (updatedPropertyClaim.strategy_id !== null) {
		return updatedPropertyClaim.strategy_id;
	}
	if (updatedPropertyClaim.property_claim_id !== null) {
		return updatedPropertyClaim.property_claim_id;
	}
	return null;
};

/**
 * Updates a property claim's location and properties in a nested array structure.
 */
export const updatePropertyClaimNestedMove = (
	array: PropertyClaim[],
	id: number,
	newPropertyClaim: Partial<PropertyClaim> & { property_claim_id?: number }
): PropertyClaim[] => {
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
	} as PropertyClaim;

	// Determine the new parent ID
	const newParentId = determineNewParentId(updatedPropertyClaim);

	const updatedArray = addPropertyClaimToLocation(
		arrayWithoutOldPropertyClaim,
		updatedPropertyClaim,
		newParentId as number
	);

	return updatedArray;
};

// Helper function to check and add property claim to list
const addPropertyClaimToList = (
	item: PropertyClaim,
	currentClaimName: string,
	claims: PropertyClaim[]
): void => {
	// Skip null/undefined items
	if (!item || typeof item !== "object") {
		return;
	}

	// Check if currentClaimName is actually an ID (numeric string)
	const isIdComparison = NUMERIC_ID_PATTERN.test(currentClaimName);

	if (item.type === "property_claim" || item.type === "PropertyClaim") {
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
	strategies: Strategy[],
	currentClaimName: string,
	claims: PropertyClaim[]
): void => {
	for (const strategy of strategies) {
		if (strategy.property_claims && strategy.property_claims.length > 0) {
			listPropertyClaims(
				strategy.property_claims,
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
	array: PropertyClaim[],
	currentClaimName: string,
	claims: PropertyClaim[] = [],
	isNested = false
): PropertyClaim[] => {
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
		if (item.property_claims && item.property_claims.length > 0) {
			listPropertyClaims(
				item.property_claims,
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
