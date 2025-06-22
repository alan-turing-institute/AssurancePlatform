type Note = {
  // id: string;
  // type: string;
  // person: { name: string; href: string };
  // imageUrl: string;
  // comment: string;
  // date: Date;
  author:"Rich",
  assurance_case:51,
  content:"asdasdsadasdds",
  created_at:"2024-04-30T13:03:43.507729Z"

  tags?: string[]
  assigned?: any
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
  edit_groups: any[];
  view_groups: any[];
  color_profile: string;
  comments: any[];
  permissions: string;
  published: boolean,
  published_date: string | null
}

export type User = {
  id: number;
  username: string;
  email: string;
  last_login: string;
  date_joined: string;
  is_staff: boolean;
  all_groups: any[];  // Adjust the type if you know the structure of the groups
  owned_groups: any[]; // Adjust the type if you know the structure of the groups
  github_repositories: any[]; // Adjust the type if you know the structure of the repositories
};

export type Sector = {
  ID: number
  Name: string
  Description: string
  ISICcode: string,
  NACEcode: string
}