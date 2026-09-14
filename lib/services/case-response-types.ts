/**
 * Response types for case-related API data.
 *
 * These types define the shapes returned by the service layer (case-fetch-service)
 * and consumed by the frontend. IDs are strings (UUIDs from Prisma).
 */

import type { CommentResponse } from "./comment-service";

// The "Ready to Publish" intermediate step was retired (ADR 0003 §2) — DRAFT
// and PUBLISHED are the only two states now.
export type PublishStatusType = "DRAFT" | "PUBLISHED";

// Per-assertion status (ADR 0004 D3), mirroring the Prisma `AssertionStatus`
// enum and `AssertionStatusSchema` (lib/schemas/case-export.ts). Kept as a
// plain string union here rather than imported from generated Prisma types,
// matching this file's convention (see PublishStatusType above) of
// UI-facing response types staying independent of the Prisma client.
export type AssertionStatusResponseType =
	| "ASSERTED"
	| "NEEDS_SUPPORT"
	| "ASSUMED"
	| "AXIOMATIC"
	| "DEFEATED"
	| "AS_CITED";

/**
 * An away goal (ADR 0005 D3): a goal that cites a goal in another case.
 * `moduleReferenceId` names the cited case; `citedElementId` names the
 * cited goal within it (ADR 0004 D5). The `cited*` fields are resolved by
 * `case-fetch-service.ts` — never carried on the Prisma row itself — so the
 * canvas card can show a name without a follow-up fetch. `citedCaseAccessible`
 * gates whether the card links to the cited case: false whenever the viewer
 * lacks permission on it, matching the same-error-for-missing-and-forbidden
 * rule used elsewhere in this file.
 */
export interface AwayGoalResponse {
	citationDangling?: boolean;
	citedCaseAccessible?: boolean;
	citedCaseName?: string | null;
	citedElementId?: string | null;
	citedElementName?: string | null;
	comments?: CommentResponse[];
	createdDate?: string;
	description: string;
	goalId?: string | null;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	moduleReferenceId: string | null;
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	strategyId?: string | null;
	type: string;
}

/**
 * A module (ADR 0005 D3): a reference to a whole other case. Same
 * name-resolution and accessibility rules as `AwayGoalResponse` above, minus
 * the element-level citation (a module cites a case, not an element within it).
 */
export interface ModuleResponse {
	comments?: CommentResponse[];
	createdDate?: string;
	description: string;
	goalId?: string | null;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	moduleCaseAccessible?: boolean;
	moduleCaseName?: string | null;
	moduleReferenceId: string | null;
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	strategyId?: string | null;
	type: string;
}

export interface GoalResponse {
	assertionStatus?: AssertionStatusResponseType;
	assumption?: string;
	assuranceCaseId: string;
	awayGoals?: AwayGoalResponse[];
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	/** Dialogical reasoning (defeaters, ADR 0005 D2) — applies to any element type */
	defeatsElementId?: string | null;
	description: string;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	isDefeater?: boolean;
	justification?: string;
	keywords: string;
	modules?: ModuleResponse[];
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaims: PropertyClaimResponse[];
	strategies: StrategyResponse[];
	type: string;
}

export interface StrategyResponse {
	assertionStatus?: AssertionStatusResponseType;
	assumption?: string;
	awayGoals?: AwayGoalResponse[];
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	description: string;
	goalId: string | null;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	justification?: string;
	modules?: ModuleResponse[];
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaims: PropertyClaimResponse[];
	type?: string;
}

export interface PropertyClaimResponse {
	assertionStatus?: AssertionStatusResponseType;
	assumption?: string;
	awayGoals?: AwayGoalResponse[];
	claimType: string;
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	/** Dialogical reasoning (defeaters, ADR 0005 D2) — applies to any element type */
	defeatsElementId?: string | null;
	description: string;
	evidence: EvidenceResponse[];
	goalId: string | null;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	isDefeater?: boolean;
	justification?: string;
	level: number;
	modules?: ModuleResponse[];
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaimId: string | null;
	propertyClaims: PropertyClaimResponse[];
	strategies?: StrategyResponse[];
	strategyId: string | null;
	type: string;
}

export interface EvidenceResponse {
	comments?: CommentResponse[];
	createdDate?: string;
	/** Dialogical reasoning (defeaters, ADR 0005 D2) — applies to any element type */
	defeatsElementId?: string | null;
	description: string;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	isDefeater?: boolean;
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaimId: string[];
	type: string;
	URL: string;
	urls?: string[];
}

/** Supporting type for members in permission lists */
export interface MemberResponse {
	email?: string;
	id: string;
	username: string;
}

/** Supporting type for case images */
export interface CaseImageResponse {
	caption?: string;
	id: string;
	url: string;
}

export interface AssuranceCaseResponse {
	colourProfile?: string;
	comments: CommentResponse[];
	createdDate: string;
	createdOn?: string;
	description?: string;
	editMembers?: MemberResponse[];
	goals?: GoalResponse[];
	/** Whether the case has changes since last publish */
	hasChanges?: boolean;
	id: string;
	images?: CaseImageResponse[];
	/** True for auto-generated tutorial cases */
	isDemo?: boolean;
	/** ELK layout direction preference: TB (top-bottom) or LR (left-right) */
	layoutDirection?: "TB" | "LR";
	/** When the case was marked as ready to publish */
	markedReadyAt?: string | null;
	name: string;
	owner?: string;
	permissions: string | string[];
	published?: boolean;
	publishedAt?: string | null;
	/** 3-state publish workflow status */
	publishStatus?: PublishStatusType;
	reviewMembers?: MemberResponse[];
	title?: string;
	type: string;
	updatedOn?: string;
	viewMembers?: MemberResponse[];
}

export interface UserResponse {
	createdAt: string;
	email: string;
	firstName?: string;
	id: string;
	lastName?: string;
	updatedAt?: string;
	username: string;
}
