interface Group {
  id: number;
  name: string;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  created_at: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  url: string;
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
  hidden?: boolean;
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
  name: string;
  short_description: string;
  long_description: string;
  goal_id: number;
  property_claims: PropertyClaim[];
  hidden?: boolean;
  originalHidden?: boolean;
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

export interface AssuranceCase {
  id: number;
  type: string;
  name: string;
  description: string;
  created_date: string;
  lock_uuid: string | null;
  goals: Goal[];
  owner: number;
  edit_groups: Group[];
  view_groups: Group[];
  color_profile: string;
  comments: Comment[];
  permissions: string;
  published: boolean;
  published_date: string | null;
}

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
