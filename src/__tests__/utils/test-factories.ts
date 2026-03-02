/**
 * Advanced factory functions for creating complex test data structures
 * These factories provide realistic, interconnected data for integration tests
 */

import type {
	AssuranceCase,
	CaseStudy,
	Comment,
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
		propertyClaims: Partial<PropertyClaim>[];
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
		const id = (overrides.id ?? String(getNextId())) as string;
		const owner = overrides.owner ?? UserFactory.create().id;
		const currentDate = new Date().toISOString();

		const defaults = {
			type: "AssuranceCase" as const,
			name: `Assurance Case ${id}`,
			description: `Comprehensive assurance case ${id} for testing`,
			createdDate: currentDate,
			colourProfile: "default",
			published: false,
			permissions: "manage" as const,
			comments: [],
			goals: [],
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
	} {
		const assuranceCase = this.create();
		const caseId = assuranceCase.id;

		// Create hierarchical structure
		const numericCaseId = Number(caseId);
		const topGoal = GoalFactory.create({
			assuranceCaseId: numericCaseId,
			name: "Top-Level Safety Goal",
		});

		const strategy = StrategyFactory.create({
			goalId: topGoal.id,
			name: "Argument by Component Safety",
		});

		const subGoals = [
			GoalFactory.create({
				assuranceCaseId: numericCaseId,
				name: "Component A Safety",
			}),
			GoalFactory.create({
				assuranceCaseId: numericCaseId,
				name: "Component B Safety",
			}),
		];

		const propertyClaims = [
			PropertyClaimFactory.create({
				goalId: subGoals[0].id,
				name: "Component A Reliability",
				claimType: "claim",
				level: 1,
			}),
			PropertyClaimFactory.create({
				goalId: subGoals[1].id,
				name: "Component B Performance",
				claimType: "claim",
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
		evidence[0].propertyClaimId = [propertyClaims[0].id];
		evidence[1].propertyClaimId = [propertyClaims[1].id];

		// Update assurance case with top-level goals
		assuranceCase.goals = [topGoal, ...subGoals];

		return {
			assuranceCase,
			goals: [topGoal, ...subGoals],
			strategies: [strategy],
			propertyClaims,
			evidence,
		};
	},

	createPublished(overrides: Partial<AssuranceCase> = {}): AssuranceCase {
		return this.create({
			...overrides,
			published: true,
			publishedAt: new Date().toISOString(),
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
				case: Number(assuranceCase.id),
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
			type: overrides.type ?? "goal",
			name: overrides.name ?? `Goal ${id}`,
			description: overrides.description ?? `Description for goal ${id}`,
			keywords: overrides.keywords ?? "safety, reliability, testing",
			assuranceCaseId: overrides.assuranceCaseId ?? 1,
			context: overrides.context ?? [],
			propertyClaims: overrides.propertyClaims ?? [],
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
			type: overrides.type ?? "strategy",
			name: overrides.name ?? `Strategy ${id}`,
			description: overrides.description ?? `Description for strategy ${id}`,
			goalId: overrides.goalId ?? 1,
			propertyClaims: overrides.propertyClaims ?? [],
		};
	},
};

// PropertyClaim Factory
export const PropertyClaimFactory = {
	create(overrides: Partial<PropertyClaim> = {}): PropertyClaim {
		const id = overrides.id ?? getNextId();

		return {
			id,
			type: overrides.type ?? "property_claim",
			name: overrides.name ?? `Property Claim ${id}`,
			description: overrides.description ?? `Description for claim ${id}`,
			goalId: overrides.goalId ?? null,
			propertyClaimId: overrides.propertyClaimId ?? null,
			level: overrides.level ?? 1,
			claimType: overrides.claimType ?? "claim",
			propertyClaims: overrides.propertyClaims ?? [],
			evidence: overrides.evidence ?? [],
			strategyId: overrides.strategyId ?? null,
		};
	},

	createNested(levels = 3): PropertyClaim[] {
		const claims: PropertyClaim[] = [];
		let parentId: number | null = null;

		for (let level = 1; level <= levels; level++) {
			const claim = this.create({
				name: `Level ${level} Claim`,
				level,
				propertyClaimId: parentId,
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
			type: overrides.type ?? "evidence",
			name: overrides.name ?? `Evidence ${id}`,
			description: overrides.description ?? `Description for evidence ${id}`,
			URL: overrides.URL ?? `https://example.com/evidence/${id}`,
			propertyClaimId: overrides.propertyClaimId ?? [],
		};
	},

	createForClaim(claimId: number, count = 3): Evidence[] {
		return Array.from({ length: count }, (_, i) =>
			this.create({
				name: `Evidence ${i + 1} for Claim ${claimId}`,
				propertyClaimId: [claimId],
			})
		);
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
			createdAt: overrides.createdAt ?? new Date().toISOString(),
		};
	},

	createThread(count = 5): Comment[] {
		const users = UserFactory.createBatch(3);

		return Array.from({ length: count }, (_, i) => {
			const user = users[i % users.length];
			return this.create({
				author: `${user.first_name} ${user.last_name}`,
				content: `Thread comment ${i + 1} from ${user.username}`,
				createdAt: new Date(
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
			assuranceCases: overrides.assuranceCases ?? [],
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
				propertyClaims: [],
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
						description: "Top-level safety goal",
					},
				],
				strategies: [
					{
						name: "Argument over hazards",
						description: "Address all identified hazards",
					},
				],
				propertyClaims: [
					{
						name: "Hazards identified",
						description: "All hazards have been identified",
						claimType: "claim",
					},
				],
				evidence: [
					{
						name: "Hazard Analysis Report",
						description: "Comprehensive hazard analysis",
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
export const createComment = (overrides?: Partial<Comment>) =>
	CommentFactory.create(overrides);
export const createCaseStudy = (overrides?: Partial<CaseStudy>) =>
	CaseStudyFactory.create(overrides);
