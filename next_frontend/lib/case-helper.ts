export const addPropertyClaimToNested = (propertyClaims: any, parentId: any, newPropertyClaim: any ) => {
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

export const updatePropertyClaimNested = (array: any, id: any, newPropertyClaim: any ) => {
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

export const updateEvidenceNested = (array: any, id: any, newEvidence: any) => {
    // Iterate through the array
    for (let i = 0; i < array.length; i++) {
        let item = array[i];

        // Check if this evidence matches the parent ID
        if (item.id === id) {
            array[i] = { ...item, ...newEvidence };
            return array; // Return the updated array
        }

        if(item.evidence && item.evidence.length > 0) {
            const updatedNestedArray = updateEvidenceNested(item.evidence, id, newEvidence)
            if (updatedNestedArray) {
                return array
            }
        }

        if(item.property_claims && item.property_claims.length > 0) {
            const updatedNestedArray = updateEvidenceNested(item.property_claims, id, newEvidence)
            if (updatedNestedArray) {
                return array
            }
        }

        if(item.strategies && item.strategies.length > 0) {
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

export const createAssuranceCaseNode = async (entity: string, newItem: any, token: string | null) => {
    if(!token) return console.log('No token')

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

        if(!response.ok) {
            return { error: `Something went wrong ${response.status}` }
        }

        const result = await response.json()

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
    if(!token) return console.log('No token')

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

        if(response.ok) {
            return true
        }
    } catch (error) {
        console.log('Error', error)
        return false
    }
}

export const updateAssuranceCaseNode = async (type: string, id: any, token: string | null, updateItem: any) => {
    if(!token) return console.log('No token')

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

        if(response.ok) {
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

export const updateAssuranceCase = async (type: string, assuranceCase: any, updatedItem: any, id: any, node: any) => {
    let updatedAssuranceCase: any
    let updatedGoals: any

    switch (type) {
        case 'context':
            const newContext = assuranceCase.goals[0].context.map((context: any) => {
                if(context.id === id) {
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
                if(strategy.id === id) {
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
            updatedGoals = updatePropertyClaimNested(assuranceCase.goals, id, updatedItem);
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: updatedGoals
            }
            return updatedAssuranceCase
        case 'evidence':
            updatedGoals = updateEvidenceNested(assuranceCase.goals, id, updatedItem);
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: updatedGoals
            }
            return updatedAssuranceCase
        default:
            updatedAssuranceCase = {
                ...assuranceCase,
                goals: [ {
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

    if(newArray.length > 0) {
        const lastItem = newArray.pop()

        if(newNodeType === 'property' && parentNode.type === 'property') {
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
