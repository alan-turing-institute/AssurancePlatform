// TODO: Phase 2 - Consolidate short_description/long_description to single description field
// See: TASKS/Phase2-DescriptionFieldConsolidation.md

type Group = {
	id: number;
	name: string;
};

type Comment = {
	id: number;
	author: string;
	content: string;
	created_at: string;
};

type GitHubRepository = {
	id: number;
	name: string;
	url: string;
};

export type Evidence = {
	id: number;
	type: string;
	name: string;
	short_description: string;
	long_description: string;
	URL: string;
	property_claim_id: number[];
	hidden?: boolean;
};

export type PropertyClaim = {
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
	hidden?: boolean;
};

export type EvidenceWithMeta = {
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

export type PropertyClaimWithMeta = {
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
	property_claims: PropertyClaimWithMeta[];
	evidence: EvidenceWithMeta[];
	strategy_id: number | null;
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
	property_claims: PropertyClaimWithMeta[];
	comments?: Comment[];
	assumption?: string;
	justification?: string;
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
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
	property_claims: PropertyClaimWithMeta[];
	strategies: Strategy[];
	comments?: Comment[];
	assumption?: string;
	in_sandbox?: boolean;
	hidden?: boolean;
	originalHidden?: boolean;
};

export type AssuranceCase = {
	id: string;
	type: string;
	name: string;
	description: string;
	created_date: string;
	goals: Goal[];
	owner: number;
	edit_groups: Group[];
	view_groups: Group[];
	color_profile: string;
	comments: Comment[];
	permissions: string;
	published: boolean;
	published_date: string | null;
	publishedAt: string | null;
};

export type User = {
	id: number;
	username: string;
	email: string;
	last_login: string;
	date_joined: string;
	is_staff: boolean;
	all_groups: Group[];
	owned_groups: Group[];
	github_repositories: GitHubRepository[];
};

export type Sector = {
	ID: number;
	Name: string;
	Description: string;
	ISICcode: string;
	NACEcode: string;
};
