/**
 * Assurance case utilities barrel file
 * Re-exports all modules for backward compatibility
 */

// API operations
// biome-ignore lint/performance/noBarrelFile: Barrel file intentional for backward compatibility during migration
export {
	addElementComment,
	attachCaseElement,
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	detachCaseElement,
	getAssuranceCaseNode,
	updateAssuranceCaseNode,
	updateElementComment,
} from "./api";
// Case update operations
export { updateAssuranceCase } from "./case-updates";
// Evidence operations
export {
	addEvidenceToClaim,
	updateEvidenceNested,
	updateEvidenceNestedMove,
} from "./evidence";
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
