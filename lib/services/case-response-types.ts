/**
 * Response types for case-related API data.
 *
 * These types define the shapes returned by the service layer (case-fetch-service)
 * and consumed by the frontend. IDs are strings (UUIDs from Prisma), except
 * CaseStudyResponse.id which is number (autoincrement Int).
 */

import type { CommentResponse } from "./comment-service";

export type PublishStatusType = "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";

export type GoalResponse = {
	id: string;
	type: string;
	name: string;
	description: string;
	createdDate?: string;
	keywords: string;
	assuranceCaseId: string;
	context?: string[];
	propertyClaims: PropertyClaimResponse[];
	strategies: StrategyResponse[];
	comments?: CommentResponse[];
	assumption?: string;
	justification?: string;
	inSandbox?: boolean;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
};

export type StrategyResponse = {
	id: string;
	type?: string;
	name: string;
	description: string;
	createdDate?: string;
	goalId: string;
	propertyClaims: PropertyClaimResponse[];
	comments?: CommentResponse[];
	assumption?: string;
	justification?: string;
	context?: string[];
	inSandbox?: boolean;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
};

export type PropertyClaimResponse = {
	id: string;
	type: string;
	name: string;
	description: string;
	createdDate?: string;
	goalId: string | null;
	propertyClaimId: string | null;
	level: number;
	claimType: string;
	propertyClaims: PropertyClaimResponse[];
	evidence: EvidenceResponse[];
	strategyId: string | null;
	strategies?: StrategyResponse[];
	comments?: CommentResponse[];
	assumption?: string;
	justification?: string;
	context?: string[];
	inSandbox?: boolean;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
};

export type EvidenceResponse = {
	id: string;
	type: string;
	name: string;
	description: string;
	createdDate?: string;
	URL: string;
	urls?: string[];
	propertyClaimId: string[];
	comments?: CommentResponse[];
	inSandbox?: boolean;
	/** Set by frontend tree processing, not present in API response */
	hidden?: boolean;
	/** Set by frontend tree processing, not present in API response */
	originalHidden?: boolean;
};

/** Supporting type for members in permission lists */
export type MemberResponse = {
	id: string;
	username: string;
	email?: string;
};

/** Supporting type for case images */
export type CaseImageResponse = {
	id: string;
	url: string;
	caption?: string;
};

export type AssuranceCaseResponse = {
	id: string;
	name: string;
	title?: string;
	description?: string;
	published?: boolean;
	publishedAt?: string | null;
	createdOn?: string;
	updatedOn?: string;
	type: string;
	comments: CommentResponse[];
	permissions: string | string[];
	createdDate: string;
	goals?: GoalResponse[];
	owner?: string;
	colourProfile?: string;
	images?: CaseImageResponse[];
	viewMembers?: MemberResponse[];
	editMembers?: MemberResponse[];
	reviewMembers?: MemberResponse[];
	/** 3-state publish workflow status */
	publishStatus?: PublishStatusType;
	/** When the case was marked as ready to publish */
	markedReadyAt?: string | null;
	/** Whether the case has changes since last publish */
	hasChanges?: boolean;
	/** Whether any linked case study is public */
	hasPublicCaseStudy?: boolean;
	/** Number of linked case studies */
	linkedCaseStudyCount?: number;
	/** True for auto-generated tutorial cases */
	isDemo?: boolean;
	/** ELK layout direction preference: TB (top-bottom) or LR (left-right) */
	layoutDirection?: "TB" | "LR";
};

/**
 * Case study response type — note id is number (autoincrement Int), not string.
 */
export type CaseStudyResponse = {
	id: number;
	title: string;
	description: string;
	sector: string;
	type?: string;
	contact?: string;
	published: boolean;
	publishedDate?: string;
	createdOn: string;
	lastModifiedOn?: string;
	authors: string;
	image?: string;
	featuredImage?: string;
	assuranceCases?: AssuranceCaseResponse[];
};

export type UserResponse = {
	id: string;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	createdAt: string;
	updatedAt?: string;
};
