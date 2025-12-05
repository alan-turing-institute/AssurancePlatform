"use client";

import {
	deleteAssuranceCaseNode,
	detachCaseElement,
	type ReactFlowNode,
	removeAssuranceCaseNode,
} from "@/lib/case";
import type { AssuranceCase, PropertyClaim } from "@/types";

/**
 * Type for orphan element data
 */
export type OrphanElementData = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	property_claim_id?: number | null;
};

type DeleteNodeOptions = {
	node: ReactFlowNode;
	assuranceCase: AssuranceCase;
	setAssuranceCase: (ac: AssuranceCase) => void;
	setLoading: (loading: boolean) => void;
	setDeleteOpen: (open: boolean) => void;
	handleClose: () => void;
	sessionKey: string;
};

type DetachNodeOptions = {
	node: ReactFlowNode;
	assuranceCase: AssuranceCase;
	setAssuranceCase: (ac: AssuranceCase) => void;
	setLoading: (loading: boolean) => void;
	setDeleteOpen: (open: boolean) => void;
	handleClose: () => void;
	orphanedElements: OrphanElementData[];
	setOrphanedElements: (elements: OrphanElementData[]) => void;
	sessionKey: string;
};

/**
 * Map of React Flow node types to orphan element types
 */
const TYPE_MAP: Record<string, string> = {
	property: "PropertyClaim",
	strategy: "Strategy",
	evidence: "Evidence",
	context: "Context",
	goal: "Goal",
};

/**
 * Helper to create orphan element from evidence
 */
const createEvidenceOrphan = (
	ev: {
		id: number;
		name: string;
		short_description?: string;
		long_description?: string;
	},
	parentClaimId: number
): OrphanElementData => ({
	id: ev.id,
	type: TYPE_MAP.evidence ?? "Evidence",
	name: ev.name,
	short_description: ev.short_description ?? "",
	long_description: ev.long_description ?? "",
	property_claim_id: parentClaimId,
});

/**
 * Helper to collect all orphan elements from a property claim (including children)
 */
const collectOrphanElements = (claim: PropertyClaim): OrphanElementData[] => {
	const elements: OrphanElementData[] = [];

	// Add the claim itself
	elements.push({
		id: claim.id,
		type: TYPE_MAP.property ?? "PropertyClaim",
		name: claim.name,
		short_description: claim.short_description ?? "",
		long_description: claim.long_description ?? "",
		property_claim_id: claim.property_claim_id,
	});

	// Add evidence children
	const evidenceList = claim.evidence;
	if (evidenceList && Array.isArray(evidenceList)) {
		for (const ev of evidenceList) {
			elements.push(createEvidenceOrphan(ev, claim.id));
		}
	}

	// Recursively add nested property claims
	const nestedClaims = claim.property_claims;
	if (nestedClaims && Array.isArray(nestedClaims)) {
		for (const nested of nestedClaims) {
			elements.push(...collectOrphanElements(nested));
		}
	}

	return elements;
};

/**
 * Delete a node from the assurance case
 */
export const deleteNode = async (options: DeleteNodeOptions): Promise<void> => {
	const {
		node,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		setDeleteOpen,
		handleClose,
		sessionKey,
	} = options;

	setLoading(true);
	const deleted = await deleteAssuranceCaseNode(
		node.type ?? "",
		node.data.id as number,
		sessionKey
	);

	if (deleted && assuranceCase) {
		const updatedAssuranceCase = await removeAssuranceCaseNode(
			assuranceCase,
			node.data.id as number,
			node.data.type as string
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			setDeleteOpen(false);
			handleClose();
		}
	}
};

/**
 * Detach a node from the assurance case (keeps it as orphan)
 */
export const detachNode = async (options: DetachNodeOptions): Promise<void> => {
	const {
		node,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		setDeleteOpen,
		handleClose,
		orphanedElements,
		setOrphanedElements,
		sessionKey,
	} = options;

	const result = await detachCaseElement(
		node,
		node.type ?? "",
		node.data.id as number,
		sessionKey
	);

	if ("error" in result) {
		// TODO: Handle error properly
		return;
	}

	if (result.detached && assuranceCase) {
		// Collect all orphan elements (parent and children)
		let newOrphanElements: OrphanElementData[] = [];

		if (node.type === "property" && node.data) {
			// For property claims, collect the claim and all its children
			const claimData = node.data as unknown as PropertyClaim;
			newOrphanElements = collectOrphanElements(claimData);
		} else {
			// For other types, just add the single element
			newOrphanElements = [
				{
					id: node.data.id as number,
					type: (TYPE_MAP[node.type ?? ""] ??
						(node.data.type as string)) as string,
					name: node.data.name as string,
					short_description: ((node.data.short_description as string) ??
						"") as string,
					long_description: ((node.data.long_description as string) ??
						"") as string,
				},
			];
		}

		const updatedAssuranceCase = removeAssuranceCaseNode(
			assuranceCase,
			node.data.id as number,
			node.data.type as string
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			// Add detached elements to orphanedElements so they appear immediately
			// Filter out duplicates to avoid React key warnings
			const existingIds = new Set(orphanedElements.map((el) => el.id));
			const uniqueNewOrphans = newOrphanElements.filter(
				(el) => !existingIds.has(el.id)
			);
			if (uniqueNewOrphans.length > 0) {
				setOrphanedElements([...orphanedElements, ...uniqueNewOrphans]);
			}
			setLoading(false);
			setDeleteOpen(false);
			handleClose();
		}
	}
};
