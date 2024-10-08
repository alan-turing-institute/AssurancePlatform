import { AssuranceCase } from "@/types";

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
  goal: "Goal",
  context: "Context",
  strategy: "Strategy",
  property: "Property Claim",
  evidence: "Evidence",
};

export const caseItemDescription = (caseItemName: string) =>
  DESCRIPTION_FROM_TYPE[caseItemName] || caseItemName;

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

// UPDATE PROPERTY CLAIMS
// TODO: Evidence and Property Claims are doing a similar actions when moving this can be refactored.

export const updatePropertyClaimNested = (
  array: any,
  id: any,
  newPropertyClaim: any
) => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    let propertyClaim = array[i];

    // Check if this property claim matches the parent ID
    if (propertyClaim.id === id && propertyClaim.type === "PropertyClaim") {
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

export const updatePropertyClaimNestedMove = (
  array: any,
  id: any,
  newPropertyClaim: any
) => {
  // Find the existing property claim item
  let existingPropertyClaim = null;
  const findExstingPropertyClaim = (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];

      if (item.id === id && item.type === "PropertyClaim") {
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
  console.log("Remove Element");
  const arrayWithoutOldPropertyClaim = removePropertyClaimFromOldLocation(
    array,
    id
  );
  console.log("arrayWithoutOldPropertyClaim", arrayWithoutOldPropertyClaim);

  // Merge existing evidence properties with updated ones
  const updatedPropertyClaim = {
    ...(existingPropertyClaim as any),
    ...newPropertyClaim,
  };

  // Add evidence to the new location
  // const newClaimId = newPropertyClaim.property_claim_id[0];

  let newParentId = null;
  let newParentType = null;

  if (updatedPropertyClaim.goal_id !== null) {
    newParentId = updatedPropertyClaim.goal_id;
  }
  if (updatedPropertyClaim.strategy_id !== null) {
    newParentId = updatedPropertyClaim.strategy_id;
  }
  if (updatedPropertyClaim.property_claim_id !== null) {
    newParentId = updatedPropertyClaim.property_claim_id;
  }

  console.log("New Parent Id", newParentId);

  const updatedArray = addPropertyClaimToLocation(
    arrayWithoutOldPropertyClaim,
    updatedPropertyClaim,
    newParentId
  );

  return updatedArray;
};

export const listPropertyClaims = (
  array: any,
  currentClaimName: string,
  claims: any[] = []
) => {
  // Iterate through the property claims array
  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    if (item.type === "PropertyClaim" && item.name !== currentClaimName) {
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

// UPDATE EVIDENCE
// TODO: Evidence and Property Claims are doing a similar actions when moving this can be refactored.

export const updateEvidenceNested = (array: any, id: any, newEvidence: any) => {
  // Iterate through the array
  for (let i = 0; i < array.length; i++) {
    let item = array[i];

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

export const updateEvidenceNestedMove = (
  array: any,
  id: any,
  newEvidence: any
) => {
  console.log(
    "updateEvidenceNested called with array:",
    array,
    "id:",
    id,
    "newEvidence:",
    newEvidence
  );

  // Find the existing evidence item
  let existingEvidence = null;
  const findExistingEvidence = (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
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

export const createAssuranceCaseNode = async (
  entity: string,
  newItem: any,
  token: string | null
) => {
  if (!token) return console.log("No token");

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/`;

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newItem),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    const result = await response.json();
    console.log("Node Create Result", result);

    const data = {
      ...result,
      id: result.id,
    };

    return { data };
  } catch (error) {
    console.log("Error", error);
    return { error };
  }
};

export const deleteAssuranceCaseNode = async (
  type: string,
  id: any,
  token: string | null
) => {
  if (!token) return console.log("No token");

  let entity = null;
  switch (type.toLowerCase()) {
    case "context":
      entity = "contexts";
      break;
    case "strategy":
      entity = "strategies";
      break;
    case "property":
      entity = "propertyclaims";
      break;
    case "evidence":
      entity = "evidence";
      break;
    default:
      entity = "goals";
      break;
  }

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/`;

    const requestOptions: RequestInit = {
      method: "DELETE",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    };
    const response = await fetch(url, requestOptions);

    if (response.ok) {
      return true;
    }
  } catch (error) {
    console.log("Error", error);
    return false;
  }
};

export const updateAssuranceCaseNode = async (
  type: string,
  id: any,
  token: string | null,
  updateItem: any
) => {
  if (!token) return console.log("No token");

  let entity = null;
  switch (type) {
    case "context":
      entity = "contexts";
      break;
    case "strategy":
      entity = "strategies";
      break;
    case "property":
      entity = "propertyclaims";
      break;
    case "evidence":
      entity = "evidence";
      break;
    default:
      entity = "goals";
      break;
  }

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/`;

    const requestOptions: RequestInit = {
      method: "PUT",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateItem),
    };
    const response = await fetch(url, requestOptions);

    if (response.ok) {
      return true;
    }
  } catch (error) {
    console.log("Error", error);
    return false;
  }
};

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

export const updateAssuranceCase = async (
  type: string,
  assuranceCase: any,
  updatedItem: any,
  id: any,
  node: any,
  move: boolean = false
) => {
  let updatedAssuranceCase: any;
  let updatedGoals: any;

  switch (type) {
    case "context":
      const newContext = assuranceCase.goals[0].context.map((context: any) => {
        if (context.id === id && context.type === "Context") {
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
    case "strategy":
      // Create a new strategy array by adding the new context item
      const newStrategy = assuranceCase.goals[0].strategies.map(
        (strategy: any) => {
          if (strategy.id === id && strategy.type === "Strategy") {
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
    case "property":
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
    case "evidence":
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
  let identifier: number = 0;
  let newArray: any[] = [];
  let parentPrefix: number | null = null;

  switch (newNodeType.toLowerCase()) {
    case "context":
      newArray = [...parentNode.data.context];
      break;
    case "strategy":
      newArray = [...parentNode.data.strategies];
      break;
    case "property":
      parentPrefix = parseFloat(parentNode.data.name.substring(1));
      newArray = [...parentNode.data.property_claims];
      break;
    case "evidence":
      newArray = [...parentNode.data.evidence];
      break;
    default:
      break;
  }

  if (newArray.length > 0) {
    const lastItem = newArray.pop();

    if (newNodeType === "property" && parentNode.type === "property") {
      const lastIdentifier = parseFloat(lastItem.name.substring(1)).toString();
      const subIdentifier = lastIdentifier.split(".")[1];
      identifier = parseInt(subIdentifier) + 1;
    } else {
      const lastIdentifier = parseFloat(lastItem.name.substring(1));
      identifier = lastIdentifier + 1;
    }
  } else {
    identifier = 1;
  }

  if (parentNode && parentNode.type === "property" && parentPrefix !== null) {
    return `${parentPrefix}.${identifier}`;
  }

  return identifier.toString();
};

// Removing elements from Assurance Case
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
  console.log("updatedGoals", updatedGoals);
  return {
    ...assuranceCase,
    goals: updatedGoals,
  };
};

export const extractGoalsClaimsStrategies = (array: any) => {
  const result = {
    goal: null,
    claims: <any[]>[],
    strategies: <any[]>[],
  };

  const traverse = (items: any) => {
    items.forEach((item: any) => {
      // Collect goals
      if (item.type === "TopLevelNormativeGoal") {
        result.goal = item;
      }

      // Collect property claims
      if (item.type === "PropertyClaim") {
        result.claims.push(item);
      }

      // Collect strategies
      if (item.type !== "Evidence" && item.type !== "Context") {
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

export const addHiddenProp = async (assuranceCase: any) => {
  if (Array.isArray(assuranceCase)) {
    assuranceCase.forEach(addHiddenProp);
  } else if (typeof assuranceCase === "object" && assuranceCase !== null) {
    assuranceCase.hidden = false;

    Object.keys(assuranceCase).forEach((key) => {
      addHiddenProp(assuranceCase[key]);
    });
  }
  return assuranceCase;
};

const getAdjacent = (caseNode: CaseNode): Array<CaseNode> => {
  if (caseNode.type == "AssuranceCase") {
    return caseNode["goals"];
  } else if (caseNode.type == "TopLevelNormativeGoal") {
    return caseNode["context"].concat(
      caseNode["property_claims"],
      caseNode["strategies"],
      caseNode["context"]
    );
  } else if (caseNode.type == "Strategy") {
    return caseNode["property_claims"];
  } else if (caseNode.type == "PropertyClaim") {
    return caseNode["property_claims"].concat(caseNode["evidence"]);
  }

  return [];
};

export function searchWithDeepFirst(
  targetNode: CaseNode,
  assuranceCase: CaseNode
): Array<any> {
  const visitedNodes: Array<CaseNode> = [];
  const parentMap: any = {};
  let nodesToProcess: Array<CaseNode> = [assuranceCase];
  let nodeFound: CaseNode | null = null;

  while (nodesToProcess.length > 0) {
    let currentNode: CaseNode | undefined = nodesToProcess.shift();
    if (currentNode === undefined) {
      return [];
    }

    if (currentNode.id == targetNode.id) {
      visitedNodes.push(currentNode);
      nodeFound = currentNode;
      break;
    } else {
      visitedNodes.push(currentNode);
      let adjacentNodes = getAdjacent(currentNode);

      adjacentNodes.forEach((node) => (parentMap[node.id] = currentNode));

      nodesToProcess = nodesToProcess.concat(adjacentNodes);
    }
  }

  return [nodeFound, parentMap];
}

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
    } else if (typeof obj === "object" && obj !== null) {
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
        } else {
          if (obj.originalHidden !== undefined) {
            obj.hidden = obj.originalHidden; // Reset to original hidden state
            delete obj.originalHidden; // Clean up originalHidden property
          } else {
            obj.hidden = false; // If no original hidden state, set to visible
          }
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

export function findElementById(assuranceCase: AssuranceCase, id: number): any {
  // Recursive function to search for the element with the given ID
  function searchElement(element: any, id: number): any {
    if (element.id === id) {
      return element;
    }
    let childrenKeys = [
      "goals",
      "context",
      "property_claims",
      "strategies",
      "evidence",
      "comments",
    ];
    for (let key of childrenKeys) {
      if (element[key]) {
        for (let child of element[key]) {
          let result = searchElement(child, id);
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

export function getChildrenHiddenStatus(element: any): boolean[] {
  let hiddenStatus: boolean[] = [];
  let childrenKeys = [
    "context",
    "property_claims",
    "strategies",
    "evidence",
    "comments",
  ];
  for (let key of childrenKeys) {
    if (element[key]) {
      for (let child of element[key]) {
        hiddenStatus.push(child.hidden);
        // Recursively check nested property claims and strategies
        if (key === "property_claims" || key === "strategies") {
          hiddenStatus = hiddenStatus.concat(getChildrenHiddenStatus(child));
        }
      }
    }
  }
  return hiddenStatus;
}

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
    } else {
      return hiddenStatus[0];
    }
  } else {
    console.log(`Element with ID ${parentId} not found.`);
  }
};

export const findParentNode = (nodes: any, node: any) => {
  let parent = null;

  if (node.data.goal_id) {
    // search for goal
    return (parent = nodes.filter(
      (n: any) => n.data.id === node.data.goal_id
    )[0]);
  }
  if (node.data.property_claim_id) {
    if (node.type === "evidence") {
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

export const detachCaseElement = async (
  node: any,
  type: string,
  id: any,
  token: string | null
): Promise<any> => {
  if (!token) return { error: "No token" };

  console.log("Detaching Node", node);

  const payload: any = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  let entity = null;
  switch (type) {
    case "context":
      entity = "contexts";
      break;
    case "strategy":
      entity = "strategies";
      break;
    case "property":
      entity = "propertyclaims";
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
    case "evidence":
      entity = "evidence";
      payload.property_claim_id = node.data.property_claim_id[0];
      break;
  }

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/detach`;

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    return { detached: true };
  } catch (error) {
    console.log("Error", error);
    return { error };
  }
};

export const attachCaseElement = async (
  orphan: any,
  id: any,
  token: string | null,
  parent: any
): Promise<any> => {
  if (!token) return { error: "No token" };

  console.log("Parent", parent);

  const payload: any = {
    goal_id: null,
    strategy_id: null,
    property_claim_id: null,
  };

  let entity = null;
  switch (orphan.type.toLowerCase()) {
    case "context":
      entity = "contexts";
      payload.goal_id = parent.data.id;
      break;
    case "strategy":
      entity = "strategies";
      payload.goal_id = parent.data.id;
      break;
    case "propertyclaim":
      entity = "propertyclaims";

      if (parent.type === "property") {
        payload.property_claim_id = parent.data.id;
      }
      if (parent.type === "strategy") {
        payload.strategy_id = parent.data.id;
      }
      if (parent.type === "goal") {
        payload.goal_id = parent.data.id;
      }
      break;
    case "evidence":
      entity = "evidence";
      payload.property_claim_id = parent.data.id;
      break;
  }

  console.log("Payload", payload);

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL_STAGING}/api/${entity}/${id}/attach`;

    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      return { error: `Something went wrong ${response.status}` };
    }

    return { attached: true };
  } catch (error) {
    console.log("Error", error);
    return { error };
  }
};

export const addElementComment = async (
  entity: string,
  id: number,
  newComment: any,
  token: string | null
) => {
  if (!token) return console.log("No token");

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment`

    const requestOptions: RequestInit = {
        method: "POST",
        headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(newComment),
    };
    const response = await fetch(url, requestOptions);

    if(!response.ok) {
        console.log('error')
    }

    const result = await response.json()

    return result
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
  if (!token) return console.log("No token");

  try {
    let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/comment/${newCommentId}`

    const requestOptions: RequestInit = {
        method: "PUT",
        headers: {
            Authorization: `Token ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(newComment),
    };
    const response = await fetch(url, requestOptions);

    if(!response.ok) {
        console.log('error')
    }

    const result = await response.json()

    return result
  } catch (error) {
    console.log(`Could not update comment for ${entity}/${newCommentId}`, error);
    return { error };
  }
};
