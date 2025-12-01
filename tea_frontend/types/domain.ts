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
	id: number;
	author: string;
	content: string;
	created_at: string;
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
	context: Context[];
	property_claims: PropertyClaim[];
	strategies: Strategy[];
	comments?: Comment[];
	assumption?: string;
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

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
	authors: string;
	image?: string;
	featuredImage?: string;
	feature_image_url?: string;
	assurance_cases?: number[];
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

export type AssuranceCase = {
	id: number;
	name: string;
	title?: string;
	description?: string;
	published?: boolean;
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
	selectedAssuranceCases: number[];
	setSelectedAssuranceCases: React.Dispatch<React.SetStateAction<number[]>>;
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
