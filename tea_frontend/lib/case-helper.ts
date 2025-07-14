import type { AssuranceCase } from '@/types';

interface Map {
  [key: string]: string | undefined;
}

interface CaseNode {
  hidden: boolean;
  id: number;
  type: string;
  [key: string]: any;
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
 * @param {any} propertyClaims - The array of property claims to search through.
 * @param {any} parentId - The ID of the parent property claim to which the new claim will be added.
 * @param {any} newPropertyClaim - The new property claim to be added.
 * @returns {boolean} Returns true if the property claim was found and updated, otherwise false.
 */
export const addPropertyClaimToNested = (
  propertyClaims: any,
  parentId: any,
  newPropertyClaim: any
) => {
  // Iterate through the property claims array
  for (let i = 0; i < propertyClaims.length; i++) {
    const propertyClaim = propertyClaims[i];

    // Check if this property claim matches the parent ID
    if (propertyClaim.id === parentId) {
      // Check if the property claim already has property claims array
      if (!propertyClaim.property_claims) {
        propertyClaim.property_claims = [];
      }

      // Add the new property claim to the property claim's property claims
      propertyClaim.property_claims.push(newPropertyClaim);

      return true; // Indicates the property claim was found and updated
    }

    // If this property claim has nested property claims, recursively search within them
    if (
      propertyClaim.property_claims &&
      propertyClaim.property_claims.length > 0
    ) {
      const found = addPropertyClaimToNested(
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
      for (const strategy of propertyClaim.strategies) {
        if (strategy.property_claims && strategy.property_claims.length > 0) {
          const found = addPropertyClaimToNested(
            strategy.property_claims,
            parentId,
            newPropertyClaim
          );
          if (found) {
            return true; // Indicates the property claim was found and updated within nested property claims of strategy
          }
        }
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} id - The ID of the property claim to be updated.
 * @param {any} newPropertyClaim - An object containing the properties to update the property claim with.
 * @returns {any[] | null} Returns the updated array if the property claim is found and updated, otherwise null.
 */
export const updatePropertyClaimNested = (
  array: any,
  id: any,
  newPropertyClaim: any
) => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    const propertyClaim = array[i];

    // Check if this property claim matches the parent ID
    if (propertyClaim.id === id && propertyClaim.type === 'PropertyClaim') {
      array[i] = { ...propertyClaim, ...newPropertyClaim };

      return array; // Return the updated array
    }

    // If this property claim has nested property claims, recursively search within them
    if (
      propertyClaim.property_claims &&
      propertyClaim.property_claims.length > 0
    ) {
      const updatedNestedArray = updatePropertyClaimNested(
        propertyClaim.property_claims,
        id,
        newPropertyClaim
      );
      if (updatedNestedArray) {
        return array; // Return the updated array
      }
    }

    // If this property claim has strategies, recursively search within them
    if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
      for (const strategy of propertyClaim.strategies) {
        if (strategy.property_claims && strategy.property_claims.length > 0) {
          const updatedNestedArray = updatePropertyClaimNested(
            strategy.property_claims,
            id,
            newPropertyClaim
          );
          if (updatedNestedArray) {
            return array; // Return the updated array
          }
        }
      }
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
 * @param {any[]} array - The array of property claims to process.
 * @param {any} id - The ID of the property claim to remove.
 * @returns {any[]} A new array with the specified property claim removed.
 */
const removePropertyClaimFromOldLocation = (array: any, id: any) => {
  return array.map((item: any) => {
    if (item.property_claims) {
      // Filter out the claim with the given id
      item.property_claims = item.property_claims.filter(
        (claim: any) => claim.id !== id
      );
      // Recursively remove the claim from nested property_claims
      item.property_claims = removePropertyClaimFromOldLocation(
        item.property_claims,
        id
      );
    }

    if (item.strategies) {
      // Recursively process each strategy
      item.strategies = item.strategies.map((strategy: any) => {
        if (strategy.property_claims) {
          // Filter out the claim with the given id from the strategy's property_claims
          strategy.property_claims = strategy.property_claims.filter(
            (claim: any) => claim.id !== id
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} property_claim - The property claim to be added.
 * @param {any} newParentId - The ID of the parent property claim where the new claim should be added.
 * @returns {any[]} A new array with the property claim added to the specified location.
 */
const addPropertyClaimToLocation = (
  array: any,
  property_claim: any,
  newParentId: any
) => {
  return array.map((item: any) => {
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
      item.strategies = item.strategies.map((strategy: any) => {
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} id - The ID of the property claim to be updated.
 * @param {any} newPropertyClaim - An object containing the properties to update the property claim with.
 * @returns {any[]} A new array with the property claim updated and moved to the new location.
 */
export const updatePropertyClaimNestedMove = (
  array: any,
  id: any,
  newPropertyClaim: any
) => {
  // Find the existing property claim item
  let existingPropertyClaim = null;
  const findExstingPropertyClaim = (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];

      if (item.id === id && item.type === 'PropertyClaim') {
        existingPropertyClaim = item;
        return;
      }

      if (item.property_claims) {
        findExstingPropertyClaim(item.property_claims);
      }
      if (item.strategies) {
        for (const strategy of item.strategies) {
          if (strategy.property_claims) {
            findExstingPropertyClaim(strategy.property_claims);
          }
        }
      }
    }
  };
  findExstingPropertyClaim(array);

  // Remove evidence from its old location
  console.log('Remove Element');
  const arrayWithoutOldPropertyClaim = removePropertyClaimFromOldLocation(
    array,
    id
  );
  console.log('arrayWithoutOldPropertyClaim', arrayWithoutOldPropertyClaim);

  // Merge existing evidence properties with updated ones
  const updatedPropertyClaim = {
    ...(existingPropertyClaim as any),
    ...newPropertyClaim,
  };

  // Add evidence to the new location
  // const newClaimId = newPropertyClaim.property_claim_id[0];

  let newParentId = null;
  const newParentType = null;

  if (updatedPropertyClaim.goal_id !== null) {
    newParentId = updatedPropertyClaim.goal_id;
  }
  if (updatedPropertyClaim.strategy_id !== null) {
    newParentId = updatedPropertyClaim.strategy_id;
  }
  if (updatedPropertyClaim.property_claim_id !== null) {
    newParentId = updatedPropertyClaim.property_claim_id;
  }

  console.log('New Parent Id', newParentId);

  const updatedArray = addPropertyClaimToLocation(
    arrayWithoutOldPropertyClaim,
    updatedPropertyClaim,
    newParentId
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {string} currentClaimName - The name of the current claim to exclude.
 * @param {any[]} claims - An array to accumulate the found property claims (used for recursion).
 * @returns {any[]} An array of property claims excluding the specified current claim.
 */
export const listPropertyClaims = (
  array: any,
  currentClaimName: string,
  claims: any[] = []
) => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    if (item.type === 'PropertyClaim' && item.name !== currentClaimName) {
      claims.push(item);
    }

    // If this item has nested property claims, recursively search within them
    if (item.property_claims && item.property_claims.length > 0) {
      listPropertyClaims(item.property_claims, currentClaimName, claims);
    }

    // If this property claim has strategies, recursively search within them
    if (item.strategies && item.strategies.length > 0) {
      for (const strategy of item.strategies) {
        if (strategy.property_claims && strategy.property_claims.length > 0) {
          listPropertyClaims(
            strategy.property_claims,
            currentClaimName,
            claims
          );
        }
      }
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} parentId - The ID of the property claim to which the evidence should be added.
 * @param {any} newEvidence - The evidence object to add to the property claim.
 * @returns {boolean} True if the property claim was found and updated; false otherwise.
 */
export const addEvidenceToClaim = (
  array: any,
  parentId: any,
  newEvidence: any
) => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    const propertyClaim = array[i];

    // Check if this property claim matches the parent ID
    if (propertyClaim.id === parentId) {
      console.log(propertyClaim);
      // Check if the property claim already has evidence array
      if (!propertyClaim.evidence) {
        propertyClaim.evidence = [];
      }

      // Add the new property claim to the property claim's property claims
      propertyClaim.evidence.push(newEvidence);

      return true; // Indicates the property claim was found and updated
    }

    // If this property claim has nested property claims, recursively search within them
    if (
      propertyClaim.property_claims &&
      propertyClaim.property_claims.length > 0
    ) {
      const found = addEvidenceToClaim(
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
      for (const strategy of propertyClaim.strategies) {
        if (strategy.property_claims && strategy.property_claims.length > 0) {
          const found = addEvidenceToClaim(
            strategy.property_claims,
            parentId,
            newEvidence
          );
          if (found) {
            return true; // Indicates the property claim was found and updated within nested property claims of strategy
          }
        }
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} id - The ID of the evidence to update.
 * @param {any} newEvidence - An object containing the properties to update the evidence with.
 * @returns {any[]} The updated array with the evidence modified, or null if not found.
 */
export const updateEvidenceNested = (array: any, id: any, newEvidence: any) => {
  // Iterate through the array
  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    // Check if this evidence matches the parent ID
    if (item.id === id) {
      array[i] = { ...item, ...newEvidence };
      return array; // Return the updated array
    }

    if (item.evidence && item.evidence.length > 0) {
      const updatedNestedArray = updateEvidenceNested(
        item.evidence,
        id,
        newEvidence
      );
      if (updatedNestedArray) {
        return array;
      }
    }

    if (item.property_claims && item.property_claims.length > 0) {
      const updatedNestedArray = updateEvidenceNested(
        item.property_claims,
        id,
        newEvidence
      );
      if (updatedNestedArray) {
        return array;
      }
    }

    if (item.strategies && item.strategies.length > 0) {
      for (const strategy of item.strategies) {
        if (strategy.property_claims && strategy.property_claims.length > 0) {
          const updatedNestedArray = updateEvidenceNested(
            strategy.property_claims,
            id,
            newEvidence
          );
          if (updatedNestedArray) {
            return array;
          }
        }
      }
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
 * @param {any[]} array - The array of property claims to process.
 * @param {any} id - The ID of the evidence to remove.
 * @returns {any[]} A new array with the specified evidence removed.
 */
const removeEvidenceFromOldLocation = (array: any, id: any) => {
  return array.map((item: any) => {
    if (item.evidence) {
      item.evidence = item.evidence.filter(
        (evidence: any) => evidence.id !== id
      );
    }

    if (item.property_claims) {
      item.property_claims = removeEvidenceFromOldLocation(
        item.property_claims,
        id
      );
    }

    if (item.strategies) {
      item.strategies = item.strategies.map((strategy: any) => {
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
 * @param {any[]} array - The array of property claims to search through.
 * @param {any} evidence - The evidence object to add to the property claim.
 * @param {any} newClaimId - The ID of the property claim where the evidence should be added.
 * @returns {any[]} The updated array with the evidence added to the specified claim.
 */
const addEvidenceToNewLocation = (
  array: any,
  evidence: any,
  newClaimId: any
) => {
  return array.map((item: any) => {
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
      item.strategies = item.strategies.map((strategy: any) => {
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
export const updateEvidenceNestedMove = (
  array: any,
  id: any,
  newEvidence: any
) => {
  console.log(
    'updateEvidenceNested called with array:',
    array,
    'id:',
    id,
    'newEvidence:',
    newEvidence
  );

  // Find the existing evidence item
  let existingEvidence = null;
  const findExistingEvidence = (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (item.evidence) {
        for (let j = 0; j < item.evidence.length; j++) {
          if (item.evidence[j].id === id) {
            existingEvidence = item.evidence[j];
            return;
          }
        }
      }
      if (item.property_claims) {
        findExistingEvidence(item.property_claims);
      }
      if (item.strategies) {
        for (const strategy of item.strategies) {
          if (strategy.property_claims) {
            findExistingEvidence(strategy.property_claims);
          }
        }
      }
    }
  };
  findExistingEvidence(array);

  // Remove evidence from its old location
  const arrayWithoutOldEvidence = removeEvidenceFromOldLocation(array, id);

  // Merge existing evidence properties with updated ones
  const updatedEvidence = { ...(existingEvidence as any), ...newEvidence };

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
  newItem: any,
  token: string | null
) => {
  if (!token) return console.log('No token');

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
    console.log('Node Create Result', result);

    const data = {
      ...result,
      id: result.id,
    };

    return { data };
  } catch (error) {
    console.log('Error', error);
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
  id: any,
  token: string | null
) => {
  if (!token) return console.log('No token');

  let entity = null;
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
  } catch (error) {
    console.log('Error', error);
    return false;
  }
};

/**
 * Updates an existing assurance case node by sending a PUT request to the specified API endpoint.
 *
 * @param {string} type - The type of node to update (e.g., "context", "strategy").
 * @param {any} id - The unique identifier of the assurance case node to be updated.
 * @param {string | null} token - The authorization token for API access. If null, the function logs an error and exits.
 * @param {any} updateItem - The updated data for the assurance case node.
 * @returns {Promise<boolean>} A promise that resolves to true if the update was successful, otherwise false.
 */
export const updateAssuranceCaseNode = async (
  type: string,
  id: any,
  token: string | null,
  updateItem: any
) => {
  if (!token) return console.log('No token');

  let entity = null;
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
  } catch (error) {
    console.log('Error', error);
    return false;
  }
};

export const getAssuranceCaseNode = async (
  type: string,
  id: any,
  token: string | null
) => {
  if (!token) return console.log('No token');

  let entity = null;
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
      console.log('Something went wrong');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.log('Error', error);
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
export const findItemById = async (item: any, id: any) => {
  if (item.id === id) {
    // updateFn(item); // Update the item
    return item;
  }
  if (item.context) {
    item.context.forEach((contextItem: any) => findItemById(contextItem, id));
  }
  if (item.property_claims) {
    item.property_claims.forEach((propertyClaim: any) => {
      findItemById(propertyClaim, id);
      if (propertyClaim.property_claims) {
        propertyClaim.property_claims.forEach((childPropertyClaim: any) =>
          findItemById(childPropertyClaim, id)
        );
      }
    });
  }
  if (item.evidence) {
    item.evidence.forEach((evidenceItem: any) =>
      findItemById(evidenceItem, id)
    );
  }
  if (item.strategies) {
    item.strategies.forEach((strategyItem: any) => {
      findItemById(strategyItem, id);
      if (strategyItem.property_claims) {
        strategyItem.property_claims.forEach((childPropertyClaim: any) =>
          findItemById(childPropertyClaim, id)
        );
      }
    });
  }

  return null;
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
export const updateAssuranceCase = async (
  type: string,
  assuranceCase: any,
  updatedItem: any,
  id: any,
  node: any,
  move = false
) => {
  let updatedAssuranceCase: any;
  let updatedGoals: any;

  switch (type) {
    case 'context': {
      const newContext = assuranceCase.goals[0].context.map((context: any) => {
        if (context.id === id && context.type === 'Context') {
          return {
            ...context,
            ...updatedItem,
          };
        }
        return { ...context };
      });

      updatedAssuranceCase = {
        ...assuranceCase,
        goals: [{ ...assuranceCase.goals[0], context: newContext }],
      };
      return updatedAssuranceCase;
    }
    case 'strategy': {
      // Create a new strategy array by adding the new context item
      const newStrategy = assuranceCase.goals[0].strategies.map(
        (strategy: any) => {
          if (strategy.id === id && strategy.type === 'Strategy') {
            return {
              ...strategy,
              ...updatedItem,
            };
          }
          return { ...strategy };
        }
      );

      // Create a new assuranceCase object with the updated strategy array
      updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
            strategies: newStrategy,
          },
        ],
      };
      return updatedAssuranceCase;
    }
    case 'property':
      // updatedGoals = updatePropertyClaimNested(assuranceCase.goals, id, updatedItem);
      if (move) {
        updatedGoals = updatePropertyClaimNestedMove(
          assuranceCase.goals,
          id,
          updatedItem
        );
      } else {
        updatedGoals = updatePropertyClaimNested(
          assuranceCase.goals,
          id,
          updatedItem
        );
      }
      updatedAssuranceCase = {
        ...assuranceCase,
        goals: updatedGoals,
      };
      return updatedAssuranceCase;
    case 'evidence':
      // updatedGoals = updateEvidenceNested(assuranceCase.goals, id, updatedItem);
      if (move) {
        updatedGoals = updateEvidenceNestedMove(
          assuranceCase.goals,
          id,
          updatedItem
        );
      } else {
        updatedGoals = updateEvidenceNested(
          assuranceCase.goals,
          id,
          updatedItem
        );
      }
      console.log(updatedGoals);
      updatedAssuranceCase = {
        ...assuranceCase,
        goals: updatedGoals,
      };
      return updatedAssuranceCase;
    default:
      updatedAssuranceCase = {
        ...assuranceCase,
        goals: [
          {
            ...assuranceCase.goals[0],
            ...updatedItem,
          },
        ],
      };
      return updatedAssuranceCase;
  }
};

export const setNodeIdentifier = (parentNode: any, newNodeType: string) => {
  let identifier = 0;
  let newArray: any[] = [];
  let parentPrefix: number | null = null;

  switch (newNodeType.toLowerCase()) {
    case 'context':
      newArray = [...parentNode.data.context];
      break;
    case 'strategy':
      newArray = [...parentNode.data.strategies];
      break;
    case 'property':
      parentPrefix = Number.parseFloat(parentNode.data.name.substring(1));
      newArray = [...parentNode.data.property_claims];
      break;
    case 'evidence':
      newArray = [...parentNode.data.evidence];
      break;
    default:
      break;
  }

  if (newArray.length > 0) {
    const lastItem = newArray.pop();

    if (newNodeType === 'property' && parentNode.type === 'property') {
      const lastIdentifier = Number.parseFloat(
        lastItem.name.substring(1)
      ).toString();
      const subIdentifier = lastIdentifier.split('.')[1];
      identifier = Number.parseInt(subIdentifier) + 1;
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
  array: any[],
  id: any,
  type: string
): any[] => {
  return array
    .map((item: any) => {
      // Remove from property_claims
      if (item.property_claims) {
        item.property_claims = item.property_claims.filter(
          (claim: any) => !(claim.id === id && claim.type === type)
        );
        item.property_claims = removeItemFromNestedStructure(
          item.property_claims,
          id,
          type
        );
      }

      // Remove from strategies
      if (item.strategies) {
        item.strategies = item.strategies
          .map((strategy: any) => {
            if (strategy.property_claims) {
              strategy.property_claims = strategy.property_claims.filter(
                (claim: any) => !(claim.id === id && claim.type === type)
              );
              strategy.property_claims = removeItemFromNestedStructure(
                strategy.property_claims,
                id,
                type
              );
            }
            return strategy;
          })
          .filter(
            (strategy: any) => !(strategy.id === id && strategy.type === type)
          );
      }

      // Remove from contexts
      if (item.context) {
        item.context = item.context.filter(
          (context: any) => !(context.id === id && context.type === type)
        );
        item.context = removeItemFromNestedStructure(item.context, id, type);
      }

      // Remove from evidence
      if (item.evidence) {
        item.evidence = item.evidence.filter(
          (evidence: any) => !(evidence.id === id && evidence.type === type)
        );
        item.evidence = removeItemFromNestedStructure(item.evidence, id, type);
      }

      return item;
    })
    .filter((item: any) => !(item.id === id && item.type === type));
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
  assuranceCase: any,
  id: any,
  type: string
) => {
  console.log(`Remove id: ${id} type: ${type}`);
  const updatedGoals = removeItemFromNestedStructure(
    assuranceCase.goals,
    id,
    type
  );
  console.log('updatedGoals', updatedGoals);
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
export const extractGoalsClaimsStrategies = (array: any) => {
  const result = {
    goal: null,
    claims: <any[]>[],
    strategies: <any[]>[],
  };

  const traverse = (items: any) => {
    items.forEach((item: any) => {
      // Collect goals
      if (item.type === 'TopLevelNormativeGoal') {
        result.goal = item;
      }

      // Collect property claims
      if (item.type === 'PropertyClaim') {
        result.claims.push(item);
      }

      // Collect strategies
      if (item.type !== 'Evidence' && item.type !== 'Context') {
        result.strategies.push(item);
      }

      // Traverse nested structures
      if (item.property_claims) {
        traverse(item.property_claims);
      }
      if (item.strategies) {
        traverse(item.strategies);
      }
      if (item.context) {
        traverse(item.context);
      }
      if (item.evidence) {
        traverse(item.evidence);
      }
    });
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
export const addHiddenProp = async (assuranceCase: any) => {
  if (Array.isArray(assuranceCase)) {
    assuranceCase.forEach(addHiddenProp);
  } else if (typeof assuranceCase === 'object' && assuranceCase !== null) {
    assuranceCase.hidden = false;

    Object.keys(assuranceCase).forEach((key) => {
      addHiddenProp(assuranceCase[key]);
    });
  }
  return assuranceCase;
};

/**
 * Retrieves the adjacent nodes for a given case node based on its type.
 *
 * @param {CaseNode} caseNode - The node for which to find adjacent nodes.
 * @returns {Array<CaseNode>} An array of adjacent nodes.
 */
const getAdjacent = (caseNode: CaseNode): Array<CaseNode> => {
  if (caseNode.type == 'AssuranceCase') {
    return caseNode['goals'];
  }
  if (caseNode.type == 'TopLevelNormativeGoal') {
    return caseNode['context'].concat(
      caseNode['property_claims'],
      caseNode['strategies'],
      caseNode['context']
    );
  }
  if (caseNode.type == 'Strategy') {
    return caseNode['property_claims'];
  }
  if (caseNode.type == 'PropertyClaim') {
    return caseNode['property_claims'].concat(caseNode['evidence']);
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
): Array<any> {
  const visitedNodes: Array<CaseNode> = [];
  const parentMap: any = {};
  let nodesToProcess: Array<CaseNode> = [assuranceCase];
  let nodeFound: CaseNode | null = null;

  while (nodesToProcess.length > 0) {
    const currentNode: CaseNode | undefined = nodesToProcess.shift();
    if (currentNode === undefined) {
      return [];
    }

    if (currentNode.id == targetNode.id) {
      visitedNodes.push(currentNode);
      nodeFound = currentNode;
      break;
    }
    visitedNodes.push(currentNode);
    const adjacentNodes = getAdjacent(currentNode);

    adjacentNodes.forEach((node) => (parentMap[node.id] = currentNode));

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
  node: any,
  assuranceCase: AssuranceCase
): AssuranceCase {
  const newAssuranceCase = JSON.parse(JSON.stringify(assuranceCase));
  const [nodeFound, parentMap] = searchWithDeepFirst(
    node.data,
    newAssuranceCase
  );

  let currentNode: CaseNode = nodeFound;
  const nodesToShow: Array<CaseNode> = [];
  while (currentNode != null) {
    nodesToShow.push(currentNode);
    currentNode = parentMap[currentNode.id];
  }

  nodesToShow.forEach((node) => (node.hidden = false));

  return newAssuranceCase;
}

/**
 * Toggles the visibility of all children nodes of a specified parent node in the assurance case.
 *
 * @param {AssuranceCase} assuranceCase - The assurance case containing the parent node.
 * @param {number} parentId - The ID of the parent node whose children visibility will be toggled.
 * @returns {AssuranceCase} A new assurance case with updated visibility for the children of the specified parent node.
 */
export function toggleHiddenForChildren(
  assuranceCase: AssuranceCase,
  parentId: number
): AssuranceCase {
  function toggleChildren(
    obj: any,
    parentId: number,
    parentFound: boolean,
    hide: boolean
  ): void {
    if (Array.isArray(obj)) {
      obj.forEach((item) => toggleChildren(item, parentId, parentFound, hide));
    } else if (typeof obj === 'object' && obj !== null) {
      // Check if current object is the parent or one of its descendants
      const isParentOrDescendant = parentFound || obj.id === parentId;

      // Reset childrenHidden if it's a descendant and not the direct parent
      if (isParentOrDescendant && obj.id !== parentId) {
        obj.childrenHidden = false;
      }

      if (obj.id === parentId) {
        parentFound = true;
        hide = !obj.childrenHidden; // Toggle childrenHidden for the parent
        obj.childrenHidden = hide; // Track the state of children visibility
      }

      if (parentFound && obj.id !== parentId) {
        if (hide) {
          if (obj.originalHidden === undefined) {
            obj.originalHidden = !!obj.hidden; // Record the original hidden state
          }
          obj.hidden = true; // Force hidden
        } else if (obj.originalHidden !== undefined) {
          obj.hidden = obj.originalHidden; // Reset to original hidden state
          delete obj.originalHidden; // Clean up originalHidden property
        } else {
          obj.hidden = false; // If no original hidden state, set to visible
        }
      }

      Object.keys(obj).forEach((key) =>
        toggleChildren(obj[key], parentId, parentFound, hide)
      );
    }
  }

  // Create a deep copy of the assuranceCase to ensure immutability
  const newAssuranceCase = JSON.parse(JSON.stringify(assuranceCase));

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
export function findElementById(assuranceCase: AssuranceCase, id: number): any {
  // Recursive function to search for the element with the given ID
  function searchElement(element: any, id: number): any {
    if (element.id === id) {
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
    for (const key of childrenKeys) {
      if (element[key]) {
        for (const child of element[key]) {
          const result = searchElement(child, id);
          if (result) {
            return result;
          }
        }
      }
    }
    return null;
  }

  return searchElement(assuranceCase, id);
}

/**
 * Retrieves the hidden status of all child elements of a specified element.
 *
 * @param {any} element - The element whose children's hidden status is to be retrieved.
 * @returns {boolean[]} An array of boolean values representing the hidden status of each child element.
 */
export function getChildrenHiddenStatus(element: any): boolean[] {
  let hiddenStatus: boolean[] = [];
  const childrenKeys = [
    'context',
    'property_claims',
    'strategies',
    'evidence',
    'comments',
  ];
  for (const key of childrenKeys) {
    if (element[key]) {
      for (const child of element[key]) {
        hiddenStatus.push(child.hidden);
        // Recursively check nested property claims and strategies
        if (key === 'property_claims' || key === 'strategies') {
          hiddenStatus = hiddenStatus.concat(getChildrenHiddenStatus(child));
        }
      }
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
      return element.hidden;
    }
    return hiddenStatus[0];
  }
  console.log(`Element with ID ${parentId} not found.`);
};

/**
 * Finds the parent node of a given node within a collection of nodes.
 *
 * @param {any} nodes - An array of nodes to search for the parent node.
 * @param {any} node - The node for which to find the parent.
 * @returns {any|null} The parent node if found, or null if not found.
 */
export const findParentNode = (nodes: any, node: any) => {
  let parent = null;

  if (node.data.goal_id) {
    // search for goal
    return (parent = nodes.filter(
      (n: any) => n.data.id === node.data.goal_id
    )[0]);
  }
  if (node.data.property_claim_id) {
    if (node.type === 'evidence') {
      return (parent = nodes.filter(
        (n: any) => n.data.id === node.data.property_claim_id[0]
      )[0]);
    }
    // search for property claim
    return (parent = nodes.filter(
      (n: any) => n.data.id === node.data.property_claim_id
    )[0]);
  }
  if (node.data.strategy_id) {
    // search for strategy
    return (parent = nodes.filter(
      (n: any) => n.data.id === node.data.strategy_id
    )[0]);
  }
  return parent;
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
export const detachCaseElement = async (
  node: any,
  type: string,
  id: any,
  token: string | null
): Promise<any> => {
  if (!token) return { error: 'No token' };

  console.log('Detaching Node', node);

  const payload: any = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  let entity = null;
  switch (type) {
    case 'context':
      entity = 'contexts';
      break;
    case 'strategy':
      entity = 'strategies';
      break;
    case 'property':
      entity = 'propertyclaims';
      if (node.data.goal_id !== null) {
        payload.goal_id = node.data.goal_id;
      }
      if (node.data.strategy_id !== null) {
        payload.strategy_id = node.data.strategy_id;
      }
      if (node.data.property_claim_id !== null) {
        payload.property_claim_id = node.data.property_claim_id;
      }
      break;
    case 'evidence':
      entity = 'evidence';
      payload.property_claim_id = node.data.property_claim_id[0];
      break;
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
    console.log('Error', error);
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
  orphan: any,
  id: any,
  token: string | null,
  parent: any
): Promise<any> => {
  if (!token) return { error: 'No token' };

  console.log('Parent', parent);

  const payload: any = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  let entity = null;
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
  }

  console.log('Payload', payload);

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
    console.log('Error', error);
    return { error };
  }
};

export const addElementComment = async (
  entity: string,
  id: number,
  newComment: any,
  token: string | null
) => {
  if (!token) return console.log('No token');

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
      console.log('error');
    }

    const result = await response.json();

    return result;
  } catch (error) {
    console.log(`Could not create comment for ${entity}`, error);
    return { error };
  }
};

export const updateElementComment = async (
  entity: string,
  id: number,
  newComment: any,
  newCommentId: number,
  token: string | null
) => {
  if (!token) return console.log('No token');

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
      console.log('error');
    }

    const result = await response.json();

    return result;
  } catch (error) {
    console.log(
      `Could not update comment for ${entity}/${newCommentId}`,
      error
    );
    return { error };
  }
};
