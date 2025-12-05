/**
 * Assurance case update operations
 * Handles updating case elements (goals, contexts, strategies, property claims, evidence)
 */

import type {
	AssuranceCase,
	Evidence,
	Goal,
	PropertyClaim,
	Strategy,
} from "@/types";
import { updateEvidenceNested, updateEvidenceNestedMove } from "./evidence";
import {
	updatePropertyClaimNested,
	updatePropertyClaimNestedMove,
} from "./property-claims";
import type { ReactFlowNode } from "./types";

// Note: updateContext function removed - context is now a string[] attribute, not an element type

// Helper function to update strategy
const updateStrategy = (
	assuranceCase: AssuranceCase,
	id: number,
	updatedItem: Partial<Strategy>
): AssuranceCase => {
	const newStrategy = (assuranceCase.goals?.[0]?.strategies || []).map(
		(strategy: Strategy) => {
			if (strategy.id === id && strategy.type === "Strategy") {
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

// Options type for updatePropertyClaim helper
type UpdatePropertyClaimOptions = {
	assuranceCase: AssuranceCase;
	id: number;
	updatedItem: Partial<PropertyClaim>;
	move: boolean;
};

// Helper function to update property claim
const updatePropertyClaim = (
	options: UpdatePropertyClaimOptions
): AssuranceCase => {
	const { assuranceCase, id, updatedItem, move } = options;

	if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
		return assuranceCase;
	}

	const goal = assuranceCase.goals[0];

	// Try updating in goal's direct property claims first
	const directClaims = goal.property_claims || [];
	const updatedDirectClaims = move
		? updatePropertyClaimNestedMove(
				directClaims,
				id,
				updatedItem as Partial<PropertyClaim> & { property_claim_id?: number }
			)
		: updatePropertyClaimNested(directClaims, id, updatedItem);

	// Check if we found and updated in direct claims
	// Only check reference equality if directClaims has content, otherwise
	// the nested update returns a new empty array and the comparison is always true
	if (directClaims.length > 0 && updatedDirectClaims !== directClaims) {
		return {
			...assuranceCase,
			goals: [{ ...goal, property_claims: updatedDirectClaims }],
		};
	}

	// If not found in direct claims, search in strategies
	const strategies = goal.strategies || [];
	let foundInStrategies = false;
	const updatedStrategies = strategies.map((strategy) => {
		if (foundInStrategies) {
			return strategy;
		}
		const strategyClaims = strategy.property_claims || [];
		const updatedStrategyClaims = move
			? updatePropertyClaimNestedMove(
					strategyClaims,
					id,
					updatedItem as Partial<PropertyClaim> & { property_claim_id?: number }
				)
			: updatePropertyClaimNested(strategyClaims, id, updatedItem);

		if (updatedStrategyClaims !== strategyClaims) {
			foundInStrategies = true;
			return { ...strategy, property_claims: updatedStrategyClaims };
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
type UpdateEvidenceOptions = {
	assuranceCase: AssuranceCase;
	id: number;
	updatedItem: Partial<Evidence>;
	move: boolean;
};

// Helper function to update evidence
const updateEvidence = (options: UpdateEvidenceOptions): AssuranceCase => {
	const { assuranceCase, id, updatedItem, move } = options;

	if (!assuranceCase.goals || assuranceCase.goals.length === 0) {
		return assuranceCase;
	}

	const goal = assuranceCase.goals[0];

	// Try updating in goal's direct property claims first
	const directClaims = goal.property_claims || [];
	const updatedDirectClaims = move
		? updateEvidenceNestedMove(
				directClaims,
				id,
				updatedItem as Partial<Evidence> & { property_claim_id: number[] }
			)
		: updateEvidenceNested(directClaims, id, updatedItem);

	// Check if we found and updated in direct claims
	// Only check reference equality if directClaims has content, otherwise
	// the nested update returns a new empty array and the comparison is always true
	if (directClaims.length > 0 && updatedDirectClaims !== directClaims) {
		return {
			...assuranceCase,
			goals: [{ ...goal, property_claims: updatedDirectClaims }],
		};
	}

	// If not found in direct claims, search in strategies
	const strategies = goal.strategies || [];
	let foundInStrategies = false;
	const updatedStrategies = strategies.map((strategy) => {
		if (foundInStrategies) {
			return strategy;
		}
		const strategyClaims = strategy.property_claims || [];
		const updatedStrategyClaims = move
			? updateEvidenceNestedMove(
					strategyClaims,
					id,
					updatedItem as Partial<Evidence> & { property_claim_id: number[] }
				)
			: updateEvidenceNested(strategyClaims, id, updatedItem);

		if (updatedStrategyClaims !== strategyClaims) {
			foundInStrategies = true;
			return { ...strategy, property_claims: updatedStrategyClaims };
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
// biome-ignore lint/nursery/useMaxParams: Pre-existing function used across codebase, refactoring deferred
export const updateAssuranceCase = (
	type: string,
	assuranceCase: AssuranceCase,
	updatedItem:
		| Partial<Goal>
		| Partial<Strategy>
		| Partial<PropertyClaim>
		| Partial<Evidence>,
	id: number,
	_node: ReactFlowNode,
	move = false
): AssuranceCase => {
	switch (type) {
		case "strategy":
			return updateStrategy(
				assuranceCase,
				id,
				updatedItem as Partial<Strategy>
			);

		case "property":
			return updatePropertyClaim({
				assuranceCase,
				id,
				updatedItem: updatedItem as Partial<PropertyClaim>,
				move,
			});

		case "evidence":
			return updateEvidence({
				assuranceCase,
				id,
				updatedItem: updatedItem as Partial<Evidence>,
				move,
			});

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
