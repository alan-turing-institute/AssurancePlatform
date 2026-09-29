import { describe, expect, it } from "vitest";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * ADR 0005 D2/D3: `case-fetch-service.ts` admits AWAY_GOAL and MODULE
 * children wherever it admits PROPERTY_CLAIM, and resolves the cited
 * case/element names and viewer accessibility onto each card.
 */

describe("fetchCaseFromPrisma — AWAY_GOAL/MODULE admission (ADR 0005 D3)", () => {
	it("admits an AWAY_GOAL child of a goal, with the cited case and goal name resolved", async () => {
		const owner = await createTestUser();
		const citedCase = await createTestCase(owner.id, { name: "Cited Case" });
		const citedGoal = await createTestElement(citedCase.id, owner.id, {
			elementType: "GOAL",
			name: "CG1",
		});

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: goal.id,
			moduleReferenceId: citedCase.id,
			citedElementId: citedGoal.id,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const awayGoal = data.goals?.[0]?.awayGoals?.[0];
		expect(awayGoal).toBeDefined();
		expect(awayGoal?.name).toBe("AG1");
		expect(awayGoal?.citedCaseName).toBe("Cited Case");
		expect(awayGoal?.citedElementName).toBe("CG1");
		expect(awayGoal?.citedCaseAccessible).toBe(true);
	});

	it("admits a MODULE child of a property claim, with the referenced case name resolved", async () => {
		const owner = await createTestUser();
		const referencedCase = await createTestCase(owner.id, {
			name: "Referenced Case",
		});

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "MODULE",
			name: "M1",
			parentId: claim.id,
			moduleReferenceId: referencedCase.id,
			moduleEmbedType: "COPY",
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const claimResponse = data.goals?.[0]?.propertyClaims?.[0];
		const moduleResponse = claimResponse?.modules?.[0];
		expect(moduleResponse).toBeDefined();
		expect(moduleResponse?.name).toBe("M1");
		expect(moduleResponse?.moduleCaseName).toBe("Referenced Case");
		expect(moduleResponse?.moduleCaseAccessible).toBe(true);
	});

	it("admits an AWAY_GOAL child of a strategy", async () => {
		const owner = await createTestUser();
		const citedCase = await createTestCase(owner.id);
		const citedGoal = await createTestElement(citedCase.id, owner.id, {
			elementType: "GOAL",
			name: "CG1",
		});

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		const strategy = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: goal.id,
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: strategy.id,
			moduleReferenceId: citedCase.id,
			citedElementId: citedGoal.id,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const strategyResponse = data.goals?.[0]?.strategies?.[0];
		expect(strategyResponse?.awayGoals?.[0]?.name).toBe("AG1");
	});

	it("marks the cited case as inaccessible when the viewer lacks permission on it", async () => {
		const owner = await createTestUser();
		const otherOwner = await createTestUser();
		const citedCase = await createTestCase(otherOwner.id);
		const citedGoal = await createTestElement(citedCase.id, otherOwner.id, {
			elementType: "GOAL",
			name: "CG1",
		});

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: goal.id,
			moduleReferenceId: citedCase.id,
			citedElementId: citedGoal.id,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const awayGoal = data.goals?.[0]?.awayGoals?.[0];
		expect(awayGoal?.citedCaseAccessible).toBe(false);
		// The name still resolves — accessibility only gates the link, not the label.
		expect(awayGoal?.citedCaseName).toBe(citedCase.name);
	});

	it("shows the cited case as accessible once it's shared with the viewer", async () => {
		const owner = await createTestUser();
		const otherOwner = await createTestUser();
		const citedCase = await createTestCase(otherOwner.id);
		const citedGoal = await createTestElement(citedCase.id, otherOwner.id, {
			elementType: "GOAL",
			name: "CG1",
		});
		await createTestPermission(citedCase.id, owner.id, otherOwner.id, "VIEW");

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: goal.id,
			moduleReferenceId: citedCase.id,
			citedElementId: citedGoal.id,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		expect(data.goals?.[0]?.awayGoals?.[0]?.citedCaseAccessible).toBe(true);
	});

	it("shows 'cited element not resolved' data (null citedElementId) without failing the fetch", async () => {
		const owner = await createTestUser();
		const citedCase = await createTestCase(owner.id);

		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "AG1",
			parentId: goal.id,
			moduleReferenceId: citedCase.id,
			citedElementId: null,
			citationDangling: true,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const awayGoal = data.goals?.[0]?.awayGoals?.[0];
		expect(awayGoal?.citedElementId).toBeFalsy();
		expect(awayGoal?.citationDangling).toBe(true);
	});

	it("passes isDefeater and defeatsElementId through on a property claim", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: target.id,
			isDefeater: true,
			defeatsElementId: target.id,
		});

		const result = await fetchCaseFromPrisma(testCase.id, owner.id);
		const data = expectSuccess(result);

		const defeater = data.goals?.[0]?.propertyClaims?.[0]?.propertyClaims?.[0];
		expect(defeater?.isDefeater).toBe(true);
		expect(defeater?.defeatsElementId).toBe(target.id);
	});
});
