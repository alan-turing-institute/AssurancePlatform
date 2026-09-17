/**
 * Assurance case utilities barrel file
 * Re-exports all modules for backward compatibility
 */

// API operations
export {
	attachCaseElement,
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	detachCaseElement,
	getNodeMutationErrorMessage,
	moveCaseElement,
	updateAssuranceCaseNode,
} from "./api";
// Evidence operations
export { addEvidenceToClaim } from "./evidence";
// Fetch + transform
export { fetchAndRefreshCase } from "./fetch-and-refresh-case";
// Node utilities
export { removeAssuranceCaseNode } from "./node-utils";
// Property claims operations
export { addPropertyClaimToNested } from "./property-claims";
// Tree utilities
export {
	addHiddenProp,
	findParentNode,
	findSiblingHiddenState,
	toggleHiddenForChildren,
	toggleHiddenForParent,
} from "./tree-utils";
// Types
export type { ReactFlowNode } from "./types";
