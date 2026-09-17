/**
 * Shared types for case helper modules
 */
import type {
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";

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

// Type for node creation payloads — sent to POST /api/cases/[id]/elements via
// createAssuranceCaseNode. `assuranceCaseId` is read by createAssuranceCaseNode
// to build the request URL and is NOT sent in the request body; `parentId` is
// resolved client-side from the node the user clicked before calling in. This
// replaced a union of Partial<XResponse> types (2026-09, mutation-schema
// hardening) that let payloads carry legacy fields (goalId/strategyId/
// propertyClaimId, claimType, propertyClaims, evidence, elementType) the
// server schema never declared — silently dropped under lenient parsing,
// rejected outright once request schemas went strict.
export interface CreateNodePayload {
	assuranceCaseId?: string;
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only.
	citedElementId?: string | null;
	// Dialogical reasoning (defeaters, ADR 0005 D7).
	defeatsElementId?: string | null;
	description: string;
	isDefeater?: boolean;
	// Required for MODULE — how it's embedded (ADR 0005 D7).
	moduleEmbedType?: "COPY" | "REFERENCE";
	// Module reference — MODULE and AWAY_GOAL (ADR 0005 D7).
	moduleReferenceId?: string | null;
	name?: string;
	parentId: string | null;
	URL?: string;
	urls?: string[];
}

// Type for nested array items that can contain various node types
export type NestedArrayItem =
	| GoalResponse
	| PropertyClaimResponse
	| StrategyResponse
	| EvidenceResponse;
