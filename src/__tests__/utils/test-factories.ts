/**
 * Advanced factory functions for creating complex test data structures
 * These factories provide realistic, interconnected data for integration tests
 */

import type {
	AssuranceCase,
	CaseStudy,
	Comment,
	Context,
	Evidence,
	Goal,
	Member,
	PropertyClaim,
	Strategy,
} from "@/types/domain";

// Counter for generating unique IDs
let idCounter = 1;
const getNextId = () => idCounter++;

// Reset ID counter (useful for test isolation)
export const resetIdCounter = () => {
	idCounter = 1;
};

// Type definitions for our factory structures
export type User = {
	id: number;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	auth_provider: string;
	auth_username: string;
};

export type Team = {
	id: number;
	name: string;
	description: string;
	owner: number;
	members: number[];
	created_date: string;
};

export type TeamMember = {
	id: number;
	user: number;
	team: number;
	role: "owner" | "admin" | "member";
	joined_date: string;
};

export type CasePermission = {
	id: number;
	case: number;
	user?: number;
	team?: number;
	permission_type: "view" | "edit" | "review" | "manage";
	created_date: string;
};

export type CaseTemplate = {
	id: number;
	name: string;
	description: string;
	structure: {
		goals: Partial<Goal>[];
		strategies: Partial<Strategy>[];
		property_claims: Partial<PropertyClaim>[];
		contexts: Partial<Context>[];
		evidence: Partial<Evidence>[];
	};
	category: string;
	tags: string[];
};

// Advanced User Factory
export const UserFactory = {
	create(overrides: Partial<User> = {}): User {
		const id = overrides.id ?? getNextId();
		const firstName = overrides.first_name ?? `User${id}`;
		const lastName = overrides.last_name ?? `Last${id}`;
		const username = overrides.username ?? `user${id}`;

		return {
			id,
			username,
			email: overrides.email ?? `${username}@example.com`,
			first_name: firstName,
			last_name: lastName,
			auth_provider: overrides.auth_provider ?? "github",
			auth_username: overrides.auth_username ?? username,
		};
	},

	createBatch(count: number, overrides: Partial<User> = {}): User[] {
		return Array.from({ length: count }, (_, _i) =>
			this.create({ ...overrides, id: getNextId() })
		);
	},

	createWithRole(role: string): User {
		return this.create({
			username: `${role.toLowerCase()}_user`,
			email: `${role.toLowerCase()}@example.com`,
			first_name: role,
			last_name: "User",
		});
	},
};

// Advanced Team Factory
export const TeamFactory = {
	create(overrides: Partial<Team> = {}): Team {
		const id = overrides.id ?? getNextId();
		const owner = overrides.owner ?? UserFactory.create().id;

		return {
			id,
			name: overrides.name ?? `Team ${id}`,
			description: overrides.description ?? `Description for Team ${id}`,
			owner,
			members: overrides.members ?? [owner],
			created_date: overrides.created_date ?? new Date().toISOString(),
		};
	},

	createWithMembers(memberCount = 5): {
		team: Team;
		members: TeamMember[];
		users: User[];
	} {
		const owner = UserFactory.createWithRole("Owner");
		const users = [owner, ...UserFactory.createBatch(memberCount - 1)];
		const team = this.create({
			owner: owner.id,
			members: users.map((u) => u.id),
		});

		const members: TeamMember[] = users.map((user, index) => {
			let role: "owner" | "admin" | "member";
			if (index === 0) {
				role = "owner";
			} else if (index === 1) {
				role = "admin";
			} else {
				role = "member";
			}

			return {
				id: getNextId(),
				user: user.id,
				team: team.id,
				role,
				joined_date: new Date(
					Date.now() - index * 24 * 60 * 60 * 1000
				).toISOString(),
			};
		});

		return { team, members, users };
	},
};

// Advanced AssuranceCase Factory
export const AssuranceCaseFactory = {
	create(overrides: Partial<AssuranceCase> = {}): AssuranceCase {
		const id = overrides.id ?? getNextId();
		const owner = overrides.owner ?? UserFactory.create().id;
		const currentDate = new Date().toISOString();

		const defaults = {
			type: "AssuranceCase" as const,
			name: `Assurance Case ${id}`,
			description: `Comprehensive assurance case ${id} for testing`,
			created_date: currentDate,
			lock_uuid: null,
			view_groups: [],
			edit_groups: [],
			review_groups: [],
			color_profile: "default",
			published: false,
			published_date: null,
			permissions: "manage" as const,
			comments: [],
			goals: [],
			property_claims: [],
			evidence: [],
			contexts: [],
			strategies: [],
			images: [],
			viewMembers: [],
			editMembers: [],
			reviewMembers: [],
		};

		return {
			id,
			owner,
			...defaults,
			...overrides,
		};
	},

	createWithFullStructure(): {
		assuranceCase: AssuranceCase;
		goals: Goal[];
		strategies: Strategy[];
		propertyClaims: PropertyClaim[];
		evidence: Evidence[];
		contexts: Context[];
	} {
		const assuranceCase = this.create();
		const caseId = assuranceCase.id;

		// Create hierarchical structure
		const topGoal = GoalFactory.create({
			assurance_case_id: caseId,
			name: "Top-Level Safety Goal",
		});

		const contexts = [
			ContextFactory.create({
				goal_id: topGoal.id,
				name: "Operating Environment",
			}),
			ContextFactory.create({
				goal_id: topGoal.id,
				name: "System Boundaries",
			}),
		];

		const strategy = StrategyFactory.create({
			goal_id: topGoal.id,
			name: "Argument by Component Safety",
		});

		const subGoals = [
			GoalFactory.create({
				assurance_case_id: caseId,
				name: "Component A Safety",
			}),
			GoalFactory.create({
				assurance_case_id: caseId,
				name: "Component B Safety",
			}),
		];

		const propertyClaims = [
			PropertyClaimFactory.create({
				goal_id: subGoals[0].id,
				name: "Component A Reliability",
				claim_type: "claim",
				level: 1,
			}),
			PropertyClaimFactory.create({
				goal_id: subGoals[1].id,
				name: "Component B Performance",
				claim_type: "claim",
				level: 1,
			}),
		];

		const evidence = [
			EvidenceFactory.create({
				name: "Test Results for Component A",
				URL: "https://example.com/tests/component-a",
			}),
			EvidenceFactory.create({
				name: "Performance Benchmarks for Component B",
				URL: "https://example.com/benchmarks/component-b",
			}),
		];

		// Link evidence to property claims
		evidence[0].property_claim_id = [propertyClaims[0].id];
		evidence[1].property_claim_id = [propertyClaims[1].id];

		// Update assurance case with all elements
		assuranceCase.goals = [topGoal, ...subGoals];
		assuranceCase.strategies = [strategy];
		assuranceCase.property_claims = propertyClaims;
		assuranceCase.evidence = evidence;
		assuranceCase.contexts = contexts;

		return {
			assuranceCase,
			goals: [topGoal, ...subGoals],
			strategies: [strategy],
			propertyClaims,
			evidence,
			contexts,
		};
	},

	createPublished(overrides: Partial<AssuranceCase> = {}): AssuranceCase {
		return this.create({
			...overrides,
			published: true,
			published_date: new Date().toISOString(),
		});
	},

	createWithPermissions(
		permissions: Array<{
			userId?: number;
			teamId?: number;
			type: CasePermission["permission_type"];
		}>
	): {
		assuranceCase: AssuranceCase;
		permissions: CasePermission[];
		users: User[];
		teams: Team[];
	} {
		const assuranceCase = this.create();
		const users: User[] = [];
		const teams: Team[] = [];
		const casePermissions: CasePermission[] = [];

		permissions.forEach((perm, _index) => {
			const permission: CasePermission = {
				id: getNextId(),
				case: assuranceCase.id,
				permission_type: perm.type,
				created_date: new Date().toISOString(),
			};

			if (perm.userId) {
				permission.user = perm.userId;
			} else if (perm.teamId) {
				permission.team = perm.teamId;
			} else {
				// Create a new user if neither is specified
				const user = UserFactory.create();
				users.push(user);
				permission.user = user.id;
			}

			casePermissions.push(permission);

			// Update assurance case members lists
			if (permission.user) {
				const member: Member = {
					id: permission.user,
					username: `user${permission.user}`,
					email: `user${permission.user}@example.com`,
				};

				switch (perm.type) {
					case "view":
						assuranceCase.viewMembers?.push(member);
						break;
					case "edit":
						assuranceCase.editMembers?.push(member);
						break;
					case "review":
						assuranceCase.reviewMembers?.push(member);
						break;
					case "manage":
						// Handle manage case if needed
						break;
					default:
						// Handle unknown permission type
						break;
				}
			}
		});

		return {
			assuranceCase,
			permissions: casePermissions,
			users,
			teams,
		};
	},
};

// Goal Factory
export const GoalFactory = {
	create(overrides: Partial<Goal> = {}): Goal {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "Goal",
			name: overrides.name ?? `Goal ${id}`,
			short_description:
				overrides.short_description ?? `Short description for goal ${id}`,
			long_description:
				overrides.long_description ?? `Detailed description for goal ${id}`,
			keywords: overrides.keywords ?? "safety, reliability, testing",
			assurance_case_id: overrides.assurance_case_id ?? 1,
			context: overrides.context ?? [],
			property_claims: overrides.property_claims ?? [],
			strategies: overrides.strategies ?? [],
		};
	},

	createHierarchy(depth = 3, breadth = 2): Goal[] {
		const goals: Goal[] = [];

		const createLevel = (parentId: number | null, currentDepth: number) => {
			if (currentDepth >= depth) {
				return;
			}

			for (let i = 0; i < breadth; i++) {
				const goal = this.create({
					name: parentId ? `Sub-Goal ${parentId}-${i}` : `Top Goal ${i}`,
				});
				goals.push(goal);
				createLevel(goal.id, currentDepth + 1);
			}
		};

		createLevel(null, 0);
		return goals;
	},
};

// Strategy Factory
export const StrategyFactory = {
	create(overrides: Partial<Strategy> = {}): Strategy {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "Strategy",
			name: overrides.name ?? `Strategy ${id}`,
			short_description:
				overrides.short_description ?? `Strategy ${id} short description`,
			long_description:
				overrides.long_description ??
				`Comprehensive strategy ${id} for achieving goals`,
			goal_id: overrides.goal_id ?? 1,
			property_claims: overrides.property_claims ?? [],
		};
	},
};

// PropertyClaim Factory
export const PropertyClaimFactory = {
	create(overrides: Partial<PropertyClaim> = {}): PropertyClaim {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "PropertyClaim",
			name: overrides.name ?? `Property Claim ${id}`,
			short_description:
				overrides.short_description ?? `Claim ${id} short description`,
			long_description:
				overrides.long_description ?? `Detailed property claim ${id}`,
			goal_id: overrides.goal_id ?? null,
			property_claim_id: overrides.property_claim_id ?? null,
			level: overrides.level ?? 1,
			claim_type: overrides.claim_type ?? "claim",
			property_claims: overrides.property_claims ?? [],
			evidence: overrides.evidence ?? [],
			strategy_id: overrides.strategy_id ?? null,
		};
	},

	createNested(levels = 3): PropertyClaim[] {
		const claims: PropertyClaim[] = [];
		let parentId: number | null = null;

		for (let level = 1; level <= levels; level++) {
			const claim = this.create({
				name: `Level ${level} Claim`,
				level,
				property_claim_id: parentId,
			});
			claims.push(claim);
			parentId = claim.id;
		}

		return claims;
	},
};

// Evidence Factory
export const EvidenceFactory = {
	create(overrides: Partial<Evidence> = {}): Evidence {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "Evidence",
			name: overrides.name ?? `Evidence ${id}`,
			short_description:
				overrides.short_description ?? `Evidence ${id} summary`,
			long_description:
				overrides.long_description ??
				`Comprehensive evidence ${id} supporting claims`,
			URL: overrides.URL ?? `https://example.com/evidence/${id}`,
			property_claim_id: overrides.property_claim_id ?? [],
		};
	},

	createForClaim(claimId: number, count = 3): Evidence[] {
		return Array.from({ length: count }, (_, i) =>
			this.create({
				name: `Evidence ${i + 1} for Claim ${claimId}`,
				property_claim_id: [claimId],
			})
		);
	},
};

// Context Factory
export const ContextFactory = {
	create(overrides: Partial<Context> = {}): Context {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "Context",
			name: overrides.name ?? `Context ${id}`,
			short_description: overrides.short_description ?? `Context ${id} summary`,
			long_description:
				overrides.long_description ?? `Detailed context ${id} information`,
			created_date: overrides.created_date ?? new Date().toISOString(),
			goal_id: overrides.goal_id ?? 1,
		};
	},
};

// Comment Factory
export const CommentFactory = {
	create(overrides: Partial<Comment> = {}): Comment {
		const id = overrides.id ?? getNextId();
		const author = overrides.author ?? `user${id}`;

		return {
			id,
			author,
			content: overrides.content ?? `This is comment ${id}`,
			created_at: overrides.created_at ?? new Date().toISOString(),
		};
	},

	createThread(count = 5): Comment[] {
		const users = UserFactory.createBatch(3);

		return Array.from({ length: count }, (_, i) => {
			const user = users[i % users.length];
			return this.create({
				author: `${user.first_name} ${user.last_name}`,
				content: `Thread comment ${i + 1} from ${user.username}`,
				created_at: new Date(
					Date.now() - (count - i) * 60 * 60 * 1000
				).toISOString(),
			});
		});
	},
};

// CaseStudy Factory
export const CaseStudyFactory = {
	create(overrides: Partial<CaseStudy> = {}): CaseStudy {
		const id = overrides.id ?? getNextId();

		return {
			id,
			title: overrides.title ?? `Case Study ${id}`,
			description: overrides.description ?? `Description for case study ${id}`,
			sector: overrides.sector ?? "Technology",
			type: overrides.type ?? "research",
			published: overrides.published ?? false,
			publishedDate: overrides.publishedDate,
			createdOn: overrides.createdOn ?? new Date().toISOString(),
			authors: overrides.authors ?? "Research Team",
			assurance_cases: overrides.assurance_cases ?? [],
			...overrides, // Include any other override properties
		};
	},

	createPublishedWithCases(caseCount = 3): {
		caseStudy: CaseStudy;
		assuranceCases: AssuranceCase[];
	} {
		const assuranceCases = Array.from({ length: caseCount }, () =>
			AssuranceCaseFactory.createPublished()
		);

		const caseStudy = this.create({
			published: true,
			publishedDate: new Date().toISOString(),
			assurance_cases: assuranceCases.map((ac) => ac.id),
			assuranceCases,
		});

		return { caseStudy, assuranceCases };
	},
};

// Template Factory
export const TemplateFactory = {
	create(overrides: Partial<CaseTemplate> = {}): CaseTemplate {
		const id = overrides.id ?? getNextId();

		return {
			id,
			name: overrides.name ?? `Template ${id}`,
			description:
				overrides.description ?? `Template ${id} for quick case creation`,
			structure: overrides.structure ?? {
				goals: [],
				strategies: [],
				property_claims: [],
				contexts: [],
				evidence: [],
			},
			category: overrides.category ?? "General",
			tags: overrides.tags ?? ["template", "starter"],
		};
	},

	createSafetyTemplate(): CaseTemplate {
		return this.create({
			name: "Safety Case Template",
			description: "Standard template for safety-critical systems",
			category: "Safety",
			tags: ["safety", "critical", "template"],
			structure: {
				goals: [
					{
						name: "System is acceptably safe",
						short_description: "Top-level safety goal",
					},
				],
				strategies: [
					{
						name: "Argument over hazards",
						short_description: "Address all identified hazards",
					},
				],
				contexts: [
					{
						name: "System Definition",
						short_description: "Define system boundaries and interfaces",
					},
					{
						name: "Operating Environment",
						short_description: "Define operational context",
					},
				],
				property_claims: [
					{
						name: "Hazards identified",
						short_description: "All hazards have been identified",
						claim_type: "claim",
					},
				],
				evidence: [
					{
						name: "Hazard Analysis Report",
						short_description: "Comprehensive hazard analysis",
					},
				],
			},
		});
	},
};

// Batch creation utilities
export const BatchFactory = {
	createCompleteScenario(): {
		users: User[];
		teams: Team[];
		assuranceCases: AssuranceCase[];
		caseStudies: CaseStudy[];
		permissions: CasePermission[];
	} {
		// Create users with different roles
		const users = [
			UserFactory.createWithRole("Admin"),
			UserFactory.createWithRole("Manager"),
			...UserFactory.createBatch(5),
		];

		// Create teams
		const team1 = TeamFactory.createWithMembers(3);
		const team2 = TeamFactory.createWithMembers(4);
		const teams = [team1.team, team2.team];

		// Create assurance cases with different configurations
		const { assuranceCase: case1 } =
			AssuranceCaseFactory.createWithFullStructure();
		const case2 = AssuranceCaseFactory.createPublished();
		const { assuranceCase: case3, permissions } =
			AssuranceCaseFactory.createWithPermissions([
				{ userId: users[1].id, type: "edit" },
				{ teamId: teams[0].id, type: "view" },
			]);

		const assuranceCases = [case1, case2, case3];

		// Create case studies
		const { caseStudy } = CaseStudyFactory.createPublishedWithCases(2);
		const caseStudies = [caseStudy];

		return {
			users: [...users, ...team1.users, ...team2.users],
			teams,
			assuranceCases,
			caseStudies,
			permissions,
		};
	},

	createTestDataForFeature(
		feature: "collaboration" | "hierarchy" | "permissions"
	) {
		switch (feature) {
			case "collaboration": {
				const { team, members, users } = TeamFactory.createWithMembers(5);
				const { assuranceCase } =
					AssuranceCaseFactory.createWithFullStructure();
				const comments = CommentFactory.createThread(10);

				assuranceCase.comments = comments;
				assuranceCase.editMembers = users.slice(0, 3).map((u) => ({
					id: u.id,
					username: u.username,
					email: u.email,
				}));

				return { team, members, users, assuranceCase, comments };
			}

			case "hierarchy": {
				const assuranceCase = AssuranceCaseFactory.create();
				const goals = GoalFactory.createHierarchy(4, 3);
				const claims = PropertyClaimFactory.createNested(3);

				assuranceCase.goals = goals;
				assuranceCase.property_claims = claims;

				return { assuranceCase, goals, claims };
			}

			case "permissions": {
				const users = UserFactory.createBatch(5);
				const teams = [
					TeamFactory.createWithMembers(3).team,
					TeamFactory.createWithMembers(4).team,
				];

				const { assuranceCase, permissions } =
					AssuranceCaseFactory.createWithPermissions([
						{ userId: users[0].id, type: "manage" },
						{ userId: users[1].id, type: "edit" },
						{ userId: users[2].id, type: "view" },
						{ teamId: teams[0].id, type: "review" },
						{ teamId: teams[1].id, type: "view" },
					]);

				return { users, teams, assuranceCase, permissions };
			}

			default:
				throw new Error(`Unknown feature: ${feature}`);
		}
	},
};

// Export convenience functions for quick access
export const createUser = (overrides?: Partial<User>) =>
	UserFactory.create(overrides);
export const createTeam = (overrides?: Partial<Team>) =>
	TeamFactory.create(overrides);
export const createAssuranceCase = (overrides?: Partial<AssuranceCase>) =>
	AssuranceCaseFactory.create(overrides);
export const createGoal = (overrides?: Partial<Goal>) =>
	GoalFactory.create(overrides);
export const createStrategy = (overrides?: Partial<Strategy>) =>
	StrategyFactory.create(overrides);
export const createPropertyClaim = (overrides?: Partial<PropertyClaim>) =>
	PropertyClaimFactory.create(overrides);
export const createEvidence = (overrides?: Partial<Evidence>) =>
	EvidenceFactory.create(overrides);
export const createContext = (overrides?: Partial<Context>) =>
	ContextFactory.create(overrides);
export const createComment = (overrides?: Partial<Comment>) =>
	CommentFactory.create(overrides);
export const createCaseStudy = (overrides?: Partial<CaseStudy>) =>
	CaseStudyFactory.create(overrides);
