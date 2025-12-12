/**
 * Nodes Index
 *
 * Central export point for all node components.
 *
 * @module nodes
 */

// Attribute Badges (TypeScript)
export {
	AssumptionBadge,
	AttributesSection,
	ContextBadge,
	JustificationBadge,
	MetadataSection,
	PriorityBadge,
	StatusBadge,
	StrengthBadge,
} from "./attribute-badges";
// Base Node Components (TypeScript)
export {
	BaseNodeWithActions,
	BaseNodeWithMetadata,
	CompactBaseNode,
	default as BaseNode,
	LargeBaseNode,
} from "./base-node";
// Collapsible Node Components (TypeScript)
export {
	ControlledCollapsibleNode,
	default as CollapsibleNode,
	FocusCollapsibleNode,
	MemoizedCollapsibleNode,
	ProgressiveCollapsibleNode,
} from "./collapsible-node";
// Context Node Components (TypeScript)
export {
	AssumptionContextNode,
	CompactContextNode,
	ConstraintContextNode,
	CriticalContextNode,
	default as ContextNode,
	JustificationContextNode,
} from "./context-node";
// Evidence Node Components (TypeScript)
export {
	CompactEvidenceNode,
	DocumentEvidenceNode,
	default as EvidenceNode,
	HighConfidenceEvidenceNode,
	TestEvidenceNode,
} from "./evidence-node";
// Goal Node Components (TypeScript)
export {
	CompactGoalNode,
	default as GoalNode,
	LargeGoalNode,
} from "./goal-node";
// Node State Manager (TypeScript)
export {
	default as NodeStateManager,
	NodeStateControls,
	useNodeStateContext,
	useNodeStateWithFlow,
	withNodeState,
} from "./node-state-manager";
// Node Types (TypeScript)
export {
	createNode,
	createNodeData,
	getAvailableNodeTypes,
	getNodeComponent,
	getNodeTypeMetadata,
	getNodeTypesByCategory,
	getValidChildren,
	isValidConnection,
	isValidNodeType,
	nodeTypeMetadata,
	nodeTypes,
	validChildrenMap,
} from "./node-types";

// Property Claim Node Components (TypeScript)
export {
	CompactPropertyClaimNode,
	default as PropertyClaimNode,
	PendingPropertyClaimNode,
	VerifiedPropertyClaimNode,
} from "./property-claim-node";
// Strategy Node Components (TypeScript)
export {
	AlternativeStrategyNode,
	CompactStrategyNode,
	DecompositionStrategyNode,
	default as StrategyNode,
} from "./strategy-node";
// Node State Hook (TypeScript)
export { default as useNodeState } from "./use-node-state";
