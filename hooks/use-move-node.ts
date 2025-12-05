"use client";

import {
	findSiblingHiddenState,
	type ReactFlowNode,
	updateAssuranceCase,
	updateAssuranceCaseNode,
} from "@/lib/case";
import type { AssuranceCase, Goal, PropertyClaim, Strategy } from "@/types";

/**
 * Types for move operations
 */
export type MoveElement = {
	id: number;
	name: string;
};

type UpdateItem = {
	goal_id?: number | null;
	strategy_id?: number | null;
	property_claim_id?: number | number[] | null;
	hidden?: boolean;
};

type MoveNodeOptions = {
	node: ReactFlowNode;
	assuranceCase: AssuranceCase;
	setAssuranceCase: (ac: AssuranceCase) => void;
	setLoading: (loading: boolean) => void;
	handleClose: () => void;
	sessionKey: string;
};

type MovePropertyClaimOptions = MoveNodeOptions & {
	selectedElement: MoveElement;
	goal?: Goal;
	strategies: Strategy[];
	claims: PropertyClaim[];
};

type MoveEvidenceOptions = MoveNodeOptions & {
	selectedElement: MoveElement;
};

type ExecuteMoveOptions = {
	nodeType: string;
	nodeId: number;
	sessionKey: string;
	updateItem: UpdateItem;
	assuranceCase: AssuranceCase;
	node: ReactFlowNode;
	setAssuranceCase: (ac: AssuranceCase) => void;
	setLoading: (loading: boolean) => void;
	handleClose: () => void;
	targetId: number;
};

/**
 * Determines the move target type from the element name prefix
 */
const getMoveTargetType = (name: string): "G" | "P" | "S" | null => {
	const prefix = name.substring(0, 1);
	if (prefix === "G" || prefix === "P" || prefix === "S") {
		return prefix;
	}
	return null;
};

/**
 * Core move operation that updates the backend and local state
 */
const executeMove = async (options: ExecuteMoveOptions): Promise<boolean> => {
	const {
		nodeType,
		nodeId,
		sessionKey,
		updateItem,
		assuranceCase,
		node,
		setAssuranceCase,
		setLoading,
		handleClose,
		targetId,
	} = options;

	const updated = await updateAssuranceCaseNode(
		nodeType,
		nodeId,
		sessionKey,
		updateItem
	);

	if (updated) {
		updateItem.hidden = findSiblingHiddenState(assuranceCase, targetId);
		const updatedAssuranceCase = await updateAssuranceCase(
			nodeType,
			assuranceCase,
			updateItem,
			nodeId,
			node,
			true
		);
		if (updatedAssuranceCase) {
			setAssuranceCase(updatedAssuranceCase);
			setLoading(false);
			handleClose();
			return true;
		}
	}
	return false;
};

/**
 * Move a property claim to a goal
 */
const movePropertyClaimToGoal = async (
	options: MovePropertyClaimOptions
): Promise<void> => {
	const {
		node,
		goal,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedElement,
		sessionKey,
	} = options;

	const updateItem: UpdateItem = {
		goal_id: goal ? goal.id : null,
		strategy_id: null,
		property_claim_id: null,
		hidden: false,
	};

	await executeMove({
		nodeType: "property",
		nodeId: node.data.id as number,
		sessionKey,
		updateItem,
		assuranceCase,
		node,
		setAssuranceCase,
		setLoading,
		handleClose,
		targetId: selectedElement.id,
	});
};

/**
 * Move a property claim to another property claim
 */
const movePropertyClaimToPropertyClaim = async (
	options: MovePropertyClaimOptions
): Promise<void> => {
	const {
		node,
		claims,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedElement,
		sessionKey,
	} = options;

	const elementId = claims?.find(
		(claim) => claim.id === selectedElement.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: null,
		property_claim_id: elementId,
		hidden: false,
	};

	await executeMove({
		nodeType: "property",
		nodeId: node.data.id as number,
		sessionKey,
		updateItem,
		assuranceCase,
		node,
		setAssuranceCase,
		setLoading,
		handleClose,
		targetId: selectedElement.id,
	});
};

/**
 * Move a property claim to a strategy
 */
const movePropertyClaimToStrategy = async (
	options: MovePropertyClaimOptions
): Promise<void> => {
	const {
		node,
		strategies,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedElement,
		sessionKey,
	} = options;

	const elementId = strategies?.find(
		(strategy) => strategy.id === selectedElement.id
	)?.id;

	const updateItem: UpdateItem = {
		goal_id: null,
		strategy_id: elementId,
		property_claim_id: null,
		hidden: false,
	};

	await executeMove({
		nodeType: "property",
		nodeId: node.data.id as number,
		sessionKey,
		updateItem,
		assuranceCase,
		node,
		setAssuranceCase,
		setLoading,
		handleClose,
		targetId: selectedElement.id,
	});
};

/**
 * Move an evidence element to a property claim
 */
export const moveEvidence = async (
	options: MoveEvidenceOptions
): Promise<void> => {
	const {
		node,
		assuranceCase,
		setAssuranceCase,
		setLoading,
		handleClose,
		selectedElement,
		sessionKey,
	} = options;

	const updateItem: UpdateItem = {
		property_claim_id: [selectedElement.id],
		hidden: false,
	};

	await executeMove({
		nodeType: "evidence",
		nodeId: node.data.id as number,
		sessionKey,
		updateItem,
		assuranceCase,
		node,
		setAssuranceCase,
		setLoading,
		handleClose,
		targetId: selectedElement.id,
	});
};

/**
 * Move a property claim based on target type (Goal, Strategy, or PropertyClaim)
 */
export const movePropertyClaim = async (
	options: MovePropertyClaimOptions
): Promise<void> => {
	const targetType = getMoveTargetType(options.selectedElement.name);

	switch (targetType) {
		case "G":
			await movePropertyClaimToGoal(options);
			break;
		case "P":
			await movePropertyClaimToPropertyClaim(options);
			break;
		case "S":
			await movePropertyClaimToStrategy(options);
			break;
		default:
			// No action for unknown types
			break;
	}
};
