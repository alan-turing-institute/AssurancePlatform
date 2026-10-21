import { describe, expect, it } from "vitest";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import prisma from "@/lib/prisma";
import type { TreeNode } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { fetchIdCounts, ownersOf } from "../utils/counter-goal-kit";
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

// ---------------------------------------------------------------------------
// Counter-goals (goal-type defeaters)
// ---------------------------------------------------------------------------

type CounterGoalTarget =
	| "GOAL"
	| "STRATEGY"
	| "PROPERTY_CLAIM"
	| "EVIDENCE"
	| "SHARED_EVIDENCE"
	| "AWAY_GOAL"
	| "MODULE";

const COUNTER_GOAL_TARGETS: CounterGoalTarget[] = [
	"GOAL",
	"STRATEGY",
	"PROPERTY_CLAIM",
	"EVIDENCE",
	"SHARED_EVIDENCE",
	"AWAY_GOAL",
	"MODULE",
];

function findExported(node: TreeNode, id: string): TreeNode | undefined {
	if (node.id === id) {
		return node;
	}
	for (const child of node.children) {
		const found = findExported(child, id);
		if (found) {
			return found;
		}
	}
}

/**
 * A case whose top goal G1 has a counter-goal CG1 attached to an element of
 * the given type, with one claim supporting the counter-goal.
 */
async function createCaseWithCounterGoal(target: CounterGoalTarget) {
	const owner = await createTestUser();
	const referencedCase = await createTestCase(owner.id);
	const testCase = await createTestCase(owner.id);
	const root = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
	});

	let targetElement = root;
	if (target === "EVIDENCE" || target === "SHARED_EVIDENCE") {
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: root.id,
		});
		targetElement = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: targetElement.id, claimId: claim.id },
		});
		if (target === "SHARED_EVIDENCE") {
			// The same evidence under a second claim: drawn and exported under both.
			const other = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P3",
				parentId: root.id,
			});
			await prisma.evidenceLink.create({
				data: { evidenceId: targetElement.id, claimId: other.id },
			});
		}
	} else if (target !== "GOAL") {
		targetElement = await createTestElement(testCase.id, owner.id, {
			elementType: target,
			name: "T1",
			parentId: root.id,
			...(target === "AWAY_GOAL" || target === "MODULE"
				? { moduleReferenceId: referencedCase.id }
				: {}),
			...(target === "MODULE" ? { moduleEmbedType: "COPY" as const } : {}),
		});
	}

	const counter = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "CG1",
		parentId: targetElement.id,
		isDefeater: true,
		defeatsElementId: targetElement.id,
	});
	const support = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: counter.id,
	});
	return { owner, testCase, targetElement, counter, support };
}

async function fetchCanvas(caseId: string, userId: string) {
	const data = expectSuccess(await fetchCaseFromPrisma(caseId, userId));
	return convertAssuranceCase({ ...data, goals: data.goals ?? [] });
}

describe("fetchCaseFromPrisma — counter-goals", () => {
	it.each(
		COUNTER_GOAL_TARGETS
	)("keeps a counter-goal of a %s as a side attachment, with its support", async (target) => {
		const { owner, testCase, targetElement, counter, support } =
			await createCaseWithCounterGoal(target);

		const exported = expectSuccess(await exportCase(owner.id, testCase.id));
		expect(findExported(exported.tree, counter.id)).toMatchObject({
			type: "GOAL",
			isDefeater: true,
			defeatsElementId: targetElement.id,
			children: [expect.objectContaining({ id: support.id })],
		});

		// The fetch holds the counter-goal once, beneath its target alone, even
		// when the target is drawn under several claims.
		const fetched = expectSuccess(
			await fetchCaseFromPrisma(testCase.id, owner.id)
		);
		expect(fetchIdCounts(fetched.goals).get(counter.id)).toBe(1);
		expect(ownersOf(fetched.goals, counter.id)).toEqual([targetElement.id]);

		const { caseNodes, caseEdges } = await fetchCanvas(testCase.id, owner.id);
		// Shared evidence is drawn under each claim that links it, so count the
		// distinct cards.
		expect(new Set(caseNodes.map((node) => node.id)).size).toBe(
			await prisma.assuranceElement.count({ where: { caseId: testCase.id } })
		);
		const targetNode = caseNodes.find(
			(node) => node.data.id === targetElement.id
		);
		const counterNode = caseNodes.find((node) => node.data.id === counter.id);
		expect(counterNode).toMatchObject({
			type: "goal",
			data: {
				isDefeater: true,
				attachedTo: targetNode?.id,
				attachSide: "right",
			},
		});
		expect(caseEdges.filter((edge) => edge.target === counterNode?.id)).toEqual(
			[]
		);
		expect(caseEdges).toContainEqual(
			expect.objectContaining({
				type: "challenges",
				source: counterNode?.id,
				target: targetNode?.id,
			})
		);
		expect(caseEdges).toContainEqual(
			expect.objectContaining({
				type: "support",
				source: counterNode?.id,
				target: `property-${support.id}`,
			})
		);
	});

	it("does not expand a counter-goal again inside itself when its support reuses the evidence", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const root = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: root.id,
		});
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});
		const counter = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "CG1",
			parentId: evidence.id,
			isDefeater: true,
			defeatsElementId: evidence.id,
		});
		const support = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: counter.id,
		});
		await prisma.evidenceLink.createMany({
			data: [
				{ evidenceId: evidence.id, claimId: claim.id },
				{ evidenceId: evidence.id, claimId: support.id },
			],
		});

		const exported = expectSuccess(await exportCase(owner.id, testCase.id));
		expect(findExported(exported.tree, counter.id)?.children[0]).toMatchObject({
			id: support.id,
			children: [expect.objectContaining({ id: evidence.id, children: [] })],
		});

		const { caseNodes } = await fetchCanvas(testCase.id, owner.id);
		expect(
			caseNodes.filter((node) => node.data.id === counter.id)
		).toHaveLength(1);
		expect(caseNodes.some((node) => node.data.id === support.id)).toBe(true);
	});
});
