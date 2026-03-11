/**
 * Assurance case utilities barrel file
 * Re-exports all modules for backward compatibility
 */

// API operations
export {
	addElementComment,
	attachCaseElement,
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	detachCaseElement,
	getAssuranceCaseNode,
	moveCaseElement,
	updateAssuranceCaseNode,
	updateElementComment,
} from "./api";
// Case update operations
export { updateAssuranceCase } from "./case-updates";
// Convert case utilities
export type { AssuranceCaseWithGoals, ConvertibleItem } from "./convert-case";
export {
	convertAssuranceCase,
	createEdgesFromNodes,
	createNodesRecursively,
} from "./convert-case";
// Evidence operations
export {
	addEvidenceToClaim,
	updateEvidenceNested,
	updateEvidenceNestedMove,
} from "./evidence";
// Fetch + transform
export { fetchAndRefreshCase } from "./fetch-and-refresh-case";
// Identifier utilities
export { compareIdentifiers, parseIdentifier } from "./identifier-utils";
// Layout helper
export { getLayoutedElements } from "./layout-helper";
// Node operations
export type { OrphanElementData } from "./node-operations";
export { deleteNode, detachNode } from "./node-operations";
// Node utilities
export {
	caseItemDescription,
	extractGoalsClaimsStrategies,
	findItemById,
	removeAssuranceCaseNode,
	setNodeIdentifier,
} from "./node-utils";
// Property claims operations
export {
	addPropertyClaimToNested,
	listPropertyClaims,
	updatePropertyClaimNested,
	updatePropertyClaimNestedMove,
} from "./property-claims";
// Tree utilities
export {
	addHiddenProp,
	findElementById,
	findParentNode,
	findSiblingHiddenState,
	getChildrenHiddenStatus,
	searchWithDeepFirst,
	toggleHiddenForChildren,
	toggleHiddenForParent,
} from "./tree-utils";
// Types
export type { CaseNode, NestedArrayItem, ReactFlowNode } from "./types";
