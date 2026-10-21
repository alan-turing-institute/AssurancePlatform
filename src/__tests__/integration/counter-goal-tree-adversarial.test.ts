import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { deleteElement } from "@/lib/services/element-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	addChild,
	addCounterGoal,
	buildArgument,
	type ExportedNode,
	exportIdCounts,
	exportNodes,
	fetchIdCounts,
	fetchNodes,
	linkEvidence,
	ownersOf,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * Where a counter-goal turns up: in the case fetch (beneath the element it
 * challenges), on the canvas (attached to that element's side, with a
 * challenge edge), and in the export (as a child of its parent). Evidence
 * reused beneath its own counter-goal must not make any of them loop.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

async function fetchGoals(ownerId: string, caseId: string) {
	const result = viewed(await fetchCaseFromPrisma(caseId, ownerId));
	if (result.error || !result.data) {
		throw new Error(result.error ?? "no data");
	}
	return result.data;
}

async function exportTree(ownerId: string, caseId: string) {
	const result = viewed(
		await exportCase(ownerId, caseId, { includeComments: false })
	);
	if (result.error || !result.data) {
		throw new Error(result.error ?? "no data");
	}
	return result.data.tree as unknown as ExportedNode;
}

describe("counter-goals with their own branches", () => {
	it("keeps a counter-goal's own strategy, claims and evidence beneath it", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the claim",
			parentId: fx.claim.id,
		});
		const strategy = await addChild(fx, {
			elementType: "STRATEGY",
			name: "S2",
			description: "strategy supporting the counter-goal",
			parentId: counterGoal.id,
		});
		const claim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});
		const deepClaim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P4",
			description: "claim under the counter-goal's strategy",
			parentId: strategy.id,
		});
		const evidence = await createTestElement(fx.caseId, owner.id, {
			elementType: "EVIDENCE",
			name: "E3",
			description: "evidence for the counter-goal's claim",
			url: "https://example.com/e3",
		});
		await linkEvidence(evidence.id, claim.id);

		const data = await fetchGoals(owner.id, fx.caseId);
		const tree = await exportTree(owner.id, fx.caseId);

		const fetched = fetchIdCounts(data.goals);
		const exported = exportIdCounts(tree);
		for (const id of [strategy.id, claim.id, deepClaim.id, evidence.id]) {
			expect(fetched.get(id), `fetch ${id}`).toBe(1);
			expect(exported.get(id), `export ${id}`).toBe(1);
		}
		// Parentage in the fetch.
		const owned = fetchNodes(data.goals).find(
			(node) => node.id === counterGoal.id
		);
		expect(
			(owned?.strategies as { id: string }[]).map((item) => item.id)
		).toEqual([strategy.id]);
		expect(
			(owned?.propertyClaims as { id: string }[]).map((item) => item.id)
		).toEqual([claim.id]);
		// Parentage in the export.
		const exportedGoal = exportNodes(tree).find(
			(node) => node.id === counterGoal.id
		);
		expect(new Set(exportedGoal?.children.map((child) => child.id))).toEqual(
			new Set([strategy.id, claim.id])
		);
	});

	it("keeps a counter-goal against another counter-goal beneath the first", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const outer = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the strategy",
			parentId: fx.strategy.id,
		});
		const inner = await addCounterGoal(fx, {
			name: "CG2",
			description: "counter-goal on the counter-goal",
			parentId: outer.id,
		});
		const innermost = await addCounterGoal(fx, {
			name: "CG3",
			description: "counter-goal on the counter-goal's counter-goal",
			parentId: inner.id,
		});

		const data = await fetchGoals(owner.id, fx.caseId);
		const tree = await exportTree(owner.id, fx.caseId);
		const canvas = convertAssuranceCase(
			data as unknown as Parameters<typeof convertAssuranceCase>[0]
		);

		expect(ownersOf(data.goals, outer.id)).toEqual([fx.strategy.id]);
		expect(ownersOf(data.goals, inner.id)).toEqual([outer.id]);
		expect(ownersOf(data.goals, innermost.id)).toEqual([inner.id]);
		const exported = exportIdCounts(tree);
		for (const goal of [outer, inner, innermost]) {
			expect(exported.get(goal.id), goal.name ?? "").toBe(1);
		}
		const innerNode = canvas.caseNodes.find(
			(node) => node.id === `goal-${inner.id}`
		);
		expect(innerNode?.data.attachedTo).toBe(`goal-${outer.id}`);
		expect(
			canvas.caseEdges.some(
				(edge) =>
					edge.type === "challenges" &&
					edge.source === `goal-${innermost.id}` &&
					edge.target === `goal-${inner.id}`
			)
		).toBe(true);
	});

	it("leaves out a deleted counter-goal and everything that hung from it", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal that is then deleted",
			parentId: fx.claim.id,
		});
		const support = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim under the deleted counter-goal",
			parentId: counterGoal.id,
		});

		const deleted = viewed(await deleteElement(owner.id, counterGoal.id));
		expect(deleted.error).toBeUndefined();

		const data = await fetchGoals(owner.id, fx.caseId);
		const tree = await exportTree(owner.id, fx.caseId);
		for (const id of [counterGoal.id, support.id]) {
			expect(fetchIdCounts(data.goals).has(id), `fetch ${id}`).toBe(false);
			expect(exportIdCounts(tree).has(id), `export ${id}`).toBe(false);
		}
		expect(fetchIdCounts(data.goals).get(fx.claim.id)).toBe(1);
	});
});

describe("export beneath evidence", () => {
	it("builds only goal defeaters beneath a piece of evidence", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the evidence",
			parentId: fx.evidenceOne.id,
		});
		const strays = [
			await createTestElement(fx.caseId, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "CP1",
				description: "claim defeater parented to the evidence",
				parentId: fx.evidenceOne.id,
				isDefeater: true,
				defeatsElementId: fx.evidenceOne.id,
			}),
			await createTestElement(fx.caseId, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name: "P9",
				description: "ordinary claim parented to the evidence",
				parentId: fx.evidenceOne.id,
			}),
			await createTestElement(fx.caseId, owner.id, {
				elementType: "STRATEGY",
				name: "S9",
				description: "strategy parented to the evidence",
				parentId: fx.evidenceOne.id,
			}),
			await createTestElement(fx.caseId, owner.id, {
				elementType: "GOAL",
				name: "G9",
				description: "ordinary goal parented to the evidence",
				parentId: fx.evidenceOne.id,
			}),
		];

		const tree = await exportTree(owner.id, fx.caseId);

		const evidence = exportNodes(tree).find(
			(node) => node.id === fx.evidenceOne.id
		);
		expect(evidence?.children.map((child) => child.id)).toEqual([
			counterGoal.id,
		]);
		const counts = exportIdCounts(tree);
		for (const stray of strays) {
			expect(counts.has(stray.id), stray.name ?? "").toBe(false);
		}
	});

	it("still builds every kind of child beneath a claim, strategy or goal", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the claim",
			parentId: fx.claim.id,
		});
		const nested = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P1.1",
			description: "claim under the claim",
			parentId: fx.claim.id,
		});
		const strategy = await addChild(fx, {
			elementType: "STRATEGY",
			name: "S2",
			description: "strategy under the claim",
			parentId: fx.claim.id,
		});

		const tree = await exportTree(owner.id, fx.caseId);

		const claim = exportNodes(tree).find((node) => node.id === fx.claim.id);
		expect(new Set(claim?.children.map((child) => child.id))).toEqual(
			new Set([
				counterGoal.id,
				nested.id,
				strategy.id,
				fx.evidenceOne.id,
				fx.evidenceShared.id,
			])
		);
	});
});

describe("evidence reused beneath its own counter-goal", () => {
	it("ends when two counter-goals each lead back to the other's evidence", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const evidenceTwo = await createTestElement(fx.caseId, owner.id, {
			elementType: "EVIDENCE",
			name: "E3",
			description: "evidence under the first counter-goal",
			url: "https://example.com/e3",
		});
		const first = await addCounterGoal(fx, {
			name: "CG1",
			description: "first counter-goal, on the first evidence",
			parentId: fx.evidenceOne.id,
		});
		const firstClaim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim under the first counter-goal",
			parentId: first.id,
		});
		await linkEvidence(evidenceTwo.id, firstClaim.id);
		const second = await addCounterGoal(fx, {
			name: "CG2",
			description: "second counter-goal, on the second evidence",
			parentId: evidenceTwo.id,
		});
		const secondClaim = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P4",
			description: "claim under the second counter-goal",
			parentId: second.id,
		});
		// Back to the first evidence, which sits above the whole chain.
		await linkEvidence(fx.evidenceOne.id, secondClaim.id);

		const data = await fetchGoals(owner.id, fx.caseId);
		const tree = await exportTree(owner.id, fx.caseId);

		for (const [source, counts] of [
			["fetch", fetchIdCounts(data.goals)],
			["export", exportIdCounts(tree)],
		] as const) {
			expect(counts.get(first.id), source).toBe(1);
			expect(counts.get(second.id), source).toBe(1);
			expect(counts.get(firstClaim.id), source).toBe(1);
			expect(counts.get(secondClaim.id), source).toBe(1);
			expect(counts.get(evidenceTwo.id), source).toBe(1);
			// Under its own claim and under the chain's last claim.
			expect(counts.get(fx.evidenceOne.id), source).toBe(2);
		}
	});

	it("repeats shared evidence once per claim that links it, with its counter-goal on one copy", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const support = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});

		const data = await fetchGoals(owner.id, fx.caseId);
		const tree = await exportTree(owner.id, fx.caseId);

		for (const [source, counts] of [
			["fetch", fetchIdCounts(data.goals)],
			["export", exportIdCounts(tree)],
		] as const) {
			expect(counts.get(fx.evidenceShared.id), source).toBe(2);
			expect(counts.get(counterGoal.id), source).toBe(1);
			expect(counts.get(support.id), source).toBe(1);
			// Nothing else is repeated.
			for (const id of [
				fx.goal.id,
				fx.claim.id,
				fx.strategy.id,
				fx.strategyClaim.id,
				fx.evidenceOne.id,
			]) {
				expect(counts.get(id), `${source} ${id}`).toBe(1);
			}
		}
	});

	it("draws the counter-goal on shared evidence once, attached to the evidence card, with its own support", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const support = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});

		const data = await fetchGoals(owner.id, fx.caseId);
		const { caseNodes, caseEdges } = convertAssuranceCase(
			data as unknown as Parameters<typeof convertAssuranceCase>[0]
		);

		const evidenceNodeId = `evidence-${fx.evidenceShared.id}`;
		const counterGoalNodeId = `goal-${counterGoal.id}`;
		const supportNodeId = `property-${support.id}`;
		const counterGoalNodes = caseNodes.filter(
			(node) => node.id === counterGoalNodeId
		);
		expect(counterGoalNodes).toHaveLength(1);
		expect(counterGoalNodes[0]?.data.attachedTo).toBe(evidenceNodeId);
		expect(caseNodes.filter((node) => node.id === supportNodeId)).toHaveLength(
			1
		);
		const edgesBetween = (type: string, source: string, target: string) =>
			caseEdges.filter(
				(edge) =>
					edge.type === type && edge.source === source && edge.target === target
			);
		expect(
			edgesBetween("challenges", counterGoalNodeId, evidenceNodeId)
		).toHaveLength(1);
		expect(
			edgesBetween("support", counterGoalNodeId, supportNodeId)
		).toHaveLength(1);
	});
});
