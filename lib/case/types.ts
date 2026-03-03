/**
 * Shared types for case helper modules
 */
import type { Evidence, Goal, PropertyClaim, Strategy } from "@/types";

// Regular expressions
export const NUMERIC_ID_PATTERN = /^\d+$/;

export type Map = {
	[key: string]: string | undefined;
};

// Extended CaseNode interface with proper typing
// Dynamic property bag: legacy case tree operations pass arbitrary fields through nodes
export type CaseNode = {
	hidden: boolean;
	id: number;
	type: string;
	name?: string;
	goals?: Goal[];
	context?: string[];
	propertyClaims?: PropertyClaim[];
	strategies?: Strategy[];
	evidence?: Evidence[];
	childrenHidden?: boolean;
	originalHidden?: boolean;
	[key: string]: unknown;
};

// Node type for React Flow integration
// Dynamic property bag on data: legacy case tree operations spread arbitrary fields into node data
export type ReactFlowNode = {
	id: string;
	type: string;
	data: {
		id: number;
		name: string;
		type: string;
		goalId?: number | null;
		strategyId?: number | null;
		propertyClaimId?: number | number[] | null;
		context?: string[];
		propertyClaims?: PropertyClaim[];
		strategies?: Strategy[];
		evidence?: Evidence[];
		[key: string]: unknown;
	};
	position: { x: number; y: number };
};

// API Response types
// Dynamic property bag: API responses include varying fields per element type
export type ApiNodeResponse = {
	id: number;
	name: string;
	description: string;
	type: string;
	[key: string]: unknown;
};

// Payload types for API requests
export type DetachPayload = {
	goalId: number | null;
	strategyId: number | null;
	propertyClaimId: number | null;
};

// Comment type for API operations
export type CommentPayload = {
	content: string;
};

// Type for node creation payloads
export type CreateNodePayload =
	| Partial<Goal>
	| Partial<Strategy>
	| Partial<PropertyClaim>
	| Partial<Evidence>;

// Type for nested array items that can contain various node types
export type NestedArrayItem = Goal | PropertyClaim | Strategy | Evidence;

// Type guards
export function hasPropertyClaims(
	obj: unknown
): obj is { propertyClaims: PropertyClaim[] } {
	return typeof obj === "object" && obj !== null && "propertyClaims" in obj;
}

export function hasStrategies(obj: unknown): obj is { strategies: Strategy[] } {
	return typeof obj === "object" && obj !== null && "strategies" in obj;
}

export function hasEvidence(obj: unknown): obj is { evidence: Evidence[] } {
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
