"use client";
/**
 * React Flow Node Type Mappings
 *
 * Maps node type identifiers to their corresponding React components.
 *
 * @module node-types
 */

import type { NodeProps } from "reactflow";
import BaseNode from "./base-node";

// ========================================================================
// Type Definitions
// ========================================================================

export type NodeTypeId = "goal" | "strategy" | "propertyClaim" | "evidence";

type NodeCategory = "Primary" | "Supporting";

type NodeTypeMetadataItem = {
	id: NodeTypeId;
	name: string;
	description: string;
	category: NodeCategory;
	color: string;
	icon: string;
	shortcut: string;
	validChildren: NodeTypeId[];
};

type NodeDefaults = {
	name: string;
	description: string;
	[key: string]: unknown;
};

type ReactFlowNode = {
	id: string;
	type: string;
	position: { x: number; y: number };
	data: Record<string, unknown>;
};

// ========================================================================
// Regex Patterns (module top-level)
// ========================================================================

const NORMALIZE_TYPE_REGEX = /[-_\s]/g;

// ========================================================================
// Wrapper Components
// ========================================================================

const GoalNodeWrapper = (props: NodeProps) => (
	<BaseNode {...props} nodeType="goal" />
);
const StrategyNodeWrapper = (props: NodeProps) => (
	<BaseNode {...props} nodeType="strategy" />
);
const PropertyClaimNodeWrapper = (props: NodeProps) => (
	<BaseNode {...props} nodeType="propertyClaim" />
);
const EvidenceNodeWrapper = (props: NodeProps) => (
	<BaseNode {...props} nodeType="evidence" />
);

// ========================================================================
// Node Type Mapping
// ========================================================================

/**
 * React Flow node type mapping
 */
export const nodeTypes = {
	// Primary node types
	goal: GoalNodeWrapper,
	strategy: StrategyNodeWrapper,
	propertyClaim: PropertyClaimNodeWrapper,
	evidence: EvidenceNodeWrapper,

	// Aliases for backward compatibility
	claim: PropertyClaimNodeWrapper,
	Goal: GoalNodeWrapper,
	Strategy: StrategyNodeWrapper,
	PropertyClaim: PropertyClaimNodeWrapper,
	Evidence: EvidenceNodeWrapper,
};

// ========================================================================
// Utility Functions
// ========================================================================

const normalizeType = (nodeType: string | undefined): string =>
	nodeType?.toLowerCase().replace(NORMALIZE_TYPE_REGEX, "") ?? "";

const resolveTypeKey = (normalizedType: string): NodeTypeId => {
	if (normalizedType === "claim") {
		return "propertyClaim";
	}
	return (normalizedType as NodeTypeId) || "goal";
};

/**
 * Get the React component for a given node type
 */
export const getNodeComponent = (
	nodeType: string | undefined
): React.ComponentType<NodeProps> => {
	const normalizedType = normalizeType(nodeType);

	const typeMap: Record<string, React.ComponentType<NodeProps>> = {
		goal: GoalNodeWrapper,
		strategy: StrategyNodeWrapper,
		propertyclaim: PropertyClaimNodeWrapper,
		claim: PropertyClaimNodeWrapper,
		evidence: EvidenceNodeWrapper,
	};

	return typeMap[normalizedType] ?? GoalNodeWrapper;
};

/**
 * Get all available node type identifiers
 */
export const getAvailableNodeTypes = (): NodeTypeId[] => [
	"goal",
	"strategy",
	"propertyClaim",
	"evidence",
];

/**
 * Check if a node type is valid
 */
export const isValidNodeType = (nodeType: string | undefined): boolean => {
	const normalizedType = normalizeType(nodeType);
	const validTypes = ["goal", "strategy", "propertyclaim", "claim", "evidence"];
	return validTypes.includes(normalizedType);
};

// ========================================================================
// Node Data Creation
// ========================================================================

const nodeDefaults: Record<NodeTypeId, NodeDefaults> = {
	goal: {
		name: "New Goal",
		description: "Goal description",
		importance: "medium",
		progress: 0,
		subGoalsCount: 0,
		isRoot: false,
	},
	strategy: {
		name: "New Strategy",
		description: "Strategy description",
		strategyType: "AND",
		approach: "decomposition",
		pathCount: 0,
	},
	propertyClaim: {
		name: "New Claim",
		description: "Claim description",
		strength: "moderate",
		verificationStatus: "pending",
		linkedEvidenceCount: 0,
	},
	evidence: {
		name: "New Evidence",
		description: "Evidence description",
		evidenceType: "document",
		confidence: 75,
		quality: "medium",
	},
};

/**
 * Create a node data object with default values
 */
export const createNodeData = (
	nodeType: string | undefined,
	customData: Record<string, unknown> = {}
): Record<string, unknown> => {
	const normalizedType = normalizeType(nodeType);
	const typeKey = resolveTypeKey(normalizedType);
	const defaults = nodeDefaults[typeKey] ?? nodeDefaults.goal;

	return {
		...defaults,
		...customData,
	};
};

/**
 * Create a complete React Flow node object
 */
export const createNode = (
	id: string,
	nodeType: string,
	position: { x: number; y: number },
	customData: Record<string, unknown> = {}
): ReactFlowNode => ({
	id,
	type: nodeType,
	position,
	data: createNodeData(nodeType, { id, ...customData }),
});

// ========================================================================
// Connection Validation
// ========================================================================

/**
 * Valid children mapping for GSN (Goal Structuring Notation)
 */
export const validChildrenMap: Record<NodeTypeId, NodeTypeId[]> = {
	goal: ["strategy", "propertyClaim"],
	strategy: ["propertyClaim", "strategy", "evidence"],
	propertyClaim: ["propertyClaim", "strategy", "evidence"],
	evidence: [],
};

/**
 * Check if a connection between two node types is valid
 */
export const isValidConnection = (
	sourceType: string | undefined,
	targetType: string | undefined
): boolean => {
	const normalizedSource = normalizeType(sourceType);
	const normalizedTarget = normalizeType(targetType);

	const sourceKey = resolveTypeKey(normalizedSource);
	const targetKey = resolveTypeKey(normalizedTarget);

	const validChildren = validChildrenMap[sourceKey] ?? [];
	return validChildren.includes(targetKey);
};

/**
 * Get valid child types for a parent node
 */
export const getValidChildren = (
	parentType: string | undefined
): NodeTypeId[] => {
	const normalizedType = normalizeType(parentType);
	const typeKey = resolveTypeKey(normalizedType);
	return validChildrenMap[typeKey] ?? [];
};

// ========================================================================
// Node Type Metadata
// ========================================================================

export const nodeTypeMetadata: Record<NodeTypeId, NodeTypeMetadataItem> = {
	goal: {
		id: "goal",
		name: "Goal",
		description: "Top-level system property to be assured",
		category: "Primary",
		color: "green",
		icon: "Target",
		shortcut: "G",
		validChildren: ["strategy", "propertyClaim"],
	},
	strategy: {
		id: "strategy",
		name: "Strategy",
		description: "Approach for decomposing a goal",
		category: "Primary",
		color: "purple",
		icon: "GitBranch",
		shortcut: "S",
		validChildren: ["propertyClaim", "strategy", "evidence"],
	},
	propertyClaim: {
		id: "propertyClaim",
		name: "Property Claim",
		description: "Specific property or sub-claim",
		category: "Primary",
		color: "orange",
		icon: "FileText",
		shortcut: "C",
		validChildren: ["propertyClaim", "strategy", "evidence"],
	},
	evidence: {
		id: "evidence",
		name: "Evidence",
		description: "Supporting evidence or artifact",
		category: "Supporting",
		color: "cyan",
		icon: "CheckCircle",
		shortcut: "E",
		validChildren: [],
	},
};

/**
 * Get node type metadata
 */
export const getNodeTypeMetadata = (
	nodeType: string | undefined
): NodeTypeMetadataItem => {
	const normalizedType = normalizeType(nodeType);
	const typeKey = resolveTypeKey(normalizedType);
	return nodeTypeMetadata[typeKey] ?? nodeTypeMetadata.goal;
};

/**
 * Get node types grouped by category
 */
export const getNodeTypesByCategory = (): Record<
	NodeCategory,
	NodeTypeMetadataItem[]
> => ({
	Primary: [
		nodeTypeMetadata.goal,
		nodeTypeMetadata.strategy,
		nodeTypeMetadata.propertyClaim,
	],
	Supporting: [nodeTypeMetadata.evidence],
});

export default nodeTypes;
