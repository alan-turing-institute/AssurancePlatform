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