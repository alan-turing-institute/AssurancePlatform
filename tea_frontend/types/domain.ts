/**
 * Domain types for the TEA Platform
 * These interfaces represent the core business entities
 */

// Supporting types for AssuranceCase
export interface Group {
	id: number;
	name: string;
}

export interface Comment {
	id: number;
	author: string;
	content: string;
	created_at: string;
}

export interface Goal {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	keywords: string;
	assurance_case_id: number;
	context: Context[];
	property_claims: PropertyClaim[];
	strategies: Strategy[];
	hidden?: boolean;
	originalHidden?: boolean;
}

export interface Context {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	created_date: string;
	goal_id: number;
	hidden?: boolean;
	originalHidden?: boolean;
}

export interface Strategy {
	id: number;
	type?: string; // Strategy type identifier
	name: string;
	short_description: string;
	long_description: string;
	goal_id: number;
	property_claims: PropertyClaim[];
	hidden?: boolean;
	originalHidden?: boolean;
}

export interface PropertyClaim {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	goal_id: number | null;
	property_claim_id: number | null;
	level: number;
	claim_type: string;
	property_claims: PropertyClaim[];
	evidence: Evidence[];
	strategy_id: number | null;
	strategies?: Strategy[]; // PropertyClaim can have strategies in certain contexts
	hidden?: boolean;
	originalHidden?: boolean;
}

export interface Evidence {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	URL: string;
	property_claim_id: number[];
	hidden?: boolean;
	originalHidden?: boolean;
}

export interface CaseStudy {
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
	feature_image_url?: string; // URL from backend API
	assurance_cases?: number[]; // Array of AssuranceCase IDs
	assuranceCases?: AssuranceCase[]; // Full AssuranceCase objects
}

// Supporting type for images
export interface CaseImage {
	id: number;
	url: string;
	caption?: string;
}

// Supporting type for members
export interface Member {
	id: number;
	username: string;
	email?: string;
}

export interface AssuranceCase {
	id: number;
	name: string;
	title?: string; // Some components use title instead of name
	description?: string;
	published?: boolean;
	createdOn?: string;
	updatedOn?: string;
	type: string; // Required - typically 'AssuranceCase'
	lock_uuid: string | null; // Required - null when not locked
	comments: Comment[]; // Required - empty array if no comments
	permissions: string | string[]; // Required - can be string ('manage', 'edit', 'view') or array
	created_date: string; // Required - ISO date string from backend
	goals?: Goal[];
	owner?: number;
	edit_groups?: Group[];
	view_groups?: Group[];
	color_profile?: string;
	published_date?: string | null;
	// Additional properties from backend
	review_groups?: Group[];
	property_claims?: PropertyClaim[];
	evidence?: Evidence[];
	contexts?: Context[];
	strategies?: Strategy[];
	images?: CaseImage[];
	viewMembers?: Member[];
	editMembers?: Member[];
	reviewMembers?: Member[];
}

export interface User {
	id: number;
	username: string;
	email: string;
	firstName?: string;
	lastName?: string;
	createdAt: string;
	updatedAt?: string;
}

export interface FormFile {
	file: File;
	preview: string;
}

export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

// Form-related types
export interface CaseStudyFormData {
	title: string;
	description: string;
	sector: string;
	authors: string;
	published: boolean;
	publishedDate?: string;
	image?: File;
	selectedAssuranceCases: number[];
}

export interface FileUploadEvent extends Event {
	target: HTMLInputElement & {
		files: FileList;
	};
}

// Component prop types
export interface TableActionsProps {
	caseStudy: CaseStudy;
}

export interface RelatedAssuranceCaseListProps {
	published: boolean;
	selectedAssuranceCases: number[];
	setSelectedAssuranceCases: React.Dispatch<React.SetStateAction<number[]>>;
}

export interface CaseStudyFormProps {
	caseStudy?: CaseStudy;
}

export interface PublishedBannerProps {
	caseStudy: CaseStudy;
}

export interface DeleteFormProps {
	user: User;
}

export interface PasswordFormProps {
	data: User;
}

export interface PersonalInfoFormProps {
	data: User;
}

export interface CaseStudiesProps {
	caseStudies: CaseStudy[];
}
