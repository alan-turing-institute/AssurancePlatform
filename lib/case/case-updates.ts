/**
 * Assurance case update operations
 * Handles updating case elements (goals, contexts, strategies, property claims, evidence)
 */

import type {
	AssuranceCaseResponse,
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";
import { updateEvidenceNested, updateEvidenceNestedMove } from "./evidence";
import {
	updatePropertyClaimNested,
	updatePropertyClaimNestedMove,
} from "./property-claims";
import type { ReactFlowNode } from "./types";

// Note: updateContext function removed - context is now a string[] attribute, not an element type

// Helper function to update strategy
const updateStrategy = (
	assuranceCase: AssuranceCaseResponse,
	id: string,
	updatedItem: Partial<StrategyResponse>
): AssuranceCaseResponse => {
	const firstGoal = assuranceCase.goals?.[0];
	const newStrategy = (firstGoal?.strategies || []).map(
		(strategy: StrategyResponse) => {
			if (strategy.id === id && strategy.type === "strategy") {
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
		goals: firstGoal
			? [
					{
						...firstGoal,
						strategies: newStrategy,
					},
				]
			: [],
	};
};

// Options type for updatePropertyClaim helper
interface UpdatePropertyClaimOptions {
	assuranceCase: AssuranceCaseResponse;
	id: string;
	move: boolean;
	updatedItem: Partial<PropertyClaimResponse>;
}

// Helper function to update property claim
const updatePropertyClaim = (
	options: UpdatePropertyClaimOptions
): AssuranceCaseResponse => {
	const { assuranceCase, id, updatedItem, move } = options;

	if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
		return assuranceCase;
	}

	const goal = assuranceCase.goals[0];
	if (!goal) {
		return assuranceCase;
	}

	// Try updating in goal's direct property claims first
	const directClaims = goal.propertyClaims || [];
	const updatedDirectClaims = move
		? updatePropertyClaimNestedMove(
				directClaims,
				id,
				updatedItem as Partial<PropertyClaimResponse> & {
					propertyClaimId?: string;
				}
			)
		: updatePropertyClaimNested(directClaims, id, updatedItem);

	// Check if we found and updated in direct claims
	// Only check reference equality if directClaims has content, otherwise
	// the nested update returns a new empty array and the comparison is always true
	if (directClaims.length > 0 && updatedDirectClaims !== directClaims) {
		return {
			...assuranceCase,
			goals: [{ ...goal, propertyClaims: updatedDirectClaims }],
		};
	}

	// If not found in direct claims, search in strategies
	const strategies = goal.strategies || [];
	let foundInStrategies = false;
	const updatedStrategies = strategies.map((strategy) => {
		if (foundInStrategies) {
			return strategy;
		}
		const strategyClaims = strategy.propertyClaims || [];
		const updatedStrategyClaims = move
			? updatePropertyClaimNestedMove(
					strategyClaims,
					id,
					updatedItem as Partial<PropertyClaimResponse> & {
						propertyClaimId?: string;
					}
				)
			: updatePropertyClaimNested(strategyClaims, id, updatedItem);

		if (updatedStrategyClaims !== strategyClaims) {
			foundInStrategies = true;
			return { ...strategy, propertyClaims: updatedStrategyClaims };
		}
		return strategy;
	});

	if (foundInStrategies) {
		return {
			...assuranceCase,
			goals: [{ ...goal, strategies: updatedStrategies }],
		};
	}

	// Not found anywhere, return unchanged
	return assuranceCase;
};

// Options type for updateEvidence helper
interface UpdateEvidenceOptions {
	assuranceCase: AssuranceCaseResponse;
	id: string;
	move: boolean;
	updatedItem: Partial<EvidenceResponse>;
}

// Helper function to update evidence
const updateEvidence = (
	options: UpdateEvidenceOptions
): AssuranceCaseResponse => {
	const { assuranceCase, id, updatedItem, move } = options;

	if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
		return assuranceCase;
	}

	const goal = assuranceCase.goals[0];
	if (!goal) {
		return assuranceCase;
	}

	// Try updating in goal's direct property claims first
	const directClaims = goal.propertyClaims || [];
	const updatedDirectClaims = move
		? updateEvidenceNestedMove(
				directClaims,
				id,
				updatedItem as Partial<EvidenceResponse> & { propertyClaimId: string[] }
			)
		: updateEvidenceNested(directClaims, id, updatedItem);

	// Check if we found and updated in direct claims
	// Only check reference equality if directClaims has content, otherwise
	// the nested update returns a new empty array and the comparison is always true
	if (directClaims.length > 0 && updatedDirectClaims !== directClaims) {
		return {
			...assuranceCase,
			goals: [{ ...goal, propertyClaims: updatedDirectClaims }],
		};
	}

	// If not found in direct claims, search in strategies
	const strategies = goal.strategies || [];
	let foundInStrategies = false;
	const updatedStrategies = strategies.map((strategy) => {
		if (foundInStrategies) {
			return strategy;
		}
		const strategyClaims = strategy.propertyClaims || [];
		const updatedStrategyClaims = move
			? updateEvidenceNestedMove(
					strategyClaims,
					id,
					updatedItem as Partial<EvidenceResponse> & {
						propertyClaimId: string[];
					}
				)
			: updateEvidenceNested(strategyClaims, id, updatedItem);

		if (updatedStrategyClaims !== strategyClaims) {
			foundInStrategies = true;
			return { ...strategy, propertyClaims: updatedStrategyClaims };
		}
		return strategy;
	});

	if (foundInStrategies) {
		return {
			...assuranceCase,
			goals: [{ ...goal, strategies: updatedStrategies }],
		};
	}

	// Not found anywhere, return unchanged
	return assuranceCase;
};

/**
 * Updates an assurance case based on the provided type and item details.
 *
 * This function modifies the assurance case structure, including strategies,
 * property claims, and evidence. It returns the updated assurance case.
 *
 * Note: Context is now a string[] attribute on elements, not a separate element type.
 */
export const updateAssuranceCase = (
	type: string,
	assuranceCase: AssuranceCaseResponse,
	updatedItem:
		| Partial<GoalResponse>
		| Partial<StrategyResponse>
		| Partial<PropertyClaimResponse>
		| Partial<EvidenceResponse>,
	id: string,
	_node: ReactFlowNode,
	move = false
): AssuranceCaseResponse => {
	switch (type) {
		case "strategy":
			return updateStrategy(
				assuranceCase,
				id,
				updatedItem as Partial<StrategyResponse>
			);

		case "property":
			return updatePropertyClaim({
				assuranceCase,
				id,
				updatedItem: updatedItem as Partial<PropertyClaimResponse>,
				move,
			});

		case "evidence":
			return updateEvidence({
				assuranceCase,
				id,
				updatedItem: updatedItem as Partial<EvidenceResponse>,
				move,
			});

		default: {
			const defaultGoal = assuranceCase.goals?.[0];
			return {
				...assuranceCase,
				goals: defaultGoal
					? [
							{
								...defaultGoal,
								...updatedItem,
							} as GoalResponse,
						]
					: [],
			};
		}
	}
};
