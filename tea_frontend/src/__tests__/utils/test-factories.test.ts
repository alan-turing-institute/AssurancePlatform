/**
 * Tests for the test factory functions
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	AssuranceCaseFactory,
	BatchFactory,
	CaseStudyFactory,
	CommentFactory,
	createAssuranceCase,
	createCaseStudy,
	createComment,
	createContext,
	createEvidence,
	createGoal,
	createPropertyClaim,
	createStrategy,
	createTeam,
	createUser,
	EvidenceFactory,
	GoalFactory,
	PropertyClaimFactory,
	resetIdCounter,
	TeamFactory,
	TemplateFactory,
	UserFactory,
} from "./test-factories";

describe("Test Factories", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	describe("UserFactory", () => {
		it("creates a user with default values", () => {
			const user = UserFactory.create();

			expect(user).toMatchObject({
				id: 1,
				username: "user1",
				email: "user1@example.com",
				first_name: "User1",
				last_name: "Last1",
				auth_provider: "github",
				auth_username: "user1",
			});
		});

		it("creates a user with custom values", () => {
			const user = UserFactory.create({
				username: "customuser",
				email: "custom@test.com",
			});

			expect(user.username).toBe("customuser");
			expect(user.email).toBe("custom@test.com");
		});

		it("creates multiple users", () => {
			const users = UserFactory.createBatch(3);

			expect(users).toHaveLength(3);
			expect(users[0].id).toBe(1);
			expect(users[1].id).toBe(2);
			expect(users[2].id).toBe(3);
		});

		it("creates a user with a specific role", () => {
			const admin = UserFactory.createWithRole("Admin");

			expect(admin.username).toBe("admin_user");
			expect(admin.first_name).toBe("Admin");
			expect(admin.email).toBe("admin@example.com");
		});
	});

	describe("TeamFactory", () => {
		it("creates a team with members", () => {
			const { team, members, users } = TeamFactory.createWithMembers(4);

			expect(team.members).toHaveLength(4);
			expect(members).toHaveLength(4);
			expect(users).toHaveLength(4);

			expect(members[0].role).toBe("owner");
			expect(members[1].role).toBe("admin");
			expect(members[2].role).toBe("member");
			expect(members[3].role).toBe("member");
		});
	});

	describe("AssuranceCaseFactory", () => {
		it("creates a basic assurance case", () => {
			const assuranceCase = AssuranceCaseFactory.create();

			expect(assuranceCase).toMatchObject({
				id: expect.any(Number),
				type: "AssuranceCase",
				name: expect.stringContaining("Assurance Case"),
				published: false,
				permissions: "manage",
			});
		});

		it("creates an assurance case with full structure", () => {
			const {
				assuranceCase,
				goals,
				strategies,
				propertyClaims,
				evidence,
				contexts,
			} = AssuranceCaseFactory.createWithFullStructure();

			expect(goals).toHaveLength(3);
			expect(strategies).toHaveLength(1);
			expect(propertyClaims).toHaveLength(2);
			expect(evidence).toHaveLength(2);
			expect(contexts).toHaveLength(2);

			expect(assuranceCase.goals).toEqual(goals);
			expect(assuranceCase.strategies).toEqual(strategies);
			expect(assuranceCase.property_claims).toEqual(propertyClaims);
			expect(assuranceCase.evidence).toEqual(evidence);
			expect(assuranceCase.contexts).toEqual(contexts);
		});

		it("creates a published assurance case", () => {
			const published = AssuranceCaseFactory.createPublished();

			expect(published.published).toBe(true);
			expect(published.published_date).toBeTruthy();
		});

		it("creates an assurance case with permissions", () => {
			const { assuranceCase, permissions, users } =
				AssuranceCaseFactory.createWithPermissions([
					{ type: "edit" },
					{ type: "view" },
				]);

			expect(permissions).toHaveLength(2);
			expect(users).toHaveLength(2);
			expect(permissions[0].permission_type).toBe("edit");
			expect(permissions[1].permission_type).toBe("view");
		});
	});

	describe("GoalFactory", () => {
		it("creates a hierarchical goal structure", () => {
			const goals = GoalFactory.createHierarchy(3, 2);

			// With depth 3 and breadth 2, we should have:
			// 2 top-level + 4 second-level + 8 third-level = 14 goals
			expect(goals).toHaveLength(14);
		});
	});

	describe("PropertyClaimFactory", () => {
		it("creates nested property claims", () => {
			const claims = PropertyClaimFactory.createNested(3);

			expect(claims).toHaveLength(3);
			expect(claims[0].level).toBe(1);
			expect(claims[1].level).toBe(2);
			expect(claims[2].level).toBe(3);

			expect(claims[1].property_claim_id).toBe(claims[0].id);
			expect(claims[2].property_claim_id).toBe(claims[1].id);
		});
	});

	describe("EvidenceFactory", () => {
		it("creates evidence for a specific claim", () => {
			const claimId = 42;
			const evidenceList = EvidenceFactory.createForClaim(claimId, 3);

			expect(evidenceList).toHaveLength(3);
			evidenceList.forEach((evidence) => {
				expect(evidence.property_claim_id).toContain(claimId);
			});
		});
	});

	describe("CommentFactory", () => {
		it("creates a comment thread", () => {
			const thread = CommentFactory.createThread(5);

			expect(thread).toHaveLength(5);

			// Comments should be in chronological order
			for (let i = 1; i < thread.length; i++) {
				const prevDate = new Date(thread[i - 1].created_at);
				const currDate = new Date(thread[i].created_at);
				expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
			}
		});
	});

	describe("CaseStudyFactory", () => {
		it("creates a published case study with assurance cases", () => {
			const { caseStudy, assuranceCases } =
				CaseStudyFactory.createPublishedWithCases(3);

			expect(caseStudy.published).toBe(true);
			expect(caseStudy.publishedDate).toBeTruthy();
			expect(assuranceCases).toHaveLength(3);
			expect(caseStudy.assurance_cases).toHaveLength(3);

			assuranceCases.forEach((ac) => {
				expect(ac.published).toBe(true);
			});
		});
	});

	describe("TemplateFactory", () => {
		it("creates a safety template", () => {
			const template = TemplateFactory.createSafetyTemplate();

			expect(template.name).toBe("Safety Case Template");
			expect(template.category).toBe("Safety");
			expect(template.tags).toContain("safety");

			expect(template.structure.goals).toHaveLength(1);
			expect(template.structure.strategies).toHaveLength(1);
			expect(template.structure.contexts).toHaveLength(2);
			expect(template.structure.property_claims).toHaveLength(1);
			expect(template.structure.evidence).toHaveLength(1);
		});
	});

	describe("BatchFactory", () => {
		it("creates a complete scenario", () => {
			const scenario = BatchFactory.createCompleteScenario();

			expect(scenario.users.length).toBeGreaterThan(0);
			expect(scenario.teams).toHaveLength(2);
			expect(scenario.assuranceCases).toHaveLength(3);
			expect(scenario.caseStudies).toHaveLength(1);
			expect(scenario.permissions.length).toBeGreaterThan(0);
		});

		it("creates test data for collaboration feature", () => {
			const data = BatchFactory.createTestDataForFeature("collaboration");

			expect(data.team).toBeDefined();
			expect(data.members).toHaveLength(5);
			expect(data.users).toHaveLength(5);
			expect(data.assuranceCase).toBeDefined();
			expect(data.comments).toHaveLength(10);
		});

		it("creates test data for hierarchy feature", () => {
			const data = BatchFactory.createTestDataForFeature("hierarchy");

			expect(data.assuranceCase).toBeDefined();
			expect(data.goals?.length).toBeGreaterThan(0);
			expect(data.claims).toHaveLength(3);
		});

		it("creates test data for permissions feature", () => {
			const data = BatchFactory.createTestDataForFeature("permissions");

			expect(data.users).toHaveLength(5);
			expect(data.teams).toHaveLength(2);
			expect(data.permissions).toHaveLength(5);

			const permissionTypes =
				data.permissions?.map((p) => p.permission_type) ?? [];
			expect(permissionTypes).toContain("manage");
			expect(permissionTypes).toContain("edit");
			expect(permissionTypes).toContain("view");
			expect(permissionTypes).toContain("review");
		});
	});

	describe("Convenience functions", () => {
		it("provides quick access functions", () => {
			const user = createUser({ username: "quick" });
			const team = createTeam({ name: "Quick Team" });
			const assuranceCase = createAssuranceCase({ name: "Quick Case" });
			const goal = createGoal({ name: "Quick Goal" });
			const strategy = createStrategy({ name: "Quick Strategy" });
			const claim = createPropertyClaim({ name: "Quick Claim" });
			const evidence = createEvidence({ name: "Quick Evidence" });
			const context = createContext({ name: "Quick Context" });
			const comment = createComment({ content: "Quick Comment" });
			const caseStudy = createCaseStudy({ title: "Quick Study" });

			expect(user.username).toBe("quick");
			expect(team.name).toBe("Quick Team");
			expect(assuranceCase.name).toBe("Quick Case");
			expect(goal.name).toBe("Quick Goal");
			expect(strategy.name).toBe("Quick Strategy");
			expect(claim.name).toBe("Quick Claim");
			expect(evidence.name).toBe("Quick Evidence");
			expect(context.name).toBe("Quick Context");
			expect(comment.content).toBe("Quick Comment");
			expect(caseStudy.title).toBe("Quick Study");
		});
	});
});
