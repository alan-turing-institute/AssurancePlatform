import { AssuranceCase } from "@/types";

interface Map {
    [key: string]: string | undefined
}

const DESCRIPTION_FROM_TYPE: Map = {
    goal: "Goal",
    context: "Context",
    strategy: "Strategy",
    property: "Property Claim",
    evidence: "Evidence"
};

export const caseItemDescription = (caseItemName: string) => DESCRIPTION_FROM_TYPE[caseItemName] || caseItemName;

export const addPropertyClaimToNested = (propertyClaims: any, parentId: any, newPropertyClaim: any) => {
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
        if (propertyClaim.property_claims && propertyClaim.property_claims.length > 0) {
            const found = addPropertyClaimToNested(propertyClaim.property_claims, parentId, newPropertyClaim);
            if (found) {
                return true; // Indicates the property claim was found and updated within nested property claims
            }
        }

        // If this property claim has strategies, recursively search within them
        if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
            for (const strategy of propertyClaim.strategies) {
                if (strategy.property_claims && strategy.property_claims.length > 0) {
                    const found = addPropertyClaimToNested(strategy.property_claims, parentId, newPropertyClaim);
                    if (found) {
                        return true; // Indicates the property claim was found and updated within nested property claims of strategy
                    }
                }
            }
        }
    }

    return false; // Indicates the parent property claim was not found
}

// UPDATE PROPERTY CLAIMS
// TODO: Evidence and Property Claims are doing a similar actions when moving this can be refactored.

export const updatePropertyClaimNested = (array: any, id: any, newPropertyClaim: any) => {
    // Iterate through the property claims array
    for (let i = 0; i < array.length; i++) {
        let propertyClaim = array[i];

        // Check if this property claim matches the parent ID
        if (propertyClaim.id === id) {
            array[i] = { ...propertyClaim, ...newPropertyClaim };

            return array; // Return the updated array
        }

        // If this property claim has nested property claims, recursively search within them
        if (propertyClaim.property_claims && propertyClaim.property_claims.length > 0) {
            const updatedNestedArray = updatePropertyClaimNested(propertyClaim.property_claims, id, newPropertyClaim);
            if (updatedNestedArray) {
                return array; // Return the updated array
            }
        }

        // If this property claim has strategies, recursively search within them
        if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
            for (const strategy of propertyClaim.strategies) {
                if (strategy.property_claims && strategy.property_claims.length > 0) {
                    const updatedNestedArray = updatePropertyClaimNested(strategy.property_claims, id, newPropertyClaim);
                    if (updatedNestedArray) {
                        return array; // Return the updated array
                    }
                }
            }
        }
    }

    return null; // Indicates the parent property claim was not found
}

const removePropertyClaimFromOldLocation = (array: any, id: any) => {
    return array.map((item: any) => {
        if (item.property_claims) {
            // Filter out the claim with the given id
            item.property_claims = item.property_claims.filter((claim: any) => claim.id !== id);
            // Recursively remove the claim from nested property_claims
            item.property_claims = removePropertyClaimFromOldLocation(item.property_claims, id);
        }

        if (item.strategies) {
            // Recursively process each strategy
            item.strategies = item.strategies.map((strategy: any) => {
                if (strategy.property_claims) {
                    // Filter out the claim with the given id from the strategy's property_claims
                    strategy.property_claims = strategy.property_claims.filter((claim: any) => claim.id !== id);
                    // Recursively remove the claim from the strategy's nested property_claims
                    strategy.property_claims = removePropertyClaimFromOldLocation(strategy.property_claims, id);
                }
                return strategy;
            });
        }

        return item;
    });
};

const addPropertyClaimToLocation = (array: any, property_claim: any, newParentId: any) => {
    return array.map((item: any) => {
        if (item.id === newParentId) {
            if (!item.property_claims) {
                item.property_claims = [];
            }
            item.property_claims.push(property_claim);
        }

        if (item.property_claims) {
            item.property_claims = addPropertyClaimToLocation(item.property_claims, property_claim, newParentId);
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
                    strategy.property_claims = addPropertyClaimToLocation(strategy.property_claims, property_claim, newParentId);
                }
                return strategy;
            });
        }

        return item;
    });
};

export const updatePropertyClaimNestedMove = (array: any, id: any, newPropertyClaim: any) => {
    // Find the existing property claim item
    let existingPropertyClaim = null;
    const findExstingPropertyClaim = (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
            let item = arr[i];

            if (item.id === id) {
                existingPropertyClaim = item;
                return;
            }

            // if (item.property_claims) {
            //     for (let j = 0; j < item.property_claims.length; j++) {
            //         if (item.property_claims[j].id === id) {
            //             existingPropertyClaim = item.property_claims[j];
            //             return;
            //         }
            //     }
            // }
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
    const arrayWithoutOldPropertyClaim = removePropertyClaimFromOldLocation(array, id)

    // Merge existing evidence properties with updated ones
    const updatedPropertyClaim = { ...existingPropertyClaim as any, ...newPropertyClaim };

    // Add evidence to the new location
    // const newClaimId = newPropertyClaim.property_claim_id[0];

    let newParentId = null
    let newParentType = null

    if(updatedPropertyClaim.goal_id !== null) {
        newParentId = updatedPropertyClaim.goal_id
    }
    if(updatedPropertyClaim.strategy_id !== null) {
        newParentId = updatedPropertyClaim.strategy_id
    }
    if(updatedPropertyClaim.property_claim_id !== null) {
        newParentId = updatedPropertyClaim.property_claim_id
    }

    const updatedArray = addPropertyClaimToLocation(arrayWithoutOldPropertyClaim, updatedPropertyClaim, newParentId);

    return updatedArray;
};

export const listPropertyClaims = (array: any, currentClaimName: string, claims: any[] = []) => {
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
                    listPropertyClaims(strategy.property_claims, currentClaimName, claims);
                }
            }
        }
    }

    return claims;
};

export const addEvidenceToClaim = (array: any, parentId: any, newEvidence: any) => {
    // Iterate through the property claims array
    for (let i = 0; i < array.length; i++) {
        const propertyClaim = array[i];

        // Check if this property claim matches the parent ID
        if (propertyClaim.id === parentId) {
            console.log(propertyClaim)
            // Check if the property claim already has evidence array
            if (!propertyClaim.evidence) {
                propertyClaim.evidence = [];
            }

            // Add the new property claim to the property claim's property claims
            propertyClaim.evidence.push(newEvidence);

            return true; // Indicates the property claim was found and updated
        }

        // If this property claim has nested property claims, recursively search within them
        if (propertyClaim.property_claims && propertyClaim.property_claims.length > 0) {
            const found = addEvidenceToClaim(propertyClaim.property_claims, parentId, newEvidence);
            if (found) {
                return true; // Indicates the property claim was found and updated within nested property claims
            }
        }

        // If this property claim has strategies, recursively search within them
        if (propertyClaim.strategies && propertyClaim.strategies.length > 0) {
            for (const strategy of propertyClaim.strategies) {
                if (strategy.property_claims && strategy.property_claims.length > 0) {
                    const found = addEvidenceToClaim(strategy.property_claims, parentId, newEvidence);
                    if (found) {
                        return true; // Indicates the property claim was found and updated within nested property claims of strategy
                    }
                }
            }
        }
    }

    return false; // Indicates the parent property claim was not found
}

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
            const updatedNestedArray = updateEvidenceNested(item.evidence, id, newEvidence)
            if (updatedNestedArray) {
                return array
            }
        }

        if (item.property_claims && item.property_claims.length > 0) {
            const updatedNestedArray = updateEvidenceNested(item.property_claims, id, newEvidence)
            if (updatedNestedArray) {
                return array
            }
        }

        if (item.strategies && item.strategies.length > 0) {
            for (const strategy of item.strategies) {
                if (strategy.property_claims && strategy.property_claims.length > 0) {
                    const updatedNestedArray = updateEvidenceNested(strategy.property_claims, id, newEvidence)
                    if (updatedNestedArray) {
                        return array
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
            item.evidence = item.evidence.filter((evidence: any) => evidence.id !== id);
        }

        if (item.property_claims) {
            item.property_claims = removeEvidenceFromOldLocation(item.property_claims, id);
        }

        if (item.strategies) {
            item.strategies = item.strategies.map((strategy: any) => {
                if (strategy.property_claims) {
                    strategy.property_claims = removeEvidenceFromOldLocation(strategy.property_claims, id);
                }
                return strategy;
            });
        }

        return item;
    });
};

const addEvidenceToNewLocation = (array: any, evidence: any, newClaimId: any) => {
    return array.map((item: any) => {
        if (item.id === newClaimId) {
            if (!item.evidence) {
                item.evidence = [];
            }
            item.evidence.push(evidence);
        }

        if (item.property_claims) {
            item.property_claims = addEvidenceToNewLocation(item.property_claims, evidence, newClaimId);
        }

        if (item.strategies) {
            item.strategies = item.strategies.map((strategy:any) => {
                if (strategy.property_claims) {
                    strategy.property_claims = addEvidenceToNewLocation(strategy.property_claims, evidence, newClaimId);
                }
                return strategy;
            });
        }

        return item;
    });
};

export const updateEvidenceNestedMove = (array: any, id: any, newEvidence: any) => {
    console.log('updateEvidenceNested called with array:', array, 'id:', id, 'newEvidence:', newEvidence);

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
    const arrayWithoutOldEvidence = removeEvidenceFromOldLocation(array, id)

    // Merge existing evidence properties with updated ones
    const updatedEvidence = { ...existingEvidence as any, ...newEvidence };

    // Add evidence to the new location
    const newClaimId = newEvidence.property_claim_id[0];
    const updatedArray = addEvidenceToNewLocation(arrayWithoutOldEvidence, updatedEvidence, newClaimId);

    return updatedArray;
};

export const createAssuranceCaseNode = async (entity: string, newItem: any, token: string | null) => {
    if (!token) return console.log('No token')

    try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/`

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
            return { error: `Something went wrong ${response.status}` }
        }

        const result = await response.json()
        console.log('Node Create Result', result)

        const data = {
            ...newItem,
            id: result.id
        }

        return { data }
    } catch (error) {
        console.log('Error', error)
        return { error }
    }
}

export const deleteAssuranceCaseNode = async (type: string, id: any, token: string | null) => {
    if (!token) return console.log('No token')

    let entity = null
    switch (type) {
        case 'context':
            entity = 'contexts'
            break;
        case 'strategy':
            entity = 'strategies'
            break;
        case 'property':
            entity = 'propertyclaims'
            break;
        case 'evidence':
            entity = 'evidence'
            break;
        default:
            entity = 'goals'
            break;
    }

    try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/`

        const requestOptions: RequestInit = {
            method: "DELETE",
            headers: {
                Authorization: `Token ${token}`,
                "Content-Type": "application/json",
            }
        };
        const response = await fetch(url, requestOptions);

        if (response.ok) {
            return true
        }
    } catch (error) {
        console.log('Error', error)
        return false
    }
}

export const updateAssuranceCaseNode = async (type: string, id: any, token: string | null, updateItem: any) => {
    if (!token) return console.log('No token')

    let entity = null
    switch (type) {
        case 'context':
            entity = 'contexts'
            break;
        case 'strategy':
            entity = 'strategies'
            break;
        case 'property':
            entity = 'propertyclaims'
            break;
        case 'evidence':
            entity = 'evidence'
            break;
        default:
            entity = 'goals'
            break;
    }

    try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${id}/`

        const requestOptions: RequestInit = {
            method: "PUT",
            headers: {
                Authorization: `Token ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updateItem)
        };
        const response = await fetch(url, requestOptions);

        if (response.ok) {
            return true
        }
    } catch (error) {
        console.log('Error', error)
        return false
    }
}

export const findItemById = async (item: any, id: any) => {
    if (item.id === id) {
        // updateFn(item); // Update the item
        return item
    }
    if (item.context) {
        item.context.forEach((contextItem: any) => findItemById(contextItem, id));
    }
    if (item.property_claims) {
        item.property_claims.forEach((propertyClaim: any) => {
            findItemById(propertyClaim, id);
            if (propertyClaim.property_claims) {
                propertyClaim.property_claims.forEach((childPropertyClaim: any) => findItemById(childPropertyClaim, id));
            }
        });
    }
    if (item.evidence) {
        item.evidence.forEach((evidenceItem: any) => findItemById(evidenceItem, id));
    }
    if (item.strategies) {
        item.strategies.forEach((strategyItem: any) => {
            findItemById(strategyItem, id);
            if (strategyItem.property_claims) {
                strategyItem.property_claims.forEach((childPropertyClaim: any) => findItemById(childPropertyClaim, id));
            }
        });
    }

    return null
}

export const updateAssuranceCase = async (type: string, assuranceCase: any, updatedItem: any, id: any, node: any, move: boolean = false) => {
    let updatedAssuranceCase: any
    let updatedGoals: any

    switch (type) {
        case 'context':
            const newContext = assuranceCase.goals[0].context.map((context: any) => {
                if (context.id === id) {
                    return {
                        ...context,
                        ...updatedItem
                    }
                }
                return { ...context }
            })

            updatedAssuranceCase = {
                ...assuranceCase,
                goals: [{ ...assuranceCase.goals[0], context: newContext }]
            }
            return updatedAssuranceCase
        case 'strategy':
            // Create a new strategy array by adding the new context item
            const newStrategy = assuranceCase.goals[0].strategies.map((strategy: any) => {
                if (strategy.id === id) {
                    return {
                        ...strategy,
                        ...updatedItem
                    }
                }
                return { ...strategy }
            })

            // Create a new assuranceCase object with the updated strategy array
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: [
                    {
                        ...assuranceCase.goals[0],
                        strategies: newStrategy
                    }
                ]
            }
            return updatedAssuranceCase
        case 'property':
            // updatedGoals = updatePropertyClaimNested(assuranceCase.goals, id, updatedItem);
            if(move) {
                updatedGoals = updatePropertyClaimNestedMove(assuranceCase.goals, id, updatedItem);
            } else {
                updatedGoals = updatePropertyClaimNested(assuranceCase.goals, id, updatedItem);
            }
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: updatedGoals
            }
            return updatedAssuranceCase
        case 'evidence':
            // updatedGoals = updateEvidenceNested(assuranceCase.goals, id, updatedItem);
            if(move) {
                updatedGoals = updateEvidenceNestedMove(assuranceCase.goals, id, updatedItem);
            } else {
                updatedGoals = updateEvidenceNested(assuranceCase.goals, id, updatedItem);
            }
            console.log(updatedGoals)
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: updatedGoals
            }
            return updatedAssuranceCase
        default:
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: [{
                    ...assuranceCase.goals[0],
                    ...updatedItem
                }]
            }
            return updatedAssuranceCase
    }
}

export const setNodeIdentifier = (parentNode: any, newNodeType: string) => {
    let identifier: number = 0
    let newArray: any[] = []
    let parentPrefix: number | null = null

    switch (newNodeType.toLowerCase()) {
        case 'context':
            newArray = [...parentNode.data.context]
            break;
        case 'strategy':
            newArray = [...parentNode.data.strategies]
            break;
        case 'property':
            parentPrefix = parseFloat(parentNode.data.name.substring(1))
            newArray = [...parentNode.data.property_claims]
            break;
        case 'evidence':
            newArray = [...parentNode.data.evidence]
            break;
        default:
            break;
    }

    if (newArray.length > 0) {
        const lastItem = newArray.pop()

        if (newNodeType === 'property' && parentNode.type === 'property') {
            const lastIdentifier = parseFloat(lastItem.name.substring(1)).toString()
            const subIdentifier = lastIdentifier.split('.')[1]
            identifier = parseInt(subIdentifier) + 1;
        }
        else {
            const lastIdentifier = parseFloat(lastItem.name.substring(1))
            identifier = lastIdentifier + 1
        }
    } else {
        identifier = 1
    }

    if (parentNode && parentNode.type === 'property' && parentPrefix !== null) {
        return `${parentPrefix}.${identifier}`;
    }

    return identifier.toString()
}

// Removing elements from Assurance Case
const removeItemFromNestedStructure = (array: any, id: any) => {
    return array.map((item: any) => {
        // Remove from property_claims
        if (item.property_claims) {
            item.property_claims = item.property_claims.filter((claim: any) => claim.id !== id);
            item.property_claims = removeItemFromNestedStructure(item.property_claims, id);
        }

        // Remove from strategies
        if (item.strategies) {
            item.strategies = item.strategies.map((strategy: any) => {
                if (strategy.property_claims) {
                    strategy.property_claims = strategy.property_claims.filter((claim: any) => claim.id !== id);
                    strategy.property_claims = removeItemFromNestedStructure(strategy.property_claims, id);
                }
                return strategy;
            }).filter((strategy: any) => strategy.id !== id);
        }

        // Remove from contexts
        if (item.context) {
            item.context = item.context.filter((context: any) => context.id !== id);
            item.context = removeItemFromNestedStructure(item.context, id);
        }

        // Remove from evidence
        if (item.evidence) {
            item.evidence = item.evidence.filter((evidence: any) => evidence.id !== id);
            item.evidence = removeItemFromNestedStructure(item.evidence, id);
        }

        return item;
    }).filter((item: any) => item.id !== id);
};

export const removeAssuranceCaseNode = (assuranceCase: any, id: any) => {
    const updatedGoals = removeItemFromNestedStructure(assuranceCase.goals, id);
    return {
        ...assuranceCase,
        goals: updatedGoals
    };
}

export const extractGoalsClaimsStrategies = (array: any) => {
    const result = {
        goal: null,
        claims: <any[]>[],
        strategies: <any[]>[]
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
    } else if (typeof assuranceCase === 'object' && assuranceCase !== null) {
        assuranceCase.hidden = false;

        Object.keys(assuranceCase).forEach(key => {
            addHiddenProp(assuranceCase[key]);
        });
    }
    return assuranceCase
}

export function toggleHiddenForChildren(assuranceCase: AssuranceCase, parentId: number): AssuranceCase {
    function toggleChildren(obj: any, parentId: number, parentFound: boolean, hide: boolean): void {
        if (Array.isArray(obj)) {
            obj.forEach(item => toggleChildren(item, parentId, parentFound, hide));
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
                obj.childrenHidden = hide;  // Track the state of children visibility
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

            Object.keys(obj).forEach(key => toggleChildren(obj[key], parentId, parentFound, hide));
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
        let childrenKeys = ['goals', 'context', 'property_claims', 'strategies', 'evidence', 'comments'];
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
    let childrenKeys = ['context', 'property_claims', 'strategies', 'evidence', 'comments'];
    for (let key of childrenKeys) {
        if (element[key]) {
            for (let child of element[key]) {
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

export const findSiblingHiddenState = (assuranceCase: AssuranceCase, parentId: number) => {
    const element = findElementById(assuranceCase, parentId);
    if (element) {
        // console.log(`Element with ID ${parentId} found:`, element);
        const hiddenStatus = getChildrenHiddenStatus(element);
        return hiddenStatus[0]
        // console.log(`Hidden statuses of children:`, hiddenStatus);
    } else {
        console.log(`Element with ID ${parentId} not found.`);
    }
}
