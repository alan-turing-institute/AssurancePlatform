/**
 * Domain types for the TEA Platform
 * These types represent the core business entities
 *
 * TODO: Phase 2 - Consolidate short_description/long_description to single description field
 * See: TASKS/Phase2-DescriptionFieldConsolidation.md
 */

// Supporting types for AssuranceCase
export type Group = {
	id: number;
	name: string;
};

export type Comment = {
	id: number | string;
	author: string;
	authorId?: string;
	content: string;
	created_at: string;
	updated_at?: string;
	parentId?: string | null;
	replies?: Comment[];
	resolved?: boolean;
	resolvedBy?: string | null;
	resolvedAt?: string | null;
};

export type Goal = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date?: string;
	keywords: string;
	assurance_case_id: number;
	context?: string[];
	property_claims: PropertyClaim[];
	strategies: Strategy[];
	comments?: Comment[];
	assumption?: string;
	justification?: string;
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

/**
 * @deprecated Context is no longer a separate element type.
 * Context is now stored as a string[] on Goal, Strategy, and PropertyClaim.
 * This type is kept for backwards compatibility with legacy imports.
 */
export type Context = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date: string;
	goal_id: number;
	comments?: Comment[];
	assumption?: string;
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

export type Strategy = {
	id: number;
	type?: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date?: string;
	goal_id: number;
	property_claims: PropertyClaim[];
	comments?: Comment[];
	assumption?: string;
	justification?: string;
	context?: string[];
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

export type PropertyClaim = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date?: string;
	goal_id: number | null;
	property_claim_id: number | null;
	level: number;
	claim_type: string;
	property_claims: PropertyClaim[];
	evidence: Evidence[];
	strategy_id: number | null;
	strategies?: Strategy[];
	comments?: Comment[];
	assumption?: string;
	justification?: string;
	context?: string[];
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

export type Evidence = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date?: string;
	URL: string;
	urls?: string[];
	property_claim_id: number[];
	comments?: Comment[];
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

export type CaseStudy = {
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
	feature_image_url?: string;
	assurance_cases?: string[];
	assuranceCases?: AssuranceCase[];
};

// Supporting type for images
export type CaseImage = {
	id: number;
	url: string;
	caption?: string;
};

// Supporting type for members
export type Member = {
	id: number;
	username: string;
	email?: string;
};

/**
 * Publish status for assurance cases.
 * - DRAFT: Private, only visible to owner and collaborators
 * - READY_TO_PUBLISH: Can be linked to case studies, but not publicly visible
 * - PUBLISHED: Publicly visible on the Discover page
 */
export type PublishStatusType = "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED";

export type AssuranceCase = {
	id: string;
	name: string;
	title?: string;
	description?: string;
	published?: boolean;
	publishedAt?: string | null;
	createdOn?: string;
	updatedOn?: string;
	type: string;
	lock_uuid: string | null;
	comments: Comment[];
	permissions: string | string[];
	created_date: string;
	goals?: Goal[];
	owner?: number;
	edit_groups?: Group[];
	view_groups?: Group[];
	color_profile?: string;
	published_date?: string | null;
	review_groups?: Group[];
	property_claims?: PropertyClaim[];
	evidence?: Evidence[];
	contexts?: Context[];
	strategies?: Strategy[];
	images?: CaseImage[];
	viewMembers?: Member[];
	editMembers?: Member[];
	reviewMembers?: Member[];
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
};

export type User = {
	id: number;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	createdAt: string;
	updatedAt?: string;
};

export type FormFile = {
	file: File;
	preview: string;
};

export type ApiResponse<T = unknown> = {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
};

/**
 * Standard result type for Server Actions
 * Use this for all mutation Server Actions to provide consistent error handling
 */
export type ActionResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; fieldErrors?: Record<string, string> };

// Form-related types
export type CaseStudyFormData = {
	title: string;
	description: string;
	sector: string;
	authors: string;
	published: boolean;
	publishedDate?: string;
	image?: File;
	selectedAssuranceCases: number[];
};

export type FileUploadEvent = Event & {
	target: HTMLInputElement & {
		files: FileList;
	};
};

// Component prop types
export type TableActionsProps = {
	caseStudy: CaseStudy;
};

export type RelatedAssuranceCaseListProps = {
	published: boolean;
	selectedAssuranceCases: string[];
	setSelectedAssuranceCases: React.Dispatch<React.SetStateAction<string[]>>;
};

export type CaseStudyFormProps = {
	caseStudy?: CaseStudy;
};

export type PublishedBannerProps = {
	caseStudy: CaseStudy;
};

export type DeleteFormProps = {
	user: User;
};

export type PasswordFormProps = {
	data: User;
};

export type PersonalInfoFormProps = {
	data: User;
};

export type CaseStudiesProps = {
	caseStudies: CaseStudy[];
};
