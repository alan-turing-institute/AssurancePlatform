/**
 * Node utility functions for assurance cases
 * Handles node identification, searching, and extraction operations
 */

import type {
	AssuranceCaseResponse,
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";
import type { NestedArrayItem, ReactFlowNode } from "./types";

interface DescriptionMap {
	[key: string]: string | undefined;
}

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

// Note: Context is now a string[] attribute, not an array of elements
// This function is kept for backwards compatibility but always returns null

// Helper function to search in property claims
const searchInPropertyClaims = (
	propertyClaims: PropertyClaimResponse[],
	id: string
): NestedArrayItem | null => {
	for (const propertyClaim of propertyClaims) {
		const found = findItemById(propertyClaim, id);
		if (found) {
			return found;
		}

		if (propertyClaim.propertyClaims) {
			for (const childPropertyClaim of propertyClaim.propertyClaims) {
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
	evidence: EvidenceResponse[],
	id: string
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
	strategies: StrategyResponse[],
	id: string
): NestedArrayItem | null => {
	for (const strategyItem of strategies) {
		const found = findItemById(strategyItem, id);
		if (found) {
			return found;
		}

		if (strategyItem.propertyClaims) {
			for (const childPropertyClaim of strategyItem.propertyClaims) {
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
// Note: Context is now a string[] attribute, not an array of elements
// This function always returns null but is kept for structural consistency
const searchContextIfExists = (
	_item: NestedArrayItem | AssuranceCaseResponse,
	_id: string
): NestedArrayItem | null => {
	// Context is now a string[] attribute, not searchable elements
	return null;
};

// Helper function to search property claims if exists
const searchPropertyClaimsIfExists = (
	item: NestedArrayItem | AssuranceCaseResponse,
	id: string
): NestedArrayItem | null => {
	if (
		"propertyClaims" in item &&
		(item as GoalResponse | PropertyClaimResponse | StrategyResponse)
			.propertyClaims
	) {
		return searchInPropertyClaims(
			(item as GoalResponse | PropertyClaimResponse | StrategyResponse)
				.propertyClaims,
			id
		);
	}
	return null;
};

// Helper function to search evidence if exists
const searchEvidenceIfExists = (
	item: NestedArrayItem | AssuranceCaseResponse,
	id: string
): NestedArrayItem | null => {
	if ("evidence" in item && (item as PropertyClaimResponse).evidence) {
		return searchInEvidenceItems((item as PropertyClaimResponse).evidence, id);
	}
	return null;
};

// Helper function to search strategies if exists
const searchStrategiesIfExists = (
	item: NestedArrayItem | AssuranceCaseResponse,
	id: string
): NestedArrayItem | null => {
	if ("strategies" in item && (item as GoalResponse).strategies) {
		return searchInStrategyItems((item as GoalResponse).strategies, id);
	}
	return null;
};

// Helper function to search in all nested structures
const searchInAllNestedStructures = (
	item: NestedArrayItem | AssuranceCaseResponse,
	id: string
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
	item: NestedArrayItem | AssuranceCaseResponse,
	id: string
): NestedArrayItem | null => {
	// Check if it's an AssuranceCaseResponse (which doesn't match NestedArrayItem structure)
	// AssuranceCaseResponse cannot be returned as NestedArrayItem, so skip to nested search
	if ("goals" in item) {
		return searchInAllNestedStructures(item, id);
	}

	// For NestedArrayItem types
	if (item.id === id && "type" in item) {
		return item as NestedArrayItem;
	}

	return searchInAllNestedStructures(item, id);
};

// Helper function to get the array based on node type
// Note: Context is now a string[] attribute, not an element array
const getNodeArray = (
	parentNode: ReactFlowNode,
	nodeType: string
): (StrategyResponse | PropertyClaimResponse | EvidenceResponse)[] => {
	switch (nodeType.toLowerCase()) {
		case "strategy":
			return [...(parentNode.data.strategies || [])];
		case "property":
			return [...(parentNode.data.propertyClaims || [])];
		case "evidence":
			return [...(parentNode.data.evidence || [])];
		default:
			return [];
	}
};

// Helper function to calculate identifier from last item
const calculateIdentifierFromLastItem = (
	lastItem:
		| StrategyResponse
		| PropertyClaimResponse
		| EvidenceResponse
		| undefined,
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
		const subIdentifier = lastIdentifier.split(".")[1] ?? "0";
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
	id: string,
	type: string
): NestedArrayItem[] => {
	return array
		.map((item: NestedArrayItem) => {
			// Remove from propertyClaims
			if ("propertyClaims" in item && item.propertyClaims) {
				(
					item as GoalResponse | PropertyClaimResponse | StrategyResponse
				).propertyClaims = (
					item as GoalResponse | PropertyClaimResponse | StrategyResponse
				).propertyClaims.filter(
					(claim: PropertyClaimResponse) =>
						!(claim.id === id && claim.type === type)
				);
				(
					item as GoalResponse | PropertyClaimResponse | StrategyResponse
				).propertyClaims = removeItemFromNestedStructure(
					(item as GoalResponse | PropertyClaimResponse | StrategyResponse)
						.propertyClaims as unknown as NestedArrayItem[],
					id,
					type
				) as unknown as PropertyClaimResponse[];
			}

			// Remove from strategies
			if ("strategies" in item && item.strategies) {
				(item as GoalResponse).strategies = (item as GoalResponse).strategies
					.map((strategy: StrategyResponse) => {
						if (strategy.propertyClaims) {
							strategy.propertyClaims = strategy.propertyClaims.filter(
								(claim: PropertyClaimResponse) =>
									!(claim.id === id && claim.type === type)
							);
							strategy.propertyClaims = removeItemFromNestedStructure(
								strategy.propertyClaims as unknown as NestedArrayItem[],
								id,
								type
							) as unknown as PropertyClaimResponse[];
						}
						return strategy;
					})
					.filter(
						(strategy: StrategyResponse) =>
							!(strategy.id === id && strategy.type === type)
					);
			}

			// Note: context is now a string[] attribute, not an array of elements to remove

			// Remove from evidence
			if ("evidence" in item && item.evidence) {
				(item as PropertyClaimResponse).evidence = (
					item as PropertyClaimResponse
				).evidence.filter(
					(evidence: EvidenceResponse) =>
						!(evidence.id === id && evidence.type === type)
				);
				(item as PropertyClaimResponse).evidence =
					removeItemFromNestedStructure(
						(item as PropertyClaimResponse)
							.evidence as unknown as NestedArrayItem[],
						id,
						type
					) as unknown as EvidenceResponse[];
			}

			return item;
		})
		.filter((item: NestedArrayItem) => !(item.id === id && item.type === type));
};

/**
 * Removes an assurance case node from the specified assurance case by its ID and type.
 */
export const removeAssuranceCaseNode = (
	assuranceCase: AssuranceCaseResponse,
	id: string,
	type: string
): AssuranceCaseResponse => {
	const updatedGoals = removeItemFromNestedStructure(
		(assuranceCase.goals ?? []) as unknown as NestedArrayItem[],
		id,
		type
	) as unknown as GoalResponse[];
	return {
		...assuranceCase,
		goals: updatedGoals,
	};
};

// Helper function to collect goals
const collectGoal = (
	item: NestedArrayItem,
	result: {
		goal: GoalResponse | null;
		claims: PropertyClaimResponse[];
		strategies: (GoalResponse | PropertyClaimResponse | StrategyResponse)[];
	}
): void => {
	if (item.type === "goal") {
		result.goal = item as GoalResponse;
	}
};

// Helper function to collect property claims
const collectPropertyClaim = (
	item: NestedArrayItem,
	result: {
		goal: GoalResponse | null;
		claims: PropertyClaimResponse[];
		strategies: (GoalResponse | PropertyClaimResponse | StrategyResponse)[];
	}
): void => {
	if (item.type === "property_claim") {
		result.claims.push(item as PropertyClaimResponse);
	}
};

// Helper function to collect strategies
const collectStrategy = (
	item: NestedArrayItem,
	result: {
		goal: GoalResponse | null;
		claims: PropertyClaimResponse[];
		strategies: (GoalResponse | PropertyClaimResponse | StrategyResponse)[];
	}
): void => {
	if (item.type === "goal" || item.type === "strategy") {
		result.strategies.push(item as GoalResponse | StrategyResponse);
	}
};

// Helper function to traverse nested structures
const traverseNestedStructures = (
	item: NestedArrayItem,
	traverse: (items: NestedArrayItem[]) => void
): void => {
	if ("propertyClaims" in item && item.propertyClaims) {
		traverse(item.propertyClaims as NestedArrayItem[]);
	}
	if ("strategies" in item && item.strategies) {
		traverse(item.strategies as NestedArrayItem[]);
	}
	// Note: context is now a string[] attribute, not an array of elements to traverse
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
	goal: GoalResponse | null;
	claims: PropertyClaimResponse[];
	strategies: (GoalResponse | PropertyClaimResponse | StrategyResponse)[];
} => {
	const result = {
		goal: null as GoalResponse | null,
		claims: [] as PropertyClaimResponse[],
		strategies: [] as (
			| GoalResponse
			| PropertyClaimResponse
			| StrategyResponse
		)[],
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
