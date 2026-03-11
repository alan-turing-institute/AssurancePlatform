/**
 * Tree traversal and visibility utilities for assurance cases
 * Handles hidden state management and tree navigation
 */

import type {
	AssuranceCaseResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";
import type { CaseNode, NestedArrayItem, ReactFlowNode } from "./types";

/**
 * Gets the adjacent nodes for a given case node based on its type.
 */
const getAdjacent = (caseNode: CaseNode): CaseNode[] => {
	if (caseNode.type === "AssuranceCase") {
		return (caseNode.goals || []) as unknown as CaseNode[];
	}
	if (caseNode.type === "goal") {
		return ((caseNode.context || []) as unknown as CaseNode[]).concat(
			(caseNode.propertyClaims || []) as unknown as CaseNode[],
			(caseNode.strategies || []) as unknown as CaseNode[],
			(caseNode.context || []) as unknown as CaseNode[]
		);
	}
	if (caseNode.type === "strategy") {
		return (caseNode.propertyClaims || []) as unknown as CaseNode[];
	}
	if (caseNode.type === "property_claim") {
		return ((caseNode.propertyClaims || []) as unknown as CaseNode[]).concat(
			(caseNode.evidence || []) as unknown as CaseNode[]
		);
	}

	return [];
};

/**
 * Searches for a target node within an assurance case using a depth-first search algorithm.
 */
export function searchWithDeepFirst(
	targetNode: CaseNode,
	assuranceCase: CaseNode
): [CaseNode | null, Record<string, CaseNode>] {
	const visitedNodes: CaseNode[] = [];
	const parentMap: Record<string, CaseNode> = {};
	let nodesToProcess: CaseNode[] = [assuranceCase];
	let nodeFound: CaseNode | null = null;

	while (nodesToProcess.length > 0) {
		const currentNode: CaseNode | undefined = nodesToProcess.shift();
		if (currentNode === undefined) {
			return [null, {}];
		}

		if (currentNode.id === targetNode.id) {
			visitedNodes.push(currentNode);
			nodeFound = currentNode;
			break;
		}
		visitedNodes.push(currentNode);
		const adjacentNodes = getAdjacent(currentNode);

		for (const node of adjacentNodes) {
			parentMap[node.id] = currentNode;
		}

		nodesToProcess = nodesToProcess.concat(adjacentNodes);
	}

	return [nodeFound, parentMap];
}

/**
 * Recursively adds a `hidden` property to each node in an assurance case structure.
 */
export const addHiddenProp = (
	assuranceCase: AssuranceCaseResponse | NestedArrayItem | NestedArrayItem[]
): AssuranceCaseResponse | NestedArrayItem | NestedArrayItem[] => {
	if (Array.isArray(assuranceCase)) {
		for (const item of assuranceCase) {
			addHiddenProp(item);
		}
	} else if (typeof assuranceCase === "object" && assuranceCase !== null) {
		// Add the hidden property to the object
		(assuranceCase as unknown as Record<string, unknown>).hidden = false;

		for (const key of Object.keys(assuranceCase)) {
			const value = (assuranceCase as unknown as Record<string, unknown>)[key];
			if (value && (typeof value === "object" || Array.isArray(value))) {
				addHiddenProp(
					value as unknown as
						| NestedArrayItem
						| AssuranceCaseResponse
						| NestedArrayItem[]
				);
			}
		}
	}
	return assuranceCase;
};

/**
 * Toggles the visibility of a node and its parent nodes in the assurance case.
 */
export function toggleHiddenForParent(
	node: ReactFlowNode,
	assuranceCase: AssuranceCaseResponse
): AssuranceCaseResponse {
	const newAssuranceCase = JSON.parse(
		JSON.stringify(assuranceCase)
	) as AssuranceCaseResponse;
	const [nodeFound, parentMap] = searchWithDeepFirst(
		node.data as unknown as CaseNode,
		newAssuranceCase as unknown as CaseNode
	);

	let currentNode: CaseNode | null = nodeFound;
	const nodesToShow: CaseNode[] = [];
	while (currentNode != null) {
		nodesToShow.push(currentNode);
		currentNode = parentMap[currentNode.id] ?? null;
	}

	for (const nodeToShow of nodesToShow) {
		nodeToShow.hidden = false;
	}

	return newAssuranceCase;
}

// Options for toggle children processing
type ToggleChildrenOptions = {
	targetParentId: string;
	parentFound: boolean;
	hide: boolean;
	toggleChildren: (
		item: unknown,
		targetId: string,
		isParentFound: boolean,
		shouldHide: boolean
	) => void;
};

// Helper function to handle array processing
const processArray = (arr: unknown[], options: ToggleChildrenOptions): void => {
	const { targetParentId, parentFound, hide, toggleChildren } = options;
	for (const item of arr) {
		toggleChildren(item, targetParentId, parentFound, hide);
	}
};

// Helper function to handle parent node
const handleParentNode = (
	node: CaseNode,
	targetParentId: string
): { parentFound: boolean; hide: boolean } => {
	if (node.id === targetParentId) {
		const hide = !node.childrenHidden; // Toggle childrenHidden for the parent
		node.childrenHidden = hide; // Track the state of children visibility
		return { parentFound: true, hide };
	}
	return { parentFound: false, hide: false };
};

// Helper function to handle child visibility
const handleChildVisibility = (
	node: CaseNode,
	hide: boolean,
	isChild: boolean
): void => {
	if (!isChild) {
		return;
	}

	if (hide) {
		if (node.originalHidden === undefined) {
			node.originalHidden = !!node.hidden; // Record the original hidden state
		}
		node.hidden = true; // Force hidden
	} else if (node.originalHidden !== undefined) {
		node.hidden = node.originalHidden; // Reset to original hidden state
		node.originalHidden = undefined; // Clean up originalHidden property
	} else {
		node.hidden = false; // If no original hidden state, set to visible
	}
};

// Helper function to process object properties
const processObjectProperties = (
	obj: Record<string, unknown>,
	options: ToggleChildrenOptions
): void => {
	const { targetParentId, parentFound, hide, toggleChildren } = options;
	for (const key of Object.keys(obj)) {
		toggleChildren(obj[key], targetParentId, parentFound, hide);
	}
};

/**
 * Toggles the visibility of all children nodes of a specified parent node in the assurance case.
 */
export function toggleHiddenForChildren(
	assuranceCase: AssuranceCaseResponse,
	parentId: string
): AssuranceCaseResponse {
	function toggleChildren(
		obj: unknown,
		targetParentId: string,
		parentFound: boolean,
		hide: boolean
	): void {
		if (Array.isArray(obj)) {
			processArray(obj, { targetParentId, parentFound, hide, toggleChildren });
			return;
		}

		if (typeof obj !== "object" || obj === null) {
			return;
		}

		const node = obj as CaseNode;
		let newParentFound = parentFound;
		let newHide = hide;

		// Check if current object is the parent or one of its descendants
		const isParentOrDescendant = parentFound || node.id === targetParentId;

		// Reset childrenHidden if it's a descendant and not the direct parent
		if (
			isParentOrDescendant &&
			node.id !== targetParentId &&
			"childrenHidden" in node
		) {
			node.childrenHidden = false;
		}

		// Handle parent node
		const parentResult = handleParentNode(node, targetParentId);
		if (parentResult.parentFound) {
			newParentFound = true;
			newHide = parentResult.hide;
		}

		// Handle child visibility
		const isChild = newParentFound && node.id !== targetParentId;
		handleChildVisibility(node, newHide, isChild);

		// Process object properties
		processObjectProperties(obj as Record<string, unknown>, {
			targetParentId,
			parentFound: newParentFound,
			hide: newHide,
			toggleChildren,
		});
	}

	// Create a deep copy of the assuranceCase to ensure immutability
	const newAssuranceCase = JSON.parse(
		JSON.stringify(assuranceCase)
	) as AssuranceCaseResponse;

	// Toggle hidden property for the children
	toggleChildren(newAssuranceCase, parentId, false, false);

	return newAssuranceCase;
}

// Helper to get children array by key from element
const getChildrenByKey = (
	element: NestedArrayItem | AssuranceCaseResponse,
	key: string
): unknown[] | undefined => {
	switch (key) {
		case "goals":
			return "goals" in element
				? (element as AssuranceCaseResponse).goals
				: undefined;
		case "context":
			return "context" in element
				? (element as GoalResponse).context
				: undefined;
		case "propertyClaims":
			return "propertyClaims" in element
				? (element as GoalResponse | PropertyClaimResponse | StrategyResponse)
						.propertyClaims
				: undefined;
		case "strategies":
			return "strategies" in element
				? (element as GoalResponse | PropertyClaimResponse).strategies
				: undefined;
		case "evidence":
			return "evidence" in element
				? (element as PropertyClaimResponse).evidence
				: undefined;
		case "comments":
			return "comments" in element
				? (element as AssuranceCaseResponse).comments
				: undefined;
		default:
			return;
	}
};

// Type for the search element function
type SearchElementFunction = (
	el: NestedArrayItem | AssuranceCaseResponse,
	id: string
) => NestedArrayItem | AssuranceCaseResponse | null;

// Helper function to search within children array
const searchInChildrenArray = (
	children: unknown[],
	targetId: string,
	searchElement: SearchElementFunction
): NestedArrayItem | AssuranceCaseResponse | null => {
	for (const child of children) {
		if (child && typeof child === "object" && "id" in child) {
			const result = searchElement(
				child as NestedArrayItem | AssuranceCaseResponse,
				targetId
			);
			if (result) {
				return result;
			}
		}
	}
	return null;
};

// Helper function to search in child elements
const searchInChildElements = (
	element: NestedArrayItem | AssuranceCaseResponse,
	targetId: string,
	childrenKeys: string[],
	searchElement: SearchElementFunction
): NestedArrayItem | AssuranceCaseResponse | null => {
	for (const key of childrenKeys) {
		const children = getChildrenByKey(element, key);
		if (children) {
			const result = searchInChildrenArray(children, targetId, searchElement);
			if (result) {
				return result;
			}
		}
	}
	return null;
};

/**
 * Finds an element within an assurance case by its unique ID.
 */
export function findElementById(
	assuranceCase: AssuranceCaseResponse,
	id: string
): NestedArrayItem | AssuranceCaseResponse | null {
	// Recursive function to search for the element with the given ID
	function searchElement(
		element: NestedArrayItem | AssuranceCaseResponse,
		targetId: string
	): NestedArrayItem | AssuranceCaseResponse | null {
		if (element.id === targetId) {
			return element;
		}

		const childrenKeys = [
			"goals",
			"context",
			"propertyClaims",
			"strategies",
			"evidence",
			"comments",
		];

		return searchInChildElements(
			element,
			targetId,
			childrenKeys,
			searchElement
		);
	}

	return searchElement(assuranceCase, id);
}

/**
 * Helper to process children and collect hidden status
 */
const processChildrenForHiddenStatus = (
	children: unknown[],
	key: string,
	hiddenStatus: boolean[]
): void => {
	for (const child of children) {
		if (child && typeof child === "object" && "hidden" in child) {
			hiddenStatus.push((child as { hidden: boolean }).hidden);
		}
		// Recursively check nested property claims and strategies
		if (key === "propertyClaims" || key === "strategies") {
			const nestedStatus = getChildrenHiddenStatus(
				child as NestedArrayItem | AssuranceCaseResponse
			);
			hiddenStatus.push(...nestedStatus);
		}
	}
};

/**
 * Retrieves the hidden status of all child elements of a specified element.
 */
export function getChildrenHiddenStatus(
	element: NestedArrayItem | AssuranceCaseResponse
): boolean[] {
	const hiddenStatus: boolean[] = [];
	const childrenKeys = [
		"context",
		"propertyClaims",
		"strategies",
		"evidence",
		"comments",
	];

	for (const key of childrenKeys) {
		const children = getChildrenByKey(element, key);
		if (children) {
			processChildrenForHiddenStatus(children, key, hiddenStatus);
		}
	}
	return hiddenStatus;
}

/**
 * Finds the hidden state of a sibling element by checking the parent node's hidden status.
 */
export const findSiblingHiddenState = (
	assuranceCase: AssuranceCaseResponse,
	parentId: string
): boolean | undefined => {
	const element = findElementById(assuranceCase, parentId);
	if (element) {
		const hiddenStatus = getChildrenHiddenStatus(element);

		if (hiddenStatus.length === 0) {
			// then get parents hidden value
			return "hidden" in element ? (element as NestedArrayItem).hidden : false;
		}
		return hiddenStatus[0] ?? false;
	}
	return;
};

/**
 * Finds the parent node of a given node within a collection of nodes.
 */
export const findParentNode = (
	nodes: ReactFlowNode[],
	node: ReactFlowNode
): ReactFlowNode | null => {
	if (node.data.goalId) {
		// search for goal
		const parent = nodes.find(
			(n: ReactFlowNode) => n.data.id === node.data.goalId
		);
		return parent ?? null;
	}
	if (node.data.propertyClaimId) {
		if (node.type === "evidence") {
			const parent = nodes.find(
				(n: ReactFlowNode) =>
					n.data.id === (node.data.propertyClaimId as string[])[0]
			);
			return parent ?? null;
		}
		// search for property claim
		const parent = nodes.find(
			(n: ReactFlowNode) => n.data.id === node.data.propertyClaimId
		);
		return parent ?? null;
	}
	if (node.data.strategyId) {
		// search for strategy
		const parent = nodes.find(
			(n: ReactFlowNode) => n.data.id === node.data.strategyId
		);
		return parent ?? null;
	}
	return null;
};
