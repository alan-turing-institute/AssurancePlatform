import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createElement, deleteElement } from "@/lib/services/element-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addChild,
	addCounterGoal,
	buildArgument,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Creation rules for a goal-type defeater (counter-goal): it is accepted next
 * to the case's top goal as long as it hangs from something, a second ordinary
 * goal is still refused, and the top goal can be recreated when only
 * counter-goals are left.
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

const create = async (...args: Parameters<typeof createElement>) =>
	viewed(await createElement(...args));

const COUNTER_GOAL_NAME = /^CG\d+$/;
const ORDINARY_GOAL_NAME = /^G\d+$/;

function liveGoals(caseId: string) {
	return prisma.assuranceElement.findMany({
		where: { caseId, elementType: "GOAL", deletedAt: null },
		orderBy: { createdAt: "asc" },
	});
}

async function postElement(
	caseId: string,
	body: Record<string, unknown>
): Promise<Response> {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	const req = new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/elements`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return POST(req, { params: Promise.resolve({ id: caseId }) });
}

describe("counter-goal creation through the service", () => {
	it("accepts a counter-goal against each kind of target while the case has its top goal", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const targets = [
			{ label: "top goal", id: fx.goal.id },
			{ label: "strategy", id: fx.strategy.id },
			{ label: "claim", id: fx.claim.id },
			{ label: "evidence", id: fx.evidenceOne.id },
		];

		for (const target of targets) {
			const result = await create(owner.id, {
				caseId: fx.caseId,
				elementType: "GOAL",
				description: `counter-goal against ${target.label}`,
				parentId: target.id,
				isDefeater: true,
				defeatsElementId: target.id,
			});

			expect(result.error, target.label).toBeUndefined();
			expect(result.data?.isDefeater, target.label).toBe(true);
			expect(result.data?.name, target.label).toMatch(COUNTER_GOAL_NAME);
			expect(result.data?.defeatsElementId, target.label).toBe(target.id);
		}

		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: fx.caseId, elementType: "GOAL", isDefeater: true },
		});
		expect(stored).toHaveLength(targets.length);
		expect(new Set(stored.map((goal) => goal.parentId))).toEqual(
			new Set(targets.map((target) => target.id))
		);
		// Each counter-goal gets its own identifier.
		expect(new Set(stored.map((goal) => goal.name)).size).toBe(targets.length);
		// The top goal is still the only ordinary goal.
		const ordinary = await prisma.assuranceElement.findMany({
			where: { caseId: fx.caseId, elementType: "GOAL", isDefeater: false },
		});
		expect(ordinary.map((goal) => goal.id)).toEqual([fx.goal.id]);
	});

	it("accepts a counter-goal that names no target of its own, as long as it has a parent", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "counter-goal with no stated target",
			parentId: fx.claim.id,
			isDefeater: true,
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.name).toMatch(COUNTER_GOAL_NAME);
	});

	it("accepts a counter-goal against another counter-goal", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const first = await addCounterGoal(fx, {
			name: "CG1",
			description: "first counter-goal",
			parentId: fx.claim.id,
		});

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "counter-goal against the counter-goal",
			parentId: first.id,
			isDefeater: true,
			defeatsElementId: first.id,
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.name).toMatch(COUNTER_GOAL_NAME);
		expect(result.data?.name).not.toBe("CG1");
	});

	it.each([
		["parentId left out", {}],
		["parentId null", { parentId: null }],
		["parentId an empty string", { parentId: "" }],
	])("refuses a counter-goal with no parent (%s)", async (_label, extra) => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const before = await liveGoals(fx.caseId);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "parentless counter-goal",
			isDefeater: true,
			defeatsElementId: fx.goal.id,
			...extra,
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		expect(await liveGoals(fx.caseId)).toHaveLength(before.length);
	});

	it("refuses a parentless counter-goal even in a case that has no goal at all", async () => {
		const owner = await createTestUser();
		const emptyCase = await createTestCase(owner.id);

		const result = await create(owner.id, {
			caseId: emptyCase.id,
			elementType: "GOAL",
			description: "parentless counter-goal in an empty case",
			isDefeater: true,
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		expect(await liveGoals(emptyCase.id)).toHaveLength(0);
	});

	it("refuses a counter-goal whose parent belongs to another case", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const other = await buildArgument(owner.id);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "counter-goal hung from another case",
			parentId: other.claim.id,
			isDefeater: true,
			defeatsElementId: other.claim.id,
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		const goals = await liveGoals(fx.caseId);
		expect(goals.map((goal) => goal.id)).toEqual([fx.goal.id]);
	});

	it("still refuses a second ordinary goal when isDefeater is left out", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "second ordinary goal",
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("still refuses a second ordinary goal when isDefeater is stated as false", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "second ordinary goal, explicit",
			isDefeater: false,
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("still refuses a second ordinary goal that has a parent", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "ordinary goal hung from a claim",
			parentId: fx.claim.id,
			isDefeater: false,
		});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeTruthy();
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("still refuses a second ordinary goal once the case also holds counter-goals", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the claim",
			parentId: fx.claim.id,
		});
		await addCounterGoal(fx, {
			name: "CG2",
			description: "counter-goal on the evidence",
			parentId: fx.evidenceOne.id,
		});

		for (const extra of [{}, { isDefeater: false }]) {
			const result = await create(owner.id, {
				caseId: fx.caseId,
				elementType: "GOAL",
				description: "second ordinary goal beside counter-goals",
				...extra,
			});

			expect(result.data, JSON.stringify(extra)).toBeUndefined();
			expect(result.error, JSON.stringify(extra)).toBeTruthy();
		}

		const ordinary = await prisma.assuranceElement.findMany({
			where: { caseId: fx.caseId, elementType: "GOAL", isDefeater: false },
		});
		expect(ordinary).toHaveLength(1);
	});

	it("does not let a counter-goal in one case change what another case may hold", async () => {
		const owner = await createTestUser();
		const withTop = await buildArgument(owner.id);
		const bare = await createTestCase(owner.id);
		await addCounterGoal(withTop, {
			name: "CG1",
			description: "counter-goal in the other case",
			parentId: withTop.claim.id,
		});

		const result = await create(owner.id, {
			caseId: bare.id,
			elementType: "GOAL",
			description: "the bare case's own top goal",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.name).toMatch(ORDINARY_GOAL_NAME);
	});

	it("accepts an ordinary top goal when only a counter-goal parented to evidence remains", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal that outlives the top goal",
			parentId: fx.evidenceOne.id,
		});

		// Deleting the top goal removes what hangs from it; evidence hangs from
		// claims by link, so the counter-goal under the evidence survives.
		const deleted = viewed(await deleteElement(owner.id, fx.goal.id));
		expect(deleted.error).toBeUndefined();
		const remaining = await liveGoals(fx.caseId);
		expect(remaining.map((goal) => goal.name)).toEqual(["CG1"]);

		const result = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "new top goal",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.name).toMatch(ORDINARY_GOAL_NAME);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: result.data?.id },
		});
		expect(stored.isDefeater).toBe(false);
		expect(stored.parentId).toBeNull();
	});

	it("accepts the new top goal with isDefeater stated as false, and then refuses another", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal that outlives the top goal",
			parentId: fx.evidenceOne.id,
		});
		await deleteElement(owner.id, fx.goal.id);

		const first = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "new top goal",
			isDefeater: false,
		});
		const second = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "GOAL",
			description: "yet another top goal",
			isDefeater: false,
		});

		expect(first.error).toBeUndefined();
		expect(second.data).toBeUndefined();
		expect(second.error).toBeTruthy();
	});

	it("lets a counter-goal support its own strategy and claims under the case's top goal", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal on the claim",
			parentId: fx.claim.id,
		});

		const strategy = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "STRATEGY",
			description: "strategy under the counter-goal",
			parentId: counterGoal.id,
		});
		const claim = await create(owner.id, {
			caseId: fx.caseId,
			elementType: "PROPERTY_CLAIM",
			description: "claim under the counter-goal",
			parentId: counterGoal.id,
		});

		expect(strategy.error).toBeUndefined();
		expect(claim.error).toBeUndefined();
		const stored = await prisma.assuranceElement.findMany({
			where: { parentId: counterGoal.id },
		});
		expect(stored).toHaveLength(2);
	});
});

describe("counter-goal creation through the elements route", () => {
	it("creates a counter-goal against a claim with 201 and stores it with its parent", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postElement(fx.caseId, {
			type: "goal",
			description: "counter-goal against the claim",
			parentId: fx.claim.id,
			isDefeater: true,
			defeatsElementId: fx.claim.id,
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.isDefeater).toBe(true);
		expect(body.name).toMatch(COUNTER_GOAL_NAME);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: body.id },
		});
		expect(stored.parentId).toBe(fx.claim.id);
		expect(stored.defeatsElementId).toBe(fx.claim.id);
		expect(stored.elementType).toBe("GOAL");
	});

	it.each([
		["parentId left out", {}],
		["parentId null", { parentId: null }],
	])("refuses a counter-goal with no parent with a 4xx (%s)", async (_label, extra) => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postElement(fx.caseId, {
			type: "goal",
			description: "parentless counter-goal",
			isDefeater: true,
			defeatsElementId: fx.goal.id,
			...extra,
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("refuses a parentless counter-goal with a 4xx whatever the type field is spelled", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postElement(fx.caseId, {
			elementType: "GOAL",
			description: "parentless counter-goal, upper-case type",
			isDefeater: true,
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("does not accept a second ordinary goal, with isDefeater false or left out", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "another claim",
			parentId: fx.goal.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		for (const extra of [{}, { isDefeater: false }]) {
			const response = await postElement(fx.caseId, {
				type: "goal",
				description: "second ordinary goal",
				...extra,
			});

			expect(response.status, JSON.stringify(extra)).toBeGreaterThanOrEqual(
				400
			);
		}
		expect(await liveGoals(fx.caseId)).toHaveLength(1);
	});

	it("accepts the ordinary top goal when only a counter-goal remains", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal that outlives the top goal",
			parentId: fx.evidenceShared.id,
		});
		await deleteElement(owner.id, fx.goal.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postElement(fx.caseId, {
			type: "goal",
			description: "replacement top goal",
			isDefeater: false,
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.name).toMatch(ORDINARY_GOAL_NAME);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: body.id },
		});
		expect(stored.isDefeater).toBe(false);
		expect(stored.parentId).toBeNull();
	});
});
