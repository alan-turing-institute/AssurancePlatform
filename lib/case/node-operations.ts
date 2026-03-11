import {
	deleteAssuranceCaseNode,
	detachCaseElement,
	type ReactFlowNode,
	removeAssuranceCaseNode,
} from "@/lib/case";
import type {
	AssuranceCaseResponse,
	PropertyClaimResponse,
} from "@/lib/services/case-response-types";
import { recordDelete } from "@/lib/services/history-service";

/**
 * Type for orphan element data
 */
export type OrphanElementData = {
	id: string;
	type: string;
	name: string;
	description: string;
	propertyClaimId?: string | null;
};

type DeleteNodeOptions = {
	node: ReactFlowNode;
	assuranceCase: AssuranceCaseResponse;
	setAssuranceCase: (ac: AssuranceCaseResponse) => void;
	setLoading: (loading: boolean) => void;
	setDeleteOpen: (open: boolean) => void;
	handleClose: () => void;
	sessionKey: string;
};

type DetachNodeOptions = {
	node: ReactFlowNode;
	assuranceCase: AssuranceCaseResponse;
	setAssuranceCase: (ac: AssuranceCaseResponse) => void;
	setLoading: (loading: boolean) => void;
	setDeleteOpen: (open: boolean) => void;
	handleClose: () => void;
	orphanedElements: OrphanElementData[];
	setOrphanedElements: (elements: OrphanElementData[]) => void;
	sessionKey: string;
};

/**
 * Map of React Flow node types to canonical element types
 */
const TYPE_MAP: Record<string, string> = {
	property: "property_claim",
	strategy: "strategy",
	evidence: "evidence",
	context: "context",
	goal: "goal",
};

/**
 * Helper to create orphan element from evidence
 */
const createEvidenceOrphan = (
	ev: {
		id: string;
		name: string;
		description?: string;
	},
	parentClaimId: string
): OrphanElementData => ({
	id: ev.id,
	type: TYPE_MAP.evidence ?? "evidence",
	name: ev.name,
	description: ev.description ?? "",
	propertyClaimId: parentClaimId,
});

/**
 * Helper to collect all orphan elements from a property claim (including children)
 */
const collectOrphanElements = (
	claim: PropertyClaimResponse
): OrphanElementData[] => {
	const elements: OrphanElementData[] = [];

	// Add the claim itself
	elements.push({
		id: claim.id,
		type: TYPE_MAP.property ?? "property_claim",
		name: claim.name,
		description: claim.description ?? "",
		propertyClaimId: claim.propertyClaimId,
	});

	// Add evidence children
	const evidenceList = claim.evidence;
	if (evidenceList && Array.isArray(evidenceList)) {
		for (const ev of evidenceList) {
			elements.push(createEvidenceOrphan(ev, claim.id));
		}
	}

	// Recursively add nested property claims
	const nestedClaims = claim.propertyClaims;
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
		node.data.id as string,
		sessionKey
	);

	if (deleted && assuranceCase) {
		// Record delete operation for undo/redo
		recordDelete(node.data.id as string, node.type ?? "", node.data);

		const updatedAssuranceCase = await removeAssuranceCaseNode(
			assuranceCase,
			node.data.id as string,
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
		node.data.id as string,
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
			const claimData = node.data as unknown as PropertyClaimResponse;
			newOrphanElements = collectOrphanElements(claimData);
		} else {
			// For other types, just add the single element
			newOrphanElements = [
				{
					id: node.data.id as string,
					type: (TYPE_MAP[node.type ?? ""] ??
						(node.data.type as string)) as string,
					name: node.data.name as string,
					description: ((node.data.description as string) ?? "") as string,
				},
			];
		}

		const updatedAssuranceCase = removeAssuranceCaseNode(
			assuranceCase,
			node.data.id as string,
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
