/**
 * Node utility functions for assurance cases
 * Handles node identification, searching, and extraction operations
 */

import type {
	AssuranceCase,
	Context,
	Evidence,
	Goal,
	PropertyClaim,
	Strategy,
} from "@/types";
import type { NestedArrayItem, ReactFlowNode } from "./types";

type DescriptionMap = {
	[key: string]: string | undefined;
};

const DESCRIPTION_FROM_TYPE: DescriptionMap = {
	goal: "Goals are the overarching objectives of the assurance case. They represent what needs to be achieved or demonstrated.",
	context:
		"Context elements provide background information and assumptions that frame the assurance case.",
	property_claim:
		"Property claims assert specific properties or characteristics that support the goals.",
	property:
		"Property claims assert specific properties or characteristics that support the goals.",
	evidence:
		"Evidence provides factual support and verification for the claims made in the assurance case.",
	strategy:
		"Strategies describe the approach or method used to decompose goals into sub-goals or claims.",
};

/**
 * Returns a description for a given case item type.
 */
export const caseItemDescription = (
	caseItemName: string | null | undefined
): string => {
	if (!caseItemName) {
		return "Unknown case item type.";
	}
	return DESCRIPTION_FROM_TYPE[caseItemName] || "Unknown case item type.";
};

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
	if ("context" in item && (item as Goal).context) {
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
		"property_claims" in item &&
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
	if ("evidence" in item && (item as PropertyClaim).evidence) {
		return searchInEvidenceItems((item as PropertyClaim).evidence, id);
	}
	return null;
};

// Helper function to search strategies if exists
const searchStrategiesIfExists = (
	item: NestedArrayItem | AssuranceCase,
	id: number
): NestedArrayItem | null => {
	if ("strategies" in item && (item as Goal).strategies) {
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

/**
 * Recursively searches for an item by its ID within a nested structure.
 */
export const findItemById = (
	item: NestedArrayItem | AssuranceCase,
	id: number
): NestedArrayItem | null => {
	// Check if it's an AssuranceCase (which doesn't match NestedArrayItem structure)
	if ("goals" in item && item.id === id) {
		// AssuranceCase cannot be returned as NestedArrayItem
		return null;
	}

	// For NestedArrayItem types
	if (item.id === id && "type" in item) {
		return item as NestedArrayItem;
	}

	return searchInAllNestedStructures(item, id);
};

// Helper function to get the array based on node type
const getNodeArray = (
	parentNode: ReactFlowNode,
	nodeType: string
): (Context | Strategy | PropertyClaim | Evidence)[] => {
	switch (nodeType.toLowerCase()) {
		case "context":
			return [...(parentNode.data.context || [])];
		case "strategy":
			return [...(parentNode.data.strategies || [])];
		case "property":
			return [...(parentNode.data.property_claims || [])];
		case "evidence":
			return [...(parentNode.data.evidence || [])];
		default:
			return [];
	}
};

// Helper function to calculate identifier from last item
const calculateIdentifierFromLastItem = (
	lastItem: Context | Strategy | PropertyClaim | Evidence | undefined,
	newNodeType: string,
	parentNode: ReactFlowNode,
	arrayLength: number
): number => {
	if (!lastItem?.name || typeof lastItem.name !== "string") {
		// If there's no valid name, use the original array length as identifier
		return arrayLength + 1; // +1 because we popped one item
	}

	if (newNodeType === "property" && parentNode.type === "property") {
		const lastIdentifier = Number.parseFloat(
			lastItem.name.substring(1)
		).toString();
		const subIdentifier = lastIdentifier.split(".")[1];
		return Number.parseInt(subIdentifier, 10) + 1;
	}

	const lastIdentifier = Number.parseFloat(lastItem.name.substring(1));
	return lastIdentifier + 1;
};

/**
 * Generates a unique identifier for a new node based on its parent and type.
 */
export const setNodeIdentifier = (
	parentNode: ReactFlowNode,
	newNodeType: string
): string => {
	let identifier = 0;
	let parentPrefix: number | null = null;

	// Get parent prefix for property nodes
	if (
		newNodeType.toLowerCase() === "property" &&
		parentNode.data.name &&
		typeof parentNode.data.name === "string"
	) {
		parentPrefix = Number.parseFloat(parentNode.data.name.substring(1));
	}

	const newArray = getNodeArray(parentNode, newNodeType);

	if (newArray.length > 0) {
		const lastItem = newArray.pop();
		identifier = calculateIdentifierFromLastItem(
			lastItem,
			newNodeType,
			parentNode,
			newArray.length
		);
	} else {
		identifier = 1;
	}

	if (parentNode && parentNode.type === "property" && parentPrefix !== null) {
		return `${parentPrefix}.${identifier}`;
	}

	// For specific node types, return prefixed identifiers
	switch (newNodeType.toLowerCase()) {
		case "context":
			return `C${identifier}`;
		case "strategy":
			return `S${identifier}`;
		case "evidence":
			return `E${identifier - 1}`; // Evidence seems to use 0-based indexing
		default:
			return identifier.toString();
	}
};

/**
 * Recursively removes an item with a specific `id` and `type` from a deeply nested array structure.
 */
const removeItemFromNestedStructure = (
	array: NestedArrayItem[],
	id: number,
	type: string
): NestedArrayItem[] => {
	return array
		.map((item: NestedArrayItem) => {
			// Remove from property_claims
			if ("property_claims" in item && item.property_claims) {
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
			if ("strategies" in item && item.strategies) {
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
			if ("context" in item && item.context) {
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
			if ("evidence" in item && item.evidence) {
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

// Helper function to collect goals
const collectGoal = (
	item: NestedArrayItem,
	result: {
		goal: Goal | null;
		claims: PropertyClaim[];
		strategies: (Goal | PropertyClaim | Strategy)[];
	}
): void => {
	if (item.type === "TopLevelNormativeGoal" || item.type === "Goal") {
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
	// Handle both "PropertyClaim" (from Django API) and "property_claim" (legacy format)
	if (item.type === "PropertyClaim" || item.type === "property_claim") {
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
	if (item.type === "Goal" || item.type === "Strategy") {
		result.strategies.push(item as Goal | Strategy);
	}
};

// Helper function to traverse nested structures
const traverseNestedStructures = (
	item: NestedArrayItem,
	traverse: (items: NestedArrayItem[]) => void
): void => {
	if ("property_claims" in item && item.property_claims) {
		traverse(item.property_claims as NestedArrayItem[]);
	}
	if ("strategies" in item && item.strategies) {
		traverse(item.strategies as NestedArrayItem[]);
	}
	if ("context" in item && item.context) {
		traverse(item.context as NestedArrayItem[]);
	}
	if ("evidence" in item && item.evidence) {
		traverse(item.evidence as NestedArrayItem[]);
	}
};

/**
 * Extracts goals, property claims, and strategies from a nested structure.
 */
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
