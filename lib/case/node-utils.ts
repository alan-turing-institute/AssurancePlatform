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
import type { NestedArrayItem } from "./types";

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

			// Remove from strategies, and from what hangs from them
			if ("strategies" in item && item.strategies) {
				(item as GoalResponse).strategies = removeItemFromNestedStructure(
					(item as GoalResponse).strategies as unknown as NestedArrayItem[],
					id,
					type
				) as unknown as StrategyResponse[];
			}

			// Remove from counter-goals, and from what supports them
			if ("goals" in item && item.goals) {
				(item as GoalResponse).goals = removeItemFromNestedStructure(
					(item as GoalResponse).goals as unknown as NestedArrayItem[],
					id,
					type
				) as unknown as GoalResponse[];
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
