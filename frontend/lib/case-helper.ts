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