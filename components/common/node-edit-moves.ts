import type { ReactFlowNode } from "@/lib/case";
import {
	findSiblingHiddenState,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import type { AssuranceCase, Goal, PropertyClaim, Strategy } from "@/types";
import type {
	AssuranceCaseNode,
	MoveElement,
	UpdateItem,
} from "./node-edit-types";

type MoveHandlerArgs = {
	node: AssuranceCaseNode;
	assuranceCase: AssuranceCase;
	setAssuranceCase: (ac: AssuranceCase) => void;
	setLoading: (loading: boolean) => void;
	handleClose: () => void;
	sessionKey: string;
};

export const handleGoalMove = async (
	args: MoveHandlerArgs & {
		goal: Goal | undefined;
		selectedClaimMove: MoveElement;
	}
): Promise<void> => {
	const {
		node,
		goal,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedClaimMove,
		sessionKey,
	} = args;

	const updateItem: UpdateItem = {
		goal_id: goal ? goal.id : null,
		strategy_id: null,
		property_claim_id: null,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

export const handlePropertyClaimMove = async (
	args: MoveHandlerArgs & {
		claims: PropertyClaim[];
		selectedClaimMove: MoveElement;
	}
): Promise<void> => {
	const {
		node,
		claims,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedClaimMove,
		sessionKey,
	} = args;

	const elementId = claims?.find(
		(claim) => claim.id === selectedClaimMove.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: null,
		property_claim_id: elementId,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

export const handleStrategyMove = async (
	args: MoveHandlerArgs & {
		strategies: Strategy[];
		selectedClaimMove: MoveElement;
	}
): Promise<void> => {
	const {
		node,
		strategies,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedClaimMove,
		sessionKey,
	} = args;

	const elementId = strategies?.find(
		(strategy) => strategy.id === selectedClaimMove.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: elementId,
		property_claim_id: null,
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"property",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedClaimMove.id
		);
		const updatedAssuranceCase = await updateAssuranceCase(
			"property",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};

export const handleEvidenceMove = async (
	args: MoveHandlerArgs & {
		selectedEvidenceMove: MoveElement;
	}
): Promise<void> => {
	const {
		node,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedEvidenceMove,
		sessionKey,
	} = args;

	const updateItem: UpdateItem = {
		property_claim_id: [selectedEvidenceMove.id],
		hidden: false,
	};

	const updated = await updateAssuranceCaseNode(
		"evidence",
		node.data.id,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(
			assuranceCase,
			selectedEvidenceMove.id
		);
		const updatedAssuranceCase = updateAssuranceCase(
			"evidence",
			assuranceCase,
			updateItem,
			node.data.id,
			node as ReactFlowNode,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
		}
	}
};
