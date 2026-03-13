/**
 * Shared types for case helper modules
 */
import type {
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

// Regular expressions
export const NUMERIC_ID_PATTERN = /^\d+$/;

export interface Map {
	[key: string]: string | undefined;
}

// Extended CaseNode interface with proper typing
// Dynamic property bag: legacy case tree operations pass arbitrary fields through nodes
export interface CaseNode {
	childrenHidden?: boolean;
	context?: string[];
	evidence?: EvidenceResponse[];
	goals?: GoalResponse[];
	hidden: boolean;
	id: string;
	name?: string;
	originalHidden?: boolean;
	propertyClaims?: PropertyClaimResponse[];
	strategies?: StrategyResponse[];
	type: string;
	[key: string]: unknown;
}

// Node type for React Flow integration
// Dynamic property bag on data: legacy case tree operations spread arbitrary fields into node data
export interface ReactFlowNode {
	data: {
		id: string;
		name: string;
		type: string;
		goalId?: string | null;
		strategyId?: string | null;
		propertyClaimId?: string | string[] | null;
		context?: string[];
		propertyClaims?: PropertyClaimResponse[];
		strategies?: StrategyResponse[];
		evidence?: EvidenceResponse[];
		[key: string]: unknown;
	};
	id: string;
	position: { x: number; y: number };
	type: string;
}

// API Response types
// Dynamic property bag: API responses include varying fields per element type
export interface ApiNodeResponse {
	description: string;
	id: string;
	name: string;
	type: string;
	[key: string]: unknown;
}

// Payload types for API requests
export interface DetachPayload {
	goalId: string | null;
	propertyClaimId: string | null;
	strategyId: string | null;
}

// Comment type for API operations
export interface CommentPayload {
	content: string;
}

// Type for node creation payloads
export type CreateNodePayload =
	| Partial<GoalResponse>
	| Partial<StrategyResponse>
	| Partial<PropertyClaimResponse>
	| Partial<EvidenceResponse>;

// Type for nested array items that can contain various node types
export type NestedArrayItem =
	| GoalResponse
	| PropertyClaimResponse
	| StrategyResponse
	| EvidenceResponse;

// Type guards
export function hasPropertyClaims(
	obj: unknown
): obj is { propertyClaims: PropertyClaimResponse[] } {
	return typeof obj === "object" && obj !== null && "propertyClaims" in obj;
}

export function hasStrategies(
	obj: unknown
): obj is { strategies: StrategyResponse[] } {
	return typeof obj === "object" && obj !== null && "strategies" in obj;
}

export function hasEvidence(
	obj: unknown
): obj is { evidence: EvidenceResponse[] } {
	return typeof obj === "object" && obj !== null && "evidence" in obj;
}

export function hasContext(obj: unknown): obj is { context: string[] } {
	return typeof obj === "object" && obj !== null && "context" in obj;
}

export const DESCRIPTION_FROM_TYPE: Map = {
	goal: "Goals are the overarching objectives of the assurance case. They represent what needs to be achieved or demonstrated.",
	context:
		"Context elements provide background information and assumptions that frame the assurance case.",
	property_claim:
		"Property claims assert specific properties or characteristics that support the goals.",
	property:
		"Property claims assert specific properties or characteristics that support the goals.",
	evidence:
		"Evidence provides factual support and verification for the claims made in the assurance case.",
	strategy:
		"Strategies describe the approach or method used to decompose goals into sub-goals or claims.",
};
