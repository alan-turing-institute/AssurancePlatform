/**
 * Response types for case-related API data.
 *
 * These types define the shapes returned by the service layer (case-fetch-service)
 * and consumed by the frontend. IDs are strings (UUIDs from Prisma), except
 * CaseStudyResponse.id which is number (autoincrement Int).
 */

import type { CommentResponse } from "./comment-service";

export type PublishStatusType = "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";

export interface GoalResponse {
	assumption?: string;
	assuranceCaseId: string;
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	description: string;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	justification?: string;
	keywords: string;
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaims: PropertyClaimResponse[];
	strategies: StrategyResponse[];
	type: string;
}

export interface StrategyResponse {
	assumption?: string;
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	description: string;
	goalId: string;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	justification?: string;
	name: string;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
	propertyClaims: PropertyClaimResponse[];
	type?: string;
}

export interface PropertyClaimResponse {
	assumption?: string;
	claimType: string;
	comments?: CommentResponse[];
	context?: string[];
	createdDate?: string;
	description: string;
	evidence: EvidenceResponse[];
	goalId: string | null;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
	justification?: string;
	level: number;
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
	description: string;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	id: string;
	inSandbox?: boolean;
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
	/** Whether any linked case study is public */
	hasPublicCaseStudy?: boolean;
	id: string;
	images?: CaseImageResponse[];
	/** True for auto-generated tutorial cases */
	isDemo?: boolean;
	/** ELK layout direction preference: TB (top-bottom) or LR (left-right) */
	layoutDirection?: "TB" | "LR";
	/** Number of linked case studies */
	linkedCaseStudyCount?: number;
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

/**
 * Case study response type — note id is number (autoincrement Int), not string.
 */
export interface CaseStudyResponse {
	assuranceCases?: AssuranceCaseResponse[];
	authors: string;
	contact?: string;
	createdOn: string;
	description: string;
	featuredImage?: string;
	id: number;
	image?: string;
	lastModifiedOn?: string;
	published: boolean;
	publishedDate?: string;
	sector: string;
	title: string;
	type?: string;
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
