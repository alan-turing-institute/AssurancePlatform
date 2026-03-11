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

// Helper to update strategies with nested evidence immutably
const updateStrategiesWithEvidence = (
	strategies: StrategyResponse[],
	id: string,
	newEvidence: Partial<EvidenceResponse>
): { strategies: StrategyResponse[]; found: boolean } => {
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
	claim: PropertyClaimResponse,
	id: string,
	newEvidence: Partial<EvidenceResponse>,
	alreadyFound: boolean
): { claim: PropertyClaimResponse; found: boolean } => {
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
	array: PropertyClaimResponse[],
	id: string,
	newEvidence: Partial<EvidenceResponse>
): PropertyClaimResponse[] => {
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
	array: PropertyClaimResponse[],
	id: string
): PropertyClaimResponse[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaimResponse = { ...item };

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
	array: PropertyClaimResponse[],
	evidence: EvidenceResponse,
	newClaimId: string
): PropertyClaimResponse[] =>
	array.map((item) => {
		// Create a new item object to avoid mutating the original
		const newItem: PropertyClaimResponse = { ...item };

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
	item: PropertyClaimResponse,
	id: string
): EvidenceResponse | null => {
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
	strategies: StrategyResponse[],
	id: string
): EvidenceResponse | null => {
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
	item: PropertyClaimResponse,
	id: string
): EvidenceResponse | null => {
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
	arr: PropertyClaimResponse[],
	id: string
): EvidenceResponse | null => {
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
	array: PropertyClaimResponse[],
	id: string,
	newEvidence: Partial<EvidenceResponse> & { propertyClaimId: string[] }
): PropertyClaimResponse[] => {
	// Find the existing evidence item
	const existingEvidence = searchInNestedStructuresForEvidence(array, id);

	// Remove evidence from its old location
	const arrayWithoutOldEvidence = removeEvidenceFromOldLocation(array, id);

	// Merge existing evidence properties with updated ones
	const updatedEvidence = {
		...(existingEvidence as EvidenceResponse),
		...newEvidence,
	} as EvidenceResponse;

	// Add evidence to the new location
	const newClaimId = newEvidence.propertyClaimId[0] ?? "";
	const updatedArray = addEvidenceToNewLocation(
		arrayWithoutOldEvidence,
		updatedEvidence,
		newClaimId
	);

	return updatedArray;
};
