/**
 * Evidence operations for assurance cases
 * Handles adding, updating, and moving evidence
 */

import type { Evidence, PropertyClaim, Strategy } from "@/types";

// Helper function to add evidence to a specific claim
const addEvidenceToSpecificClaim = (
	propertyClaim: PropertyClaim,
	newEvidence: Evidence
): void => {
	if (!propertyClaim.evidence) {
		propertyClaim.evidence = [];
	}
	propertyClaim.evidence.push(newEvidence);
};

// Helper function to search in nested property claims for evidence
const searchInNestedClaimsForEvidence = (
	propertyClaims: PropertyClaim[],
	parentId: number,
	newEvidence: Evidence
): boolean => {
	const found = addEvidenceToClaim(propertyClaims, parentId, newEvidence);
	return found;
};

// Helper function to search in strategies for evidence
const searchInStrategiesForEvidence = (
	strategies: Strategy[],
	parentId: number,
	newEvidence: Evidence
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
	array: PropertyClaim[],
	parentId: number,
	newEvidence: Evidence
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

// Helper to update strategies with nested evidence immutably
const updateStrategiesWithEvidence = (
	strategies: Strategy[],
	id: number,
	newEvidence: Partial<Evidence>
): { strategies: Strategy[]; found: boolean } => {
	let found = false;
	const result = strategies.map((strategy) => {
		if (found || !strategy.propertyClaims?.length) {
			return strategy;
		}
		const updated = updateEvidenceNested(
			strategy.propertyClaims,
			id,
			newEvidence
		);
		if (updated !== strategy.propertyClaims) {
			found = true;
			return { ...strategy, propertyClaims: updated };
		}
		return strategy;
	});
	return { strategies: found ? result : strategies, found };
};

// Helper to process a single property claim for evidence update immutably
const processClaimForEvidenceUpdate = (
	claim: PropertyClaim,
	id: number,
	newEvidence: Partial<Evidence>,
	alreadyFound: boolean
): { claim: PropertyClaim; found: boolean } => {
	if (alreadyFound) {
		return { claim, found: false };
	}

	// Check evidence array
	if (claim.evidence?.length) {
		const evidenceIndex = claim.evidence.findIndex((e) => e.id === id);
		if (evidenceIndex !== -1) {
			const updatedEvidence = claim.evidence.map((e, i) =>
				i === evidenceIndex ? { ...e, ...newEvidence } : e
			);
			return {
				claim: { ...claim, evidence: updatedEvidence },
				found: true,
			};
		}
	}

	// Check nested property claims
	if (claim.propertyClaims?.length) {
		const nested = updateEvidenceNested(claim.propertyClaims, id, newEvidence);
		if (nested !== claim.propertyClaims) {
			return {
				claim: { ...claim, propertyClaims: nested },
				found: true,
			};
		}
	}

	// Check strategies
	if (claim.strategies?.length) {
		const { strategies, found } = updateStrategiesWithEvidence(
			claim.strategies,
			id,
			newEvidence
		);
		if (found) {
			return { claim: { ...claim, strategies }, found: true };
		}
	}

	return { claim, found: false };
};

/**
 * Recursively updates evidence in a nested structure using immutable patterns.
 * Returns a NEW array reference when updates are made, ensuring React detects changes.
 */
export const updateEvidenceNested = (
	array: PropertyClaim[],
	id: number,
	newEvidence: Partial<Evidence>
): PropertyClaim[] => {
	if (!array || array.length === 0) {
		return array;
	}

	let found = false;
	const result = array.map((claim) => {
		const { claim: updated, found: wasFound } = processClaimForEvidenceUpdate(
			claim,
			id,
			newEvidence,
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
 * Recursively removes evidence from its old location in a nested structure by ID.
 * Uses immutable patterns - returns NEW object references to ensure React detects changes.
 */
const removeEvidenceFromOldLocation = (
	array: PropertyClaim[],
	id: number
): PropertyClaim[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaim = { ...item };

		if (newItem.evidence) {
			newItem.evidence = newItem.evidence.filter(
				(evidence) => evidence.id !== id
			);
		}

		if (newItem.propertyClaims) {
			newItem.propertyClaims = removeEvidenceFromOldLocation(
				newItem.propertyClaims,
				id
			);
		}

		if (newItem.strategies) {
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.propertyClaims) {
					return {
						...strategy,
						propertyClaims: removeEvidenceFromOldLocation(
							strategy.propertyClaims,
							id
						),
					};
				}
				return strategy;
			});
		}

		return newItem;
	});

/**
 * Adds evidence to a specified property claim by ID in a nested structure.
 * Uses immutable patterns - returns NEW object references to ensure React detects changes.
 */
const addEvidenceToNewLocation = (
	array: PropertyClaim[],
	evidence: Evidence,
	newClaimId: number
): PropertyClaim[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaim = { ...item };

		if (newItem.id === newClaimId) {
			// Create new evidence array with the added evidence
			newItem.evidence = [...(newItem.evidence || []), evidence];
		}

		if (newItem.propertyClaims) {
			newItem.propertyClaims = addEvidenceToNewLocation(
				newItem.propertyClaims,
				evidence,
				newClaimId
			);
		}

		if (newItem.strategies) {
			newItem.strategies = newItem.strategies.map((strategy) => {
				if (strategy.propertyClaims) {
					return {
						...strategy,
						propertyClaims: addEvidenceToNewLocation(
							strategy.propertyClaims,
							evidence,
							newClaimId
						),
					};
				}
				return strategy;
			});
		}

		return newItem;
	});

// Helper function to search for evidence in item
const searchEvidenceInItem = (
	item: PropertyClaim,
	id: number
): Evidence | null => {
	if (item.evidence) {
		for (const evidence of item.evidence) {
			if (evidence.id === id) {
				return evidence;
			}
		}
	}
	return null;
};

// Helper function to search in strategy property claims for evidence
const searchInStrategyClaimsForEvidence = (
	strategies: Strategy[],
	id: number
): Evidence | null => {
	for (const strategy of strategies) {
		if (strategy.propertyClaims) {
			const found = searchInNestedStructuresForEvidence(
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

// Helper function to search a single property claim for evidence
const searchSinglePropertyClaimForEvidence = (
	item: PropertyClaim,
	id: number
): Evidence | null => {
	const found = searchEvidenceInItem(item, id);
	if (found) {
		return found;
	}

	if (item.propertyClaims) {
		const nestedFound = searchInNestedStructuresForEvidence(
			item.propertyClaims,
			id
		);
		if (nestedFound) {
			return nestedFound;
		}
	}

	if (item.strategies) {
		const strategyFound = searchInStrategyClaimsForEvidence(
			item.strategies,
			id
		);
		if (strategyFound) {
			return strategyFound;
		}
	}

	return null;
};

// Helper function to search in nested structures for evidence
const searchInNestedStructuresForEvidence = (
	arr: PropertyClaim[],
	id: number
): Evidence | null => {
	for (const item of arr) {
		const found = searchSinglePropertyClaimForEvidence(item, id);
		if (found) {
			return found;
		}
	}
	return null;
};

/**
 * Updates and moves evidence to a new location within a nested structure.
 */
export const updateEvidenceNestedMove = (
	array: PropertyClaim[],
	id: number,
	newEvidence: Partial<Evidence> & { propertyClaimId: number[] }
): PropertyClaim[] => {
	// Find the existing evidence item
	const existingEvidence = searchInNestedStructuresForEvidence(array, id);

	// Remove evidence from its old location
	const arrayWithoutOldEvidence = removeEvidenceFromOldLocation(array, id);

	// Merge existing evidence properties with updated ones
	const updatedEvidence = {
		...(existingEvidence as Evidence),
		...newEvidence,
	} as Evidence;

	// Add evidence to the new location
	const newClaimId = newEvidence.propertyClaimId[0] ?? 0;
	const updatedArray = addEvidenceToNewLocation(
		arrayWithoutOldEvidence,
		updatedEvidence,
		newClaimId
	);

	return updatedArray;
};
