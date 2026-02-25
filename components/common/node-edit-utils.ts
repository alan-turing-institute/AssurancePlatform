import type { AssuranceCase, PropertyClaim } from "@/types";
import type { AssuranceCaseNode } from "./node-edit-types";

/**
 * Recursively count property claim descendants (claims + their evidence).
 */
export const countPropertyClaimDescendants = (
	claimsList: PropertyClaim[] | undefined
): number => {
	if (!claimsList) {
		return 0;
	}
	let count = 0;
	for (const claim of claimsList) {
		count += 1;
		count += claim.evidence?.length ?? 0;
		count += countPropertyClaimDescendants(claim.property_claims);
	}
	return count;
};

/**
 * Count all descendants of the given node within the assurance case tree.
 */
export const countDescendants = (
	node: AssuranceCaseNode,
	assuranceCase: AssuranceCase | null
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pre-existing function with necessary branching logic
): number => {
	if (!node.data) {
		return 0;
	}

	let count = 0;

	if (node.type === "goal" && assuranceCase?.goals) {
		const goalData = assuranceCase.goals.find((g) => g.id === node.data.id);
		if (goalData) {
			count += goalData.strategies?.length ?? 0;
			count += goalData.property_claims?.length ?? 0;
			for (const strategy of goalData.strategies ?? []) {
				count += countPropertyClaimDescendants(strategy.property_claims);
			}
			count += countPropertyClaimDescendants(goalData.property_claims);
		}
	}

	if (node.type === "strategy" && assuranceCase?.goals) {
		const goalData = assuranceCase.goals[0];
		const strategyData = goalData?.strategies?.find(
			(s) => s.id === node.data.id
		);
		if (strategyData) {
			count += countPropertyClaimDescendants(strategyData.property_claims);
		}
	}

	if (node.type === "property") {
		const claimData = node.data as unknown as PropertyClaim;
		count += countPropertyClaimDescendants([claimData]) - 1;
	}

	return count;
};

/**
 * Get all descendant claim IDs for filtering move targets.
 */
export const getDescendantClaimIds = (
	claimList: PropertyClaim[] | undefined,
	targetId: number
): Set<number> => {
	const ids = new Set<number>();

	const collectDescendants = (
		descendantClaims: PropertyClaim[] | undefined
	): void => {
		if (!descendantClaims) {
			return;
		}
		for (const claim of descendantClaims) {
			ids.add(claim.id);
			collectDescendants(claim.property_claims);
		}
	};

	const findAndCollect = (
		searchClaims: PropertyClaim[] | undefined
	): boolean => {
		if (!searchClaims) {
			return false;
		}
		for (const claim of searchClaims) {
			if (claim.id === targetId) {
				collectDescendants(claim.property_claims);
				return true;
			}
			if (findAndCollect(claim.property_claims)) {
				return true;
			}
		}
		return false;
	};

	findAndCollect(claimList);
	return ids;
};

/**
 * Filter claims to exclude self and descendants for move operations.
 */
export const getValidMoveTargets = (
	allClaims: PropertyClaim[],
	currentNodeId: number
): PropertyClaim[] => {
	const descendantIds = getDescendantClaimIds(allClaims, currentNodeId);
	return allClaims.filter(
		(claim) => claim.id !== currentNodeId && !descendantIds.has(claim.id)
	);
};

/**
 * Helper to recursively collect property claim elements for history recording.
 */
export const collectPropertyClaimElements = (
	claimsList: PropertyClaim[] | undefined,
	elements: Array<{ id: number; type: string; data: Record<string, unknown> }>
): void => {
	if (!claimsList) {
		return;
	}
	for (const claim of claimsList) {
		elements.push({
			id: claim.id,
			type: "property",
			data: claim as unknown as Record<string, unknown>,
		});
		for (const ev of claim.evidence ?? []) {
			elements.push({
				id: ev.id,
				type: "evidence",
				data: ev as unknown as Record<string, unknown>,
			});
		}
		collectPropertyClaimElements(claim.property_claims, elements);
	}
};

/**
 * Collects element data for history recording before deletion.
 * Returns an array of elements (parent + all descendants) with their data.
 */
export const collectElementsForHistory = (
	node: AssuranceCaseNode,
	assuranceCase: AssuranceCase | null
): Array<{
	id: number;
	type: string;
	data: Record<string, unknown>;
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pre-existing function with necessary branching logic
}> => {
	const elements: Array<{
		id: number;
		type: string;
		data: Record<string, unknown>;
	}> = [];

	elements.push({
		id: node.data.id as number,
		type: node.type,
		data: node.data as Record<string, unknown>,
	});

	if (node.type === "goal" && assuranceCase?.goals) {
		const goalData = assuranceCase.goals.find((g) => g.id === node.data.id);
		if (goalData) {
			for (const strategy of goalData.strategies ?? []) {
				elements.push({
					id: strategy.id,
					type: "strategy",
					data: strategy as unknown as Record<string, unknown>,
				});
				collectPropertyClaimElements(strategy.property_claims, elements);
			}
			collectPropertyClaimElements(goalData.property_claims, elements);
		}
	}

	if (node.type === "strategy" && assuranceCase?.goals) {
		const goalData = assuranceCase.goals[0];
		const strategyData = goalData?.strategies?.find(
			(s) => s.id === node.data.id
		);
		if (strategyData) {
			collectPropertyClaimElements(strategyData.property_claims, elements);
		}
	}

	if (node.type === "property") {
		const claimData = node.data as unknown as PropertyClaim;
		collectPropertyClaimElements(claimData.property_claims, elements);
		for (const ev of claimData.evidence ?? []) {
			elements.push({
				id: ev.id,
				type: "evidence",
				data: ev as unknown as Record<string, unknown>,
			});
		}
	}

	return elements;
};

/**
 * Type for orphan element data used during detach operations.
 */
export type OrphanElementData = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	property_claim_id?: number | null;
};

/**
 * Helper to create orphan element from evidence.
 */
export const createEvidenceOrphan = (
	ev: {
		id: number;
		name: string;
		short_description?: string;
		long_description?: string;
	},
	parentClaimId: number,
	typeMap: Record<string, string>
): OrphanElementData => ({
	id: ev.id,
	type: typeMap.evidence ?? "Evidence",
	name: ev.name,
	short_description: ev.short_description ?? "",
	long_description: ev.long_description ?? "",
	property_claim_id: parentClaimId,
});

/**
 * Helper to collect all orphan elements from a property claim (including children).
 */
export const collectOrphanElements = (
	claim: PropertyClaim,
	typeMap: Record<string, string>
): OrphanElementData[] => {
	const orphanElements: OrphanElementData[] = [];

	orphanElements.push({
		id: claim.id,
		type: typeMap.property ?? "PropertyClaim",
		name: claim.name,
		short_description: claim.short_description ?? "",
		long_description: claim.long_description ?? "",
		property_claim_id: claim.property_claim_id,
	});

	const evidenceList = claim.evidence;
	if (evidenceList && Array.isArray(evidenceList)) {
		for (const ev of evidenceList) {
			orphanElements.push(createEvidenceOrphan(ev, claim.id, typeMap));
		}
	}

	const nestedClaims = claim.property_claims;
	if (nestedClaims && Array.isArray(nestedClaims)) {
		for (const nested of nestedClaims) {
			orphanElements.push(...collectOrphanElements(nested, typeMap));
		}
	}

	return orphanElements;
};

/**
 * Map React Flow node type to orphan element type string.
 */
export const NODE_TYPE_MAP: Record<string, string> = {
	property: "PropertyClaim",
	strategy: "Strategy",
	evidence: "Evidence",
	context: "Context",
	goal: "Goal",
};
