import type {
  AssuranceCase,
  Context,
  Evidence,
  Goal,
  PropertyClaim,
  Strategy,
} from '@/types';

interface Map {
  [key: string]: string | undefined;
}

// Extended CaseNode interface with proper typing
interface CaseNode {
  hidden: boolean;
  id: number;
  type: string;
  name?: string;
  goals?: Goal[];
  context?: Context[];
  property_claims?: PropertyClaim[];
  strategies?: Strategy[];
  evidence?: Evidence[];
  childrenHidden?: boolean;
  originalHidden?: boolean;
  [key: string]: unknown;
}

// Node type for React Flow integration
export interface ReactFlowNode {
  id: string;
  type: string;
  data: {
    id: number;
    name: string;
    type: string;
    goal_id?: number | null;
    strategy_id?: number | null;
    property_claim_id?: number | number[] | null;
    context?: Context[];
    property_claims?: PropertyClaim[];
    strategies?: Strategy[];
    evidence?: Evidence[];
    [key: string]: unknown;
  };
  position: { x: number; y: number };
}

// API Response types
interface ApiNodeResponse {
  id: number;
  name: string;
  short_description: string;
  long_description: string;
  type: string;
  [key: string]: unknown;
}

// Payload types for API requests
interface DetachPayload {
  goal_id: number | null;
  strategy_id: number | null;
  property_claim_id: number | null;
}

// Comment type for API operations
interface CommentPayload {
  content: string;
  [key: string]: unknown;
}

// Type for node creation payloads
type CreateNodePayload =
  | Partial<Goal>
  | Partial<Context>
  | Partial<Strategy>
  | Partial<PropertyClaim>
  | Partial<Evidence>;

// Type for nested array items that can contain various node types
export type NestedArrayItem =
  | Goal
  | PropertyClaim
  | Strategy
  | Context
  | Evidence;

// Type guard to check if an object has property_claims
function _hasPropertyClaims(
  obj: unknown
): obj is { property_claims: PropertyClaim[] } {
  return typeof obj === 'object' && obj !== null && 'property_claims' in obj;
}

// Type guard to check if an object has strategies
function _hasStrategies(obj: unknown): obj is { strategies: Strategy[] } {
  return typeof obj === 'object' && obj !== null && 'strategies' in obj;
}

const DESCRIPTION_FROM_TYPE: Map = {
  goal: 'Goal',
  context: 'Context',
  strategy: 'Strategy',
  property: 'Property Claim',
  evidence: 'Evidence',
};

export const caseItemDescription = (caseItemName: string) =>
  DESCRIPTION_FROM_TYPE[caseItemName] || caseItemName;

/**
 * Recursively adds a new property claim to a specified parent property claim by ID.
 *
 * @param propertyClaims - The array of property claims to search through.
 * @param parentId - The ID of the parent property claim to which the new claim will be added.
 * @param newPropertyClaim - The new property claim to be added.
 * @returns Returns true if the property claim was found and updated, otherwise false.
 */
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
// TODO: Evidence and Property Claims are doing a similar actions when moving this can be refactored.

/**
 * Recursively updates a property claim in a nested array structure by ID.
 *
 * This function searches through the given array of property claims and updates
 * the matching property claim with new properties provided in `newPropertyClaim`.
 *
 * @param array - The array of property claims to search through.
 * @param id - The ID of the property claim to be updated.
 * @param newPropertyClaim - An object containing the properties to update the property claim with.
 * @returns Returns the updated array if the property claim is found and updated, otherwise null.
 */
// Helper function to update a property claim in place
const updatePropertyClaimInPlace = (
  array: PropertyClaim[],
  index: number,
  propertyClaim: PropertyClaim,
  newPropertyClaim: Partial<PropertyClaim>
): void => {
  array[index] = { ...propertyClaim, ...newPropertyClaim };
};

// Helper function to search and update in nested property claims
const searchAndUpdateInNestedClaims = (
  propertyClaims: PropertyClaim[],
  id: number,
  newPropertyClaim: Partial<PropertyClaim>
): PropertyClaim[] | null => {
  return updatePropertyClaimNested(propertyClaims, id, newPropertyClaim);
};

// Helper function to search and update in strategies
const searchAndUpdateInStrategiesClaims = (
  strategies: Strategy[],
  id: number,
  newPropertyClaim: Partial<PropertyClaim>
): PropertyClaim[] | null => {
  for (const strategy of strategies) {
    if (strategy.property_claims && strategy.property_claims.length > 0) {
      const updatedNestedArray = updatePropertyClaimNested(
        strategy.property_claims,
        id,
        newPropertyClaim
      );
      if (updatedNestedArray) {
        return updatedNestedArray;
      }
    }
  }
  return null;
};

// Helper function to process a single property claim
const processPropertyClaimForUpdate = (
  array: PropertyClaim[],
  index: number,
  propertyClaim: PropertyClaim,
  id: number,
  newPropertyClaim: Partial<PropertyClaim>
): PropertyClaim[] | null => {
  // Check if this property claim matches the parent ID
  if (propertyClaim.id === id && propertyClaim.type === 'PropertyClaim') {
    updatePropertyClaimInPlace(array, index, propertyClaim, newPropertyClaim);
    return array;
  }

  // Check nested property claims
  if (propertyClaim.property_claims?.length) {
    const result = searchAndUpdateInNestedClaims(
      propertyClaim.property_claims,
      id,
      newPropertyClaim
    );
    if (result) {
      return array;
    }
  }

  // Check strategies
  if (propertyClaim.strategies?.length) {
    const result = searchAndUpdateInStrategiesClaims(
      propertyClaim.strategies,
      id,
      newPropertyClaim
    );
    if (result) {
      return array;
    }
  }

  return null;
};

export const updatePropertyClaimNested = (
  array: PropertyClaim[],
  id: number,
  newPropertyClaim: Partial<PropertyClaim>
): PropertyClaim[] | null => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    const result = processPropertyClaimForUpdate(
      array,
      i,
      array[i],
      id,
      newPropertyClaim
    );
    if (result) {
      return result;
    }
  }

  return null; // Indicates the parent property claim was not found
};

/**
 * Recursively removes a property claim from its old location in a nested array structure by ID.
 *
 * This function searches through the provided array, filtering out the property claim
 * with the specified ID and its occurrences in nested property claims and strategies.
 *
 * @param array - The array of property claims to process.
 * @param id - The ID of the property claim to remove.
 * @returns A new array with the specified property claim removed.
 */
const removePropertyClaimFromOldLocation = (
  array: PropertyClaim[],
  id: number
): PropertyClaim[] => {
  return array.map((item) => {
    if (item.property_claims) {
      // Filter out the claim with the given id
      item.property_claims = item.property_claims.filter(
        (claim) => claim.id !== id
      );
      // Recursively remove the claim from nested property_claims
      item.property_claims = removePropertyClaimFromOldLocation(
        item.property_claims,
        id
      );
    }

    if (item.strategies) {
      // Recursively process each strategy
      item.strategies = item.strategies.map((strategy) => {
        if (strategy.property_claims) {
          // Filter out the claim with the given id from the strategy's property_claims
          strategy.property_claims = strategy.property_claims.filter(
            (claim) => claim.id !== id
          );
          // Recursively remove the claim from the strategy's nested property_claims
          strategy.property_claims = removePropertyClaimFromOldLocation(
            strategy.property_claims,
            id
          );
        }
        return strategy;
      });
    }

    return item;
  });
};

/**
 * Recursively adds a property claim to a specified location in a nested array structure.
 *
 * This function searches for the parent ID in the provided array and adds the
 * new property claim to the property claims of the matching parent item.
 *
 * @param array - The array of property claims to search through.
 * @param property_claim - The property claim to be added.
 * @param newParentId - The ID of the parent property claim where the new claim should be added.
 * @returns A new array with the property claim added to the specified location.
 */
const addPropertyClaimToLocation = (
  array: PropertyClaim[],
  property_claim: PropertyClaim,
  newParentId: number
): PropertyClaim[] => {
  return array.map((item) => {
    if (item.id === newParentId) {
      if (!item.property_claims) {
        item.property_claims = [];
      }
      item.property_claims.push(property_claim);
    }

    if (item.property_claims) {
      item.property_claims = addPropertyClaimToLocation(
        item.property_claims,
        property_claim,
        newParentId
      );
    }

    if (item.strategies) {
      item.strategies = item.strategies.map((strategy) => {
        if (strategy.id === newParentId) {
          if (!strategy.property_claims) {
            strategy.property_claims = [];
          }
          strategy.property_claims.push(property_claim);
        }

        if (strategy.property_claims) {
          strategy.property_claims = addPropertyClaimToLocation(
            strategy.property_claims,
            property_claim,
            newParentId
          );
        }
        return strategy;
      });
    }

    return item;
  });
};

/**
 * Updates a property claim's location and properties in a nested array structure.
 *
 * This function finds an existing property claim by ID, removes it from its old location,
 * merges the new properties, and adds it to the new specified location.
 *
 * @param array - The array of property claims to search through.
 * @param id - The ID of the property claim to be updated.
 * @param newPropertyClaim - An object containing the properties to update the property claim with.
 * @returns A new array with the property claim updated and moved to the new location.
 */
// Helper function to search for property claim in item
const searchPropertyClaimInItem = (
  item: PropertyClaim,
  id: number
): PropertyClaim | null => {
  if (item.id === id && item.type === 'PropertyClaim') {
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

/**
 * Recursively lists all property claims except the specified current claim.
 *
 * This function traverses a nested array of property claims and collects
 * all claims that are of type "PropertyClaim" and do not match the current
 * claim name provided.
 *
 * @param array - The array of property claims to search through.
 * @param currentClaimName - The name of the current claim to exclude.
 * @param claims - An array to accumulate the found property claims (used for recursion).
 * @returns An array of property claims excluding the specified current claim.
 */
// Helper function to check and add property claim to list
const addPropertyClaimToList = (
  item: PropertyClaim,
  currentClaimName: string,
  claims: PropertyClaim[]
): void => {
  if (item.type === 'PropertyClaim' && item.name !== currentClaimName) {
    claims.push(item);
  }
};

// Helper function to process nested property claims
const processNestedPropertyClaims = (
  propertyClaims: PropertyClaim[],
  currentClaimName: string,
  claims: PropertyClaim[]
): void => {
  listPropertyClaims(propertyClaims, currentClaimName, claims);
};

// Helper function to process strategies with property claims
const processStrategiesPropertyClaims = (
  strategies: Strategy[],
  currentClaimName: string,
  claims: PropertyClaim[]
): void => {
  for (const strategy of strategies) {
    if (strategy.property_claims && strategy.property_claims.length > 0) {
      listPropertyClaims(strategy.property_claims, currentClaimName, claims);
    }
  }
};

export const listPropertyClaims = (
  array: PropertyClaim[],
  currentClaimName: string,
  claims: PropertyClaim[] = []
): PropertyClaim[] => {
  // Iterate through the property claims array
  for (const item of array) {
    addPropertyClaimToList(item, currentClaimName, claims);

    // If this item has nested property claims, recursively search within them
    if (item.property_claims && item.property_claims.length > 0) {
      processNestedPropertyClaims(
        item.property_claims,
        currentClaimName,
        claims
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

/**
 * Adds evidence to a specified property claim by ID.
 *
 * This function searches for a property claim in a nested structure and,
 * upon finding it, adds the new evidence to that claim. If the claim does
 * not have an evidence array, it initializes one.
 *
 * @param array - The array of property claims to search through.
 * @param parentId - The ID of the property claim to which the evidence should be added.
 * @param newEvidence - The evidence object to add to the property claim.
 * @returns True if the property claim was found and updated; false otherwise.
 */
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
    if (strategy.property_claims && strategy.property_claims.length > 0) {
      const found = addEvidenceToClaim(
        strategy.property_claims,
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
      propertyClaim.property_claims &&
      propertyClaim.property_claims.length > 0
    ) {
      const found = searchInNestedClaimsForEvidence(
        propertyClaim.property_claims,
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
// TODO: Evidence and Property Claims are doing a similar actions when moving this can be refactored.

/**
 * Updates evidence in a nested structure by ID.
 *
 * This function recursively searches through the nested array and updates the
 * evidence with the given ID, merging the existing properties with the new ones.
 *
 * @param array - The array of property claims to search through.
 * @param id - The ID of the evidence to update.
 * @param newEvidence - An object containing the properties to update the evidence with.
 * @returns The updated array with the evidence modified, or null if not found.
 */
// Helper function to update evidence in place
const _updateEvidenceInPlace = (
  array: Evidence[],
  index: number,
  item: Evidence,
  newEvidence: Partial<Evidence>
): void => {
  array[index] = { ...item, ...newEvidence };
};

// Helper function to search and update in evidence array
const _searchAndUpdateInEvidence = (
  evidence: Evidence[],
  id: number,
  newEvidence: Partial<Evidence>
): Evidence[] | null => {
  for (let i = 0; i < evidence.length; i++) {
    if (evidence[i].id === id) {
      evidence[i] = { ...evidence[i], ...newEvidence };
      return evidence;
    }
  }
  return null;
};

// Helper function to search and update in nested property claims for evidence
const searchAndUpdateInNestedClaimsEvidence = (
  propertyClaims: PropertyClaim[],
  id: number,
  newEvidence: Partial<Evidence>
): PropertyClaim[] | null => {
  return updateEvidenceNested(propertyClaims, id, newEvidence);
};

// Helper function to search and update in strategies for evidence
const searchAndUpdateInStrategiesEvidence = (
  strategies: Strategy[],
  id: number,
  newEvidence: Partial<Evidence>
): PropertyClaim[] | null => {
  for (const strategy of strategies) {
    if (strategy.property_claims && strategy.property_claims.length > 0) {
      const updatedNestedArray = updateEvidenceNested(
        strategy.property_claims,
        id,
        newEvidence
      );
      if (updatedNestedArray) {
        return updatedNestedArray;
      }
    }
  }
  return null;
};

// Helper function to process a single item for evidence update
const processItemForEvidenceUpdate = (
  array: PropertyClaim[],
  _index: number,
  item: PropertyClaim,
  id: number,
  newEvidence: Partial<Evidence>
): PropertyClaim[] | null => {
  // Check if this evidence matches the parent ID - this check is actually wrong for evidence update
  // Skip this check as PropertyClaim items shouldn't match Evidence IDs
  // if (item.id === id) {
  //   updateEvidenceInPlace(array, index, item, newEvidence);
  //   return array;
  // }

  // Check evidence array
  if (item.evidence?.length) {
    for (let i = 0; i < item.evidence.length; i++) {
      if (item.evidence[i].id === id) {
        item.evidence[i] = { ...item.evidence[i], ...newEvidence };
        return array;
      }
    }
  }

  // Check nested property claims
  if (item.property_claims?.length) {
    const result = searchAndUpdateInNestedClaimsEvidence(
      item.property_claims,
      id,
      newEvidence
    );
    if (result) {
      return array;
    }
  }

  // Check strategies
  if (item.strategies?.length) {
    const result = searchAndUpdateInStrategiesEvidence(
      item.strategies,
      id,
      newEvidence
    );
    if (result) {
      return array;
    }
  }

  return null;
};

export const updateEvidenceNested = (
  array: PropertyClaim[],
  id: number,
  newEvidence: Partial<Evidence>
): PropertyClaim[] | null => {
  // Iterate through the array
  for (let i = 0; i < array.length; i++) {
    const result = processItemForEvidenceUpdate(
      array,
      i,
      array[i],
      id,
      newEvidence
    );
    if (result) {
      return result;
    }
  }

  // If evidence with the given ID is not found, return null
  return null;
};

/**
 * Recursively removes evidence from its old location in a nested structure by ID.
 *
 * This function searches through the array and filters out the evidence
 * with the specified ID, including nested structures.
 *
 * @param array - The array of property claims to process.
 * @param id - The ID of the evidence to remove.
 * @returns A new array with the specified evidence removed.
 */
const removeEvidenceFromOldLocation = (
  array: PropertyClaim[],
  id: number
): PropertyClaim[] => {
  return array.map((item) => {
    if (item.evidence) {
      item.evidence = item.evidence.filter((evidence) => evidence.id !== id);
    }

    if (item.property_claims) {
      item.property_claims = removeEvidenceFromOldLocation(
        item.property_claims,
        id
      );
    }

    if (item.strategies) {
      item.strategies = item.strategies.map((strategy) => {
        if (strategy.property_claims) {
          strategy.property_claims = removeEvidenceFromOldLocation(
            strategy.property_claims,
            id
          );
        }
        return strategy;
      });
    }

    return item;
  });
};

/**
 * Adds evidence to a specified property claim by ID in a nested structure.
 *
 * This function recursively searches for the property claim with the specified
 * ID and, upon finding it, adds the new evidence to that claim. If the claim
 * does not have an evidence array, it initializes one.
 *
 * @param array - The array of property claims to search through.
 * @param evidence - The evidence object to add to the property claim.
 * @param newClaimId - The ID of the property claim where the evidence should be added.
 * @returns The updated array with the evidence added to the specified claim.
 */
const addEvidenceToNewLocation = (
  array: PropertyClaim[],
  evidence: Evidence,
  newClaimId: number
): PropertyClaim[] => {
  return array.map((item) => {
    if (item.id === newClaimId) {
      if (!item.evidence) {
        item.evidence = [];
      }
      item.evidence.push(evidence);
    }

    if (item.property_claims) {
      item.property_claims = addEvidenceToNewLocation(
        item.property_claims,
        evidence,
        newClaimId
      );
    }

    if (item.strategies) {
      item.strategies = item.strategies.map((strategy) => {
        if (strategy.property_claims) {
          strategy.property_claims = addEvidenceToNewLocation(
            strategy.property_claims,
            evidence,
            newClaimId
          );
        }
        return strategy;
      });
    }

    return item;
  });
};

/**
 * Updates and moves evidence to a new location within a nested structure.
 *
 * This function finds the existing evidence by its ID, removes it from its
 * old location, merges the existing properties with new ones, and adds it
 * to a new specified property claim.
 *
 * @param {any[]} array - The array of property claims to process.
 * @param {any} id - The ID of the evidence to be updated and moved.
 * @param {any} newEvidence - An object containing the properties to update the evidence with.
 * @returns {any[]} The updated array with the evidence moved to the new location.
 */
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
    if (strategy.property_claims) {
      const found = searchInNestedStructuresForEvidence(
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

// Helper function to search a single property claim for evidence
const searchSinglePropertyClaimForEvidence = (
  item: PropertyClaim,
  id: number
): Evidence | null => {
  const found = searchEvidenceInItem(item, id);
  if (found) {
    return found;
  }

  if (item.property_claims) {
    const nestedFound = searchInNestedStructuresForEvidence(
      item.property_claims,
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

export const updateEvidenceNestedMove = (
  array: PropertyClaim[],
  id: number,
  newEvidence: Partial<Evidence> & { property_claim_id: number[] }
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
  const newClaimId = newEvidence.property_claim_id[0];
  const updatedArray = addEvidenceToNewLocation(
    arrayWithoutOldEvidence,
    updatedEvidence,
    newClaimId
  );

  return updatedArray;
};

/**
 * Creates a new assurance case node by sending a POST request to the specified API endpoint.
 *
 * @param {string} entity - The type of entity to create (e.g., "context", "strategy").
 * @param {any} newItem - The data for the new assurance case node to be created.
 * @param {string | null} token - The authorization token for API access. If null, the function logs an error and exits.
 * @returns {Promise<{ data?: any, error?: string }>} A promise that resolves to an object containing either the created node data or an error message.
 */
export const createAssuranceCaseNode = async (
  entity: string,
  newItem: CreateNodePayload,
  token: string | null
): Promise<{ data?: ApiNodeResponse; error?: string | unknown }> => {
  if (!token) {
    return { error: 'No token' };
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/`;

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newItem),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    const result = await response.json();

    const data = {
      ...result,
      id: result.id,
    };

    return { data };
  } catch (error) {
    return { error };
  }
};

/**
 * Deletes an assurance case node by sending a DELETE request to the specified API endpoint.
 *
 * @param {string} type - The type of node to delete (e.g., "context", "strategy").
 * @param {any} id - The unique identifier of the assurance case node to be deleted.
 * @param {string | null} token - The authorization token for API access. If null, the function logs an error and exits.
 * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful, otherwise false.
 */
export const deleteAssuranceCaseNode = async (
  type: string,
  id: number,
  token: string | null
): Promise<boolean | { error: string }> => {
  if (!token) {
    return { error: 'No token' };
  }

  let entity: string | null = null;
  switch (type.toLowerCase()) {
    case 'context':
      entity = 'contexts';
      break;
    case 'strategy':
      entity = 'strategies';
      break;
    case 'property':
      entity = 'propertyclaims';
      break;
    case 'evidence':
      entity = 'evidence';
      break;
    default:
      entity = 'goals';
      break;
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/`;

    const requestOptions: RequestInit = {
      method: 'DELETE',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await fetch(url, requestOptions);

    if (response.ok) {
      return true;
    }
    return { error: 'Failed to delete node' };
  } catch (_error) {
    return { error: 'An error occurred' };
  }
};

/**
 * Updates an existing assurance case node by sending a PUT request to the specified API endpoint.
 *
 * @param type - The type of node to update (e.g., "context", "strategy").
 * @param id - The unique identifier of the assurance case node to be updated.
 * @param token - The authorization token for API access. If null, the function logs an error and exits.
 * @param updateItem - The updated data for the assurance case node.
 * @returns A promise that resolves to true if the update was successful, otherwise false.
 */
export const updateAssuranceCaseNode = async (
  type: string,
  id: number,
  token: string | null,
  updateItem: unknown
): Promise<boolean | { error: string }> => {
  if (!token) {
    return { error: 'No token' };
  }

  let entity: string | null = null;
  switch (type) {
    case 'context':
      entity = 'contexts';
      break;
    case 'strategy':
      entity = 'strategies';
      break;
    case 'property':
      entity = 'propertyclaims';
      break;
    case 'evidence':
      entity = 'evidence';
      break;
    default:
      entity = 'goals';
      break;
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/`;

    const requestOptions: RequestInit = {
      method: 'PUT',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateItem),
    };
    const response = await fetch(url, requestOptions);

    if (response.ok) {
      return true;
    }
    return false;
  } catch (_error) {
    return false;
  }
};

export const getAssuranceCaseNode = async (
  type: string,
  id: number,
  token: string | null
): Promise<ApiNodeResponse | { error: string } | false> => {
  if (!token) {
    return { error: 'No token' };
  }

  let entity: string | null = null;
  switch (type) {
    case 'context':
      entity = 'contexts';
      break;
    case 'strategy':
      entity = 'strategies';
      break;
    case 'property':
      entity = 'propertyclaims';
      break;
    case 'evidence':
      entity = 'evidence';
      break;
    default:
      entity = 'goals';
      break;
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/`;

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      // Handle non-ok response
    }

    const result = await response.json();
    return result;
  } catch (_error) {
    return false;
  }
};

/**
 * Recursively searches for an item by its ID within a nested structure.
 *
 * @param {any} item - The item or node to search within.
 * @param {any} id - The ID of the item to find.
 * @returns {Promise<any | null>} The found item if it matches the ID, otherwise null.
 */
// Helper function to search in context items
const searchInContextItems = (
  context: Context[],
  id: number
): NestedArrayItem | null => {
  for (const contextItem of context) {
    const found = findItemById(contextItem, id);
    if (found) {
      return found;
    }
  }
  return null;
};

// Helper function to search in property claims
const searchInPropertyClaims = (
  propertyClaims: PropertyClaim[],
  id: number
): NestedArrayItem | null => {
  for (const propertyClaim of propertyClaims) {
    const found = findItemById(propertyClaim, id);
    if (found) {
      return found;
    }

    if (propertyClaim.property_claims) {
      for (const childPropertyClaim of propertyClaim.property_claims) {
        const childFound = findItemById(childPropertyClaim, id);
        if (childFound) {
          return childFound;
        }
      }
    }
  }
  return null;
};

// Helper function to search in evidence items
const searchInEvidenceItems = (
  evidence: Evidence[],
  id: number
): NestedArrayItem | null => {
  for (const evidenceItem of evidence) {
    const found = findItemById(evidenceItem, id);
    if (found) {
      return found;
    }
  }
  return null;
};

// Helper function to search in strategies
const searchInStrategyItems = (
  strategies: Strategy[],
  id: number
): NestedArrayItem | null => {
  for (const strategyItem of strategies) {
    const found = findItemById(strategyItem, id);
    if (found) {
      return found;
    }

    if (strategyItem.property_claims) {
      for (const childPropertyClaim of strategyItem.property_claims) {
        const childFound = findItemById(childPropertyClaim, id);
        if (childFound) {
          return childFound;
        }
      }
    }
  }
  return null;
};

// Helper function to search context if exists
const searchContextIfExists = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  if ('context' in item && (item as Goal).context) {
    return searchInContextItems((item as Goal).context, id);
  }
  return null;
};

// Helper function to search property claims if exists
const searchPropertyClaimsIfExists = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  if (
    'property_claims' in item &&
    (item as Goal | PropertyClaim | Strategy).property_claims
  ) {
    return searchInPropertyClaims(
      (item as Goal | PropertyClaim | Strategy).property_claims,
      id
    );
  }
  return null;
};

// Helper function to search evidence if exists
const searchEvidenceIfExists = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  if ('evidence' in item && (item as PropertyClaim).evidence) {
    return searchInEvidenceItems((item as PropertyClaim).evidence, id);
  }
  return null;
};

// Helper function to search strategies if exists
const searchStrategiesIfExists = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  if ('strategies' in item && (item as Goal).strategies) {
    return searchInStrategyItems((item as Goal).strategies, id);
  }
  return null;
};

// Helper function to search in all nested structures
const searchInAllNestedStructures = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  const contextResult = searchContextIfExists(item, id);
  if (contextResult) {
    return contextResult;
  }

  const propertyClaimsResult = searchPropertyClaimsIfExists(item, id);
  if (propertyClaimsResult) {
    return propertyClaimsResult;
  }

  const evidenceResult = searchEvidenceIfExists(item, id);
  if (evidenceResult) {
    return evidenceResult;
  }

  const strategiesResult = searchStrategiesIfExists(item, id);
  if (strategiesResult) {
    return strategiesResult;
  }

  return null;
};

export const findItemById = (
  item: NestedArrayItem | AssuranceCase,
  id: number
): NestedArrayItem | null => {
  // Check if it's an AssuranceCase (which doesn't match NestedArrayItem structure)
  if ('goals' in item && item.id === id) {
    // AssuranceCase cannot be returned as NestedArrayItem
    return null;
  }

  // For NestedArrayItem types
  if (item.id === id && 'type' in item) {
    return item as NestedArrayItem;
  }

  return searchInAllNestedStructures(item, id);
};

// Helper function to update context
const updateContext = (
  assuranceCase: AssuranceCase,
  id: number,
  updatedItem: Partial<Context>
): AssuranceCase => {
  const newContext = (assuranceCase.goals?.[0]?.context || []).map(
    (context: Context) => {
      if (context.id === id && context.type === 'Context') {
        return {
          ...context,
          ...updatedItem,
        };
      }
      return { ...context };
    }
  );

  return {
    ...assuranceCase,
    goals: assuranceCase.goals
      ? [{ ...assuranceCase.goals[0], context: newContext }]
      : [],
  };
};

// Helper function to update strategy
const updateStrategy = (
  assuranceCase: AssuranceCase,
  id: number,
  updatedItem: Partial<Strategy>
): AssuranceCase => {
  const newStrategy = (assuranceCase.goals?.[0]?.strategies || []).map(
    (strategy: Strategy) => {
      if (strategy.id === id && strategy.type === 'Strategy') {
        return {
          ...strategy,
          ...updatedItem,
        };
      }
      return { ...strategy };
    }
  );

  return {
    ...assuranceCase,
    goals: assuranceCase.goals
      ? [
          {
            ...assuranceCase.goals[0],
            strategies: newStrategy,
          },
        ]
      : [],
  };
};

// Helper function to update property claim
const updatePropertyClaim = (
  assuranceCase: AssuranceCase,
  id: number,
  updatedItem: Partial<PropertyClaim>,
  move: boolean
): AssuranceCase => {
  if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
    return assuranceCase;
  }

  const goal = assuranceCase.goals[0];
  let updatedPropertyClaims: PropertyClaim[] | null = null;

  if (move) {
    updatedPropertyClaims = updatePropertyClaimNestedMove(
      goal.property_claims || [],
      id,
      updatedItem as Partial<PropertyClaim> & { property_claim_id?: number }
    );
  } else {
    updatedPropertyClaims = updatePropertyClaimNested(
      goal.property_claims || [],
      id,
      updatedItem
    );
  }

  return {
    ...assuranceCase,
    goals: [
      {
        ...goal,
        property_claims: updatedPropertyClaims || goal.property_claims || [],
      },
    ],
  };
};

// Helper function to update evidence
const updateEvidence = (
  assuranceCase: AssuranceCase,
  id: number,
  updatedItem: Partial<Evidence>,
  move: boolean
): AssuranceCase => {
  if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
    return assuranceCase;
  }

  const goal = assuranceCase.goals[0];
  let updatedPropertyClaims: PropertyClaim[] | null = null;

  if (move) {
    updatedPropertyClaims = updateEvidenceNestedMove(
      goal.property_claims || [],
      id,
      updatedItem as Partial<Evidence> & { property_claim_id: number[] }
    );
  } else {
    updatedPropertyClaims = updateEvidenceNested(
      goal.property_claims || [],
      id,
      updatedItem
    );
  }

  return {
    ...assuranceCase,
    goals: [
      {
        ...goal,
        property_claims: updatedPropertyClaims || goal.property_claims || [],
      },
    ],
  };
};

/**
 * Updates an assurance case based on the provided type and item details.
 *
 * This function modifies the assurance case structure, including contexts, strategies,
 * property claims, and evidence. It returns the updated assurance case.
 *
 * @param {string} type - The type of item to update (e.g., "context", "strategy", "property", "evidence").
 * @param {any} assuranceCase - The assurance case object containing goals and their respective items.
 * @param {any} updatedItem - The new data to update the existing item.
 * @param {any} id - The unique identifier of the item to be updated.
 * @param {any} node - The node related to the item being updated (currently unused).
 * @param {boolean} [move=false] - A flag indicating whether the item should be moved (default is false).
 * @returns {any} The updated assurance case object.
 */
export const updateAssuranceCase = (
  type: string,
  assuranceCase: AssuranceCase,
  updatedItem:
    | Partial<Goal>
    | Partial<Context>
    | Partial<Strategy>
    | Partial<PropertyClaim>
    | Partial<Evidence>,
  id: number,
  _node: ReactFlowNode,
  move = false
): AssuranceCase => {
  switch (type) {
    case 'context':
      return updateContext(assuranceCase, id, updatedItem as Partial<Context>);

    case 'strategy':
      return updateStrategy(
        assuranceCase,
        id,
        updatedItem as Partial<Strategy>
      );

    case 'property':
      return updatePropertyClaim(
        assuranceCase,
        id,
        updatedItem as Partial<PropertyClaim>,
        move
      );

    case 'evidence':
      return updateEvidence(
        assuranceCase,
        id,
        updatedItem as Partial<Evidence>,
        move
      );

    default:
      return {
        ...assuranceCase,
        goals: assuranceCase.goals
          ? [
              {
                ...assuranceCase.goals[0],
                ...updatedItem,
              } as Goal,
            ]
          : [],
      };
  }
};

export const setNodeIdentifier = (
  parentNode: ReactFlowNode,
  newNodeType: string
): string => {
  let identifier = 0;
  let newArray: (Context | Strategy | PropertyClaim | Evidence)[] = [];
  let parentPrefix: number | null = null;

  switch (newNodeType.toLowerCase()) {
    case 'context':
      newArray = [...(parentNode.data.context || [])];
      break;
    case 'strategy':
      newArray = [...(parentNode.data.strategies || [])];
      break;
    case 'property':
      parentPrefix = Number.parseFloat(parentNode.data.name.substring(1));
      newArray = [...(parentNode.data.property_claims || [])];
      break;
    case 'evidence':
      newArray = [...(parentNode.data.evidence || [])];
      break;
    default:
      break;
  }

  if (newArray.length > 0) {
    const lastItem = newArray.pop();
    if (!lastItem) {
      return '1';
    }

    if (newNodeType === 'property' && parentNode.type === 'property') {
      const lastIdentifier = Number.parseFloat(
        lastItem.name.substring(1)
      ).toString();
      const subIdentifier = lastIdentifier.split('.')[1];
      identifier = Number.parseInt(subIdentifier, 10) + 1;
    } else {
      const lastIdentifier = Number.parseFloat(lastItem.name.substring(1));
      identifier = lastIdentifier + 1;
    }
  } else {
    identifier = 1;
  }

  if (parentNode && parentNode.type === 'property' && parentPrefix !== null) {
    return `${parentPrefix}.${identifier}`;
  }

  return identifier.toString();
};

/**
 * Recursively removes an item with a specific `id` and `type` from a deeply nested array structure.
 * The item can be located in various properties (`property_claims`, `strategies`, `context`, `evidence`)
 * within the nested structure, and will be removed from all such occurrences.
 *
 * @param {any[]} array - The root array from which to remove the item. This can contain nested structures.
 * @param {any} id - The unique identifier of the item to be removed.
 * @param {string} type - The type of the item to be removed, used along with the `id` to match the item.
 * @returns {any[]} A new array with the specified item removed from all levels of the nested structure.
 *
 */
const removeItemFromNestedStructure = (
  array: NestedArrayItem[],
  id: number,
  type: string
): NestedArrayItem[] => {
  return array
    .map((item: NestedArrayItem) => {
      // Remove from property_claims
      if ('property_claims' in item && item.property_claims) {
        (item as Goal | PropertyClaim | Strategy).property_claims = (
          item as Goal | PropertyClaim | Strategy
        ).property_claims.filter(
          (claim: PropertyClaim) => !(claim.id === id && claim.type === type)
        );
        (item as Goal | PropertyClaim | Strategy).property_claims =
          removeItemFromNestedStructure(
            (item as Goal | PropertyClaim | Strategy)
              .property_claims as unknown as NestedArrayItem[],
            id,
            type
          ) as unknown as PropertyClaim[];
      }

      // Remove from strategies
      if ('strategies' in item && item.strategies) {
        (item as Goal).strategies = (item as Goal).strategies
          .map((strategy: Strategy) => {
            if (strategy.property_claims) {
              strategy.property_claims = strategy.property_claims.filter(
                (claim: PropertyClaim) =>
                  !(claim.id === id && claim.type === type)
              );
              strategy.property_claims = removeItemFromNestedStructure(
                strategy.property_claims as unknown as NestedArrayItem[],
                id,
                type
              ) as unknown as PropertyClaim[];
            }
            return strategy;
          })
          .filter(
            (strategy: Strategy) =>
              !(strategy.id === id && strategy.type === type)
          );
      }

      // Remove from contexts
      if ('context' in item && item.context) {
        (item as Goal).context = (item as Goal).context.filter(
          (context: Context) => !(context.id === id && context.type === type)
        );
        (item as Goal).context = removeItemFromNestedStructure(
          (item as Goal).context as unknown as NestedArrayItem[],
          id,
          type
        ) as unknown as Context[];
      }

      // Remove from evidence
      if ('evidence' in item && item.evidence) {
        (item as PropertyClaim).evidence = (
          item as PropertyClaim
        ).evidence.filter(
          (evidence: Evidence) =>
            !(evidence.id === id && evidence.type === type)
        );
        (item as PropertyClaim).evidence = removeItemFromNestedStructure(
          (item as PropertyClaim).evidence as unknown as NestedArrayItem[],
          id,
          type
        ) as unknown as Evidence[];
      }

      return item;
    })
    .filter((item: NestedArrayItem) => !(item.id === id && item.type === type));
};

/**
 * Removes an assurance case node from the specified assurance case by its ID and type.
 *
 * @param {any} assuranceCase - The assurance case object containing goals and other relevant data.
 * @param {any} id - The unique identifier of the assurance case node to be removed.
 * @param {string} type - The type of the node to be removed (e.g., "context", "strategy").
 * @returns {any} A new assurance case object with the specified node removed from its goals.
 */
export const removeAssuranceCaseNode = (
  assuranceCase: AssuranceCase,
  id: number,
  type: string
): AssuranceCase => {
  const updatedGoals = removeItemFromNestedStructure(
    assuranceCase.goals as unknown as NestedArrayItem[],
    id,
    type
  ) as unknown as Goal[];
  return {
    ...assuranceCase,
    goals: updatedGoals,
  };
};

/**
 * Extracts goals, property claims, and strategies from a nested structure.
 *
 * @param {any} array - The array of items to traverse.
 * @returns {{ goal: any | null, claims: any[], strategies: any[] }} An object containing the extracted goal, claims, and strategies.
 */
// Helper function to collect goals
const collectGoal = (
  item: NestedArrayItem,
  result: {
    goal: Goal | null;
    claims: PropertyClaim[];
    strategies: (Goal | PropertyClaim | Strategy)[];
  }
): void => {
  if (item.type === 'TopLevelNormativeGoal') {
    result.goal = item as Goal;
  }
};

// Helper function to collect property claims
const collectPropertyClaim = (
  item: NestedArrayItem,
  result: {
    goal: Goal | null;
    claims: PropertyClaim[];
    strategies: (Goal | PropertyClaim | Strategy)[];
  }
): void => {
  if (item.type === 'PropertyClaim') {
    result.claims.push(item as PropertyClaim);
  }
};

// Helper function to collect strategies
const collectStrategy = (
  item: NestedArrayItem,
  result: {
    goal: Goal | null;
    claims: PropertyClaim[];
    strategies: (Goal | PropertyClaim | Strategy)[];
  }
): void => {
  if (item.type !== 'Evidence' && item.type !== 'Context') {
    result.strategies.push(item as Goal | PropertyClaim | Strategy);
  }
};

// Helper function to traverse nested structures
const traverseNestedStructures = (
  item: NestedArrayItem,
  traverse: (items: NestedArrayItem[]) => void
): void => {
  if ('property_claims' in item && item.property_claims) {
    traverse(item.property_claims as NestedArrayItem[]);
  }
  if ('strategies' in item && item.strategies) {
    traverse(item.strategies as NestedArrayItem[]);
  }
  if ('context' in item && item.context) {
    traverse(item.context as NestedArrayItem[]);
  }
  if ('evidence' in item && item.evidence) {
    traverse(item.evidence as NestedArrayItem[]);
  }
};

export const extractGoalsClaimsStrategies = (
  array: NestedArrayItem[]
): {
  goal: Goal | null;
  claims: PropertyClaim[];
  strategies: (Goal | PropertyClaim | Strategy)[];
} => {
  const result = {
    goal: null as Goal | null,
    claims: [] as PropertyClaim[],
    strategies: [] as (Goal | PropertyClaim | Strategy)[],
  };

  const traverse = (items: NestedArrayItem[]) => {
    for (const item of items) {
      collectGoal(item, result);
      collectPropertyClaim(item, result);
      collectStrategy(item, result);
      traverseNestedStructures(item, traverse);
    }
  };

  traverse(array);
  return result;
};

/**
 * Recursively adds a `hidden` property to each node in an assurance case structure.
 *
 * @param {any} assuranceCase - The assurance case or node to process.
 * @returns {Promise<any>} The assurance case with the `hidden` property added to each node.
 */
export const addHiddenProp = (
  assuranceCase: AssuranceCase | NestedArrayItem | NestedArrayItem[]
): AssuranceCase | NestedArrayItem | NestedArrayItem[] => {
  if (Array.isArray(assuranceCase)) {
    for (const item of assuranceCase) {
      addHiddenProp(item);
    }
  } else if (typeof assuranceCase === 'object' && assuranceCase !== null) {
    if ('hidden' in assuranceCase && typeof assuranceCase === 'object') {
      (assuranceCase as NestedArrayItem).hidden = false;
    }

    for (const key of Object.keys(assuranceCase)) {
      const value = (assuranceCase as unknown as Record<string, unknown>)[key];
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        addHiddenProp(
          value as unknown as
            | NestedArrayItem
            | AssuranceCase
            | NestedArrayItem[]
        );
      }
    }
  }
  return assuranceCase;
};

/**
 * Retrieves the adjacent nodes for a given case node based on its type.
 *
 * @param {CaseNode} caseNode - The node for which to find adjacent nodes.
 * @returns {Array<CaseNode>} An array of adjacent nodes.
 */
const getAdjacent = (caseNode: CaseNode): CaseNode[] => {
  if (caseNode.type === 'AssuranceCase') {
    return (caseNode.goals || []) as unknown as CaseNode[];
  }
  if (caseNode.type === 'TopLevelNormativeGoal') {
    return ((caseNode.context || []) as unknown as CaseNode[]).concat(
      (caseNode.property_claims || []) as unknown as CaseNode[],
      (caseNode.strategies || []) as unknown as CaseNode[],
      (caseNode.context || []) as unknown as CaseNode[]
    );
  }
  if (caseNode.type === 'Strategy') {
    return (caseNode.property_claims || []) as unknown as CaseNode[];
  }
  if (caseNode.type === 'PropertyClaim') {
    return ((caseNode.property_claims || []) as unknown as CaseNode[]).concat(
      (caseNode.evidence || []) as unknown as CaseNode[]
    );
  }

  return [];
};

/**
 * Searches for a target node within an assurance case using a depth-first search algorithm.
 *
 * @param {CaseNode} targetNode - The node to search for in the assurance case.
 * @param {CaseNode} assuranceCase - The assurance case in which to search for the target node.
 * @returns {Array<any>} An array containing the found node (or null if not found) and a map of parent nodes.
 */
export function searchWithDeepFirst(
  targetNode: CaseNode,
  assuranceCase: CaseNode
): [CaseNode | null, Record<number, CaseNode>] {
  const visitedNodes: CaseNode[] = [];
  const parentMap: Record<number, CaseNode> = {};
  let nodesToProcess: CaseNode[] = [assuranceCase];
  let nodeFound: CaseNode | null = null;

  while (nodesToProcess.length > 0) {
    const currentNode: CaseNode | undefined = nodesToProcess.shift();
    if (currentNode === undefined) {
      return [null, {}];
    }

    if (currentNode.id === targetNode.id) {
      visitedNodes.push(currentNode);
      nodeFound = currentNode;
      break;
    }
    visitedNodes.push(currentNode);
    const adjacentNodes = getAdjacent(currentNode);

    for (const node of adjacentNodes) {
      parentMap[node.id] = currentNode;
    }

    nodesToProcess = nodesToProcess.concat(adjacentNodes);
  }

  return [nodeFound, parentMap];
}

/**
 * Toggles the visibility of a node and its parent nodes in the assurance case.
 *
 * @param {any} node - The node for which to toggle visibility.
 * @param {AssuranceCase} assuranceCase - The assurance case containing the node.
 * @returns {AssuranceCase} A new assurance case with updated visibility for the node and its parents.
 */
export function toggleHiddenForParent(
  node: ReactFlowNode,
  assuranceCase: AssuranceCase
): AssuranceCase {
  const newAssuranceCase = JSON.parse(
    JSON.stringify(assuranceCase)
  ) as AssuranceCase;
  const [nodeFound, parentMap] = searchWithDeepFirst(
    node.data as unknown as CaseNode,
    newAssuranceCase as unknown as CaseNode
  );

  let currentNode: CaseNode | null = nodeFound;
  const nodesToShow: CaseNode[] = [];
  while (currentNode != null) {
    nodesToShow.push(currentNode);
    currentNode = parentMap[currentNode.id];
  }

  for (const nodeToShow of nodesToShow) {
    nodeToShow.hidden = false;
  }

  return newAssuranceCase;
}

/**
 * Toggles the visibility of all children nodes of a specified parent node in the assurance case.
 *
 * @param {AssuranceCase} assuranceCase - The assurance case containing the parent node.
 * @param {number} parentId - The ID of the parent node whose children visibility will be toggled.
 * @returns {AssuranceCase} A new assurance case with updated visibility for the children of the specified parent node.
 */
// Helper function to handle array processing
const processArray = (
  arr: unknown[],
  targetParentId: number,
  parentFound: boolean,
  hide: boolean,
  toggleChildren: (
    item: unknown,
    targetId: number,
    isParentFound: boolean,
    shouldHide: boolean
  ) => void
): void => {
  for (const item of arr) {
    toggleChildren(item, targetParentId, parentFound, hide);
  }
};

// Helper function to handle parent node
const handleParentNode = (
  node: CaseNode,
  targetParentId: number
): { parentFound: boolean; hide: boolean } => {
  if (node.id === targetParentId) {
    const hide = !node.childrenHidden; // Toggle childrenHidden for the parent
    node.childrenHidden = hide; // Track the state of children visibility
    return { parentFound: true, hide };
  }
  return { parentFound: false, hide: false };
};

// Helper function to handle child visibility
const handleChildVisibility = (
  node: CaseNode,
  hide: boolean,
  isChild: boolean
): void => {
  if (!isChild) {
    return;
  }

  if (hide) {
    if (node.originalHidden === undefined) {
      node.originalHidden = !!node.hidden; // Record the original hidden state
    }
    node.hidden = true; // Force hidden
  } else if (node.originalHidden !== undefined) {
    node.hidden = node.originalHidden; // Reset to original hidden state
    node.originalHidden = undefined; // Clean up originalHidden property
  } else {
    node.hidden = false; // If no original hidden state, set to visible
  }
};

// Helper function to process object properties
const processObjectProperties = (
  obj: Record<string, unknown>,
  targetParentId: number,
  parentFound: boolean,
  hide: boolean,
  toggleChildren: (
    item: unknown,
    targetId: number,
    isParentFound: boolean,
    shouldHide: boolean
  ) => void
): void => {
  for (const key of Object.keys(obj)) {
    toggleChildren(obj[key], targetParentId, parentFound, hide);
  }
};

export function toggleHiddenForChildren(
  assuranceCase: AssuranceCase,
  parentId: number
): AssuranceCase {
  function toggleChildren(
    obj: unknown,
    targetParentId: number,
    parentFound: boolean,
    hide: boolean
  ): void {
    if (Array.isArray(obj)) {
      processArray(obj, targetParentId, parentFound, hide, toggleChildren);
      return;
    }

    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    const node = obj as CaseNode;
    let newParentFound = parentFound;
    let newHide = hide;

    // Check if current object is the parent or one of its descendants
    const isParentOrDescendant = parentFound || node.id === targetParentId;

    // Reset childrenHidden if it's a descendant and not the direct parent
    if (
      isParentOrDescendant &&
      node.id !== targetParentId &&
      'childrenHidden' in node
    ) {
      node.childrenHidden = false;
    }

    // Handle parent node
    const parentResult = handleParentNode(node, targetParentId);
    if (parentResult.parentFound) {
      newParentFound = true;
      newHide = parentResult.hide;
    }

    // Handle child visibility
    const isChild = newParentFound && node.id !== targetParentId;
    handleChildVisibility(node, newHide, isChild);

    // Process object properties
    processObjectProperties(
      obj as Record<string, unknown>,
      targetParentId,
      newParentFound,
      newHide,
      toggleChildren
    );
  }

  // Create a deep copy of the assuranceCase to ensure immutability
  const newAssuranceCase = JSON.parse(
    JSON.stringify(assuranceCase)
  ) as AssuranceCase;

  // Toggle hidden property for the children
  toggleChildren(newAssuranceCase, parentId, false, false);

  return newAssuranceCase;
}

/**
 * Finds an element within an assurance case by its unique ID.
 *
 * @param {AssuranceCase} assuranceCase - The assurance case in which to search for the element.
 * @param {number} id - The unique identifier of the element to find.
 * @returns {any} The found element, or null if not found.
 */
// Helper to get children array by key from element
const getChildrenByKey = (
  element: NestedArrayItem | AssuranceCase,
  key: string
): unknown[] | undefined => {
  switch (key) {
    case 'goals':
      return 'goals' in element ? (element as AssuranceCase).goals : undefined;
    case 'context':
      return 'context' in element ? (element as Goal).context : undefined;
    case 'property_claims':
      return 'property_claims' in element
        ? (element as Goal | PropertyClaim | Strategy).property_claims
        : undefined;
    case 'strategies':
      return 'strategies' in element
        ? (element as Goal | PropertyClaim).strategies
        : undefined;
    case 'evidence':
      return 'evidence' in element
        ? (element as PropertyClaim).evidence
        : undefined;
    case 'comments':
      return 'comments' in element
        ? (element as AssuranceCase).comments
        : undefined;
    default:
      return;
  }
};

// Type for the search element function
type SearchElementFunction = (
  el: NestedArrayItem | AssuranceCase,
  id: number
) => NestedArrayItem | AssuranceCase | null;

// Helper function to search within children array
const searchInChildrenArray = (
  children: unknown[],
  targetId: number,
  searchElement: SearchElementFunction
): NestedArrayItem | AssuranceCase | null => {
  for (const child of children) {
    if (child && typeof child === 'object' && 'id' in child) {
      const result = searchElement(
        child as NestedArrayItem | AssuranceCase,
        targetId
      );
      if (result) {
        return result;
      }
    }
  }
  return null;
};

// Helper function to search in child elements
const searchInChildElements = (
  element: NestedArrayItem | AssuranceCase,
  targetId: number,
  childrenKeys: string[],
  searchElement: SearchElementFunction
): NestedArrayItem | AssuranceCase | null => {
  for (const key of childrenKeys) {
    const children = getChildrenByKey(element, key);
    if (children) {
      const result = searchInChildrenArray(children, targetId, searchElement);
      if (result) {
        return result;
      }
    }
  }
  return null;
};

export function findElementById(
  assuranceCase: AssuranceCase,
  id: number
): NestedArrayItem | AssuranceCase | null {
  // Recursive function to search for the element with the given ID
  function searchElement(
    element: NestedArrayItem | AssuranceCase,
    targetId: number
  ): NestedArrayItem | AssuranceCase | null {
    if (element.id === targetId) {
      return element;
    }

    const childrenKeys = [
      'goals',
      'context',
      'property_claims',
      'strategies',
      'evidence',
      'comments',
    ];

    return searchInChildElements(
      element,
      targetId,
      childrenKeys,
      searchElement
    );
  }

  return searchElement(assuranceCase, id);
}

/**
 * Helper to process children and collect hidden status
 */
const processChildrenForHiddenStatus = (
  children: unknown[],
  key: string,
  hiddenStatus: boolean[]
): void => {
  for (const child of children) {
    if (child && typeof child === 'object' && 'hidden' in child) {
      hiddenStatus.push((child as { hidden: boolean }).hidden);
    }
    // Recursively check nested property claims and strategies
    if (key === 'property_claims' || key === 'strategies') {
      const nestedStatus = getChildrenHiddenStatus(
        child as NestedArrayItem | AssuranceCase
      );
      hiddenStatus.push(...nestedStatus);
    }
  }
};

/**
 * Retrieves the hidden status of all child elements of a specified element.
 *
 * @param {any} element - The element whose children's hidden status is to be retrieved.
 * @returns {boolean[]} An array of boolean values representing the hidden status of each child element.
 */
export function getChildrenHiddenStatus(
  element: NestedArrayItem | AssuranceCase
): boolean[] {
  const hiddenStatus: boolean[] = [];
  const childrenKeys = [
    'context',
    'property_claims',
    'strategies',
    'evidence',
    'comments',
  ];

  for (const key of childrenKeys) {
    const children = getChildrenByKey(element, key);
    if (children) {
      processChildrenForHiddenStatus(children, key, hiddenStatus);
    }
  }
  return hiddenStatus;
}

/**
 * Finds the hidden state of a sibling element by checking the parent node's hidden status.
 *
 * @param {AssuranceCase} assuranceCase - The assurance case containing the sibling element.
 * @param {number} parentId - The ID of the parent element whose siblings' hidden state is to be determined.
 * @returns {boolean} The hidden state of the sibling element, or undefined if not found.
 */
export const findSiblingHiddenState = (
  assuranceCase: AssuranceCase,
  parentId: number
) => {
  const element = findElementById(assuranceCase, parentId);
  if (element) {
    const hiddenStatus = getChildrenHiddenStatus(element);

    if (hiddenStatus.length === 0) {
      // then get parents hidden value
      return 'hidden' in element ? (element as NestedArrayItem).hidden : false;
    }
    return hiddenStatus[0] ?? false;
  }
};

/**
 * Finds the parent node of a given node within a collection of nodes.
 *
 * @param {any} nodes - An array of nodes to search for the parent node.
 * @param {any} node - The node for which to find the parent.
 * @returns {any|null} The parent node if found, or null if not found.
 */
export const findParentNode = (
  nodes: ReactFlowNode[],
  node: ReactFlowNode
): ReactFlowNode | null => {
  if (node.data.goal_id) {
    // search for goal
    const parent = nodes.filter(
      (n: ReactFlowNode) => n.data.id === node.data.goal_id
    )[0];
    return parent || null;
  }
  if (node.data.property_claim_id) {
    if (node.type === 'evidence') {
      const parent = nodes.filter(
        (n: ReactFlowNode) =>
          n.data.id === (node.data.property_claim_id as number[])[0]
      )[0];
      return parent || null;
    }
    // search for property claim
    const parent = nodes.filter(
      (n: ReactFlowNode) => n.data.id === node.data.property_claim_id
    )[0];
    return parent || null;
  }
  if (node.data.strategy_id) {
    // search for strategy
    const parent = nodes.filter(
      (n: ReactFlowNode) => n.data.id === node.data.strategy_id
    )[0];
    return parent || null;
  }
  return null;
};

/**
 * Detaches a specified node from its parent in the assurance case.
 *
 * @param {any} node - The node to detach.
 * @param {string} type - The type of the node (e.g., "context", "strategy").
 * @param {any} id - The unique identifier of the node to detach.
 * @param {string|null} token - The authorization token for the request.
 * @returns {Promise<any>} A promise that resolves with the result of the detach operation.
 */
// Helper to build detach payload for property claims
const buildPropertyClaimDetachPayload = (
  node: ReactFlowNode
): DetachPayload => {
  const payload: DetachPayload = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  if (node.data.goal_id !== null && node.data.goal_id !== undefined) {
    payload.goal_id = node.data.goal_id;
  }
  if (node.data.strategy_id !== null && node.data.strategy_id !== undefined) {
    payload.strategy_id = node.data.strategy_id;
  }
  if (
    node.data.property_claim_id !== null &&
    node.data.property_claim_id !== undefined
  ) {
    // Handle both single number and array cases
    if (Array.isArray(node.data.property_claim_id)) {
      payload.property_claim_id = node.data.property_claim_id[0];
    } else {
      payload.property_claim_id = node.data.property_claim_id;
    }
  }

  return payload;
};

// Helper to get entity name from type
const getEntityName = (type: string): string => {
  switch (type) {
    case 'context':
      return 'contexts';
    case 'strategy':
      return 'strategies';
    case 'property':
      return 'propertyclaims';
    case 'evidence':
      return 'evidence';
    default:
      return 'goals';
  }
};

export const detachCaseElement = async (
  node: ReactFlowNode,
  type: string,
  id: number,
  token: string | null
): Promise<{ detached: boolean } | { error: string | unknown }> => {
  if (!token) {
    return { error: 'No token' };
  }

  let payload: DetachPayload;
  const entity = getEntityName(type);

  if (type === 'property') {
    payload = buildPropertyClaimDetachPayload(node);
  } else if (type === 'evidence') {
    payload = {
      goal_id: null,
      strategy_id: null,
      property_claim_id: (node.data.property_claim_id as number[])[0],
    };
  } else {
    payload = {
      goal_id: null,
      strategy_id: null,
      property_claim_id: null,
    };
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/detach`;

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    return { detached: true };
  } catch (error) {
    return { error };
  }
};

/**
 * Attaches an orphan node to a specified parent in the assurance case.
 *
 * @param {any} orphan - The node to attach.
 * @param {any} id - The unique identifier of the node to attach.
 * @param {string|null} token - The authorization token for the request.
 * @param {any} parent - The parent node to which the orphan will be attached.
 * @returns {Promise<any>} A promise that resolves with the result of the attach operation.
 */
export const attachCaseElement = async (
  orphan: ReactFlowNode,
  id: number,
  token: string | null,
  parent: ReactFlowNode
): Promise<{ attached: boolean } | { error: string | unknown }> => {
  if (!token) {
    return { error: 'No token' };
  }

  const payload: DetachPayload = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  let entity: string | null = null;
  switch (orphan.type.toLowerCase()) {
    case 'context':
      entity = 'contexts';
      payload.goal_id = parent.data.id;
      break;
    case 'strategy':
      entity = 'strategies';
      payload.goal_id = parent.data.id;
      break;
    case 'propertyclaim':
      entity = 'propertyclaims';

      if (parent.type === 'property') {
        payload.property_claim_id = parent.data.id;
      }
      if (parent.type === 'strategy') {
        payload.strategy_id = parent.data.id;
      }
      if (parent.type === 'goal') {
        payload.goal_id = parent.data.id;
      }
      break;
    case 'evidence':
      entity = 'evidence';
      payload.property_claim_id = parent.data.id;
      break;
    default:
      // Handle other types
      break;
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/attach`;

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    return { attached: true };
  } catch (error) {
    return { error };
  }
};

export const addElementComment = async (
  entity: string,
  id: number,
  newComment: CommentPayload,
  token: string | null
): Promise<Comment | { error: string | unknown }> => {
  if (!token) {
    return { error: 'No token' };
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment`;

    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newComment),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      // Handle non-ok response
    }

    const result = await response.json();

    return result;
  } catch (error) {
    return { error };
  }
};

export const updateElementComment = async (
  entity: string,
  id: number,
  newComment: CommentPayload,
  newCommentId: number,
  token: string | null
): Promise<Comment | { error: string | unknown }> => {
  if (!token) {
    return { error: 'No token' };
  }

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment/${newCommentId}`;

    const requestOptions: RequestInit = {
      method: 'PUT',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newComment),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      // Handle non-ok response
    }

    const result = await response.json();

    return result;
  } catch (error) {
    return { error };
  }
};
