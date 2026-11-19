import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { addCounterGoal, buildArgument } from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * The goal rules hold on the routes that used to let them slip: detaching a
 * goal, putting the top goal under another element, restoring a deleted top
 * goal beside a new one, and two writes to the same case at the same moment.
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

function jsonRequest(url: string, method: string, body?: unknown) {
	return new NextRequest(`http://localhost:3000${url}`, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

async function postDetach(id: string) {
	const { POST } = await import("@/app/api/elements/[id]/detach/route");
	return POST(jsonRequest(`/api/elements/${id}/detach`, "POST"), {
		params: Promise.resolve({ id }),
	});
}

async function postRestore(id: string) {
	const { POST } = await import("@/app/api/elements/[id]/restore/route");
	return POST(jsonRequest(`/api/elements/${id}/restore`, "POST"), {
		params: Promise.resolve({ id }),
	});
}

async function putElement(id: string, body: Record<string, unknown>) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return PUT(jsonRequest(`/api/elements/${id}`, "PUT", body), {
		params: Promise.resolve({ id }),
	});
}

async function postBatch(caseId: string, changes: unknown[]) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return POST(jsonRequest(`/api/cases/${caseId}/batch`, "POST", { changes }), {
		params: Promise.resolve({ id: caseId }),
	});
}

async function build() {
	const owner = await createTestUser();
	const fx = await buildArgument(owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, fx };
}

function storedGoal(id: string) {
	return prisma.assuranceElement.findUnique({
		where: { id },
		select: { parentId: true, inSandbox: true, deletedAt: true },
	});
}

describe("POST /api/elements/[id]/detach on a goal", () => {
	it("refuses a counter-goal and changes nothing", async () => {
		const { fx } = await build();
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal",
			parentId: fx.claim.id,
		});

		const response = await postDetach(counterGoal.id);

		expect(response.status).toBe(400);
		expect(await storedGoal(counterGoal.id)).toMatchObject({
			parentId: fx.claim.id,
			inSandbox: false,
		});
	});

	it("refuses the top goal and changes nothing", async () => {
		const { fx } = await build();

		const response = await postDetach(fx.goal.id);

		expect(response.status).toBe(400);
		expect(await storedGoal(fx.goal.id)).toMatchObject({ inSandbox: false });
	});
});

describe("giving the top goal a parent", () => {
	it("is refused by PUT /api/elements/[id]", async () => {
		const { owner, fx } = await build();
		const elsewhere = await createTestElement(fx.caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			inSandbox: true,
		});

		const response = await putElement(fx.goal.id, { parentId: elsewhere.id });

		expect(response.status).toBe(400);
		expect((await storedGoal(fx.goal.id))?.parentId).toBeNull();
	});

	it("is refused by the batch, which writes nothing", async () => {
		const { owner, fx } = await build();
		// A claim outside the goal's own tree, so the move is not a loop.
		const elsewhere = await createTestElement(fx.caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			inSandbox: true,
		});

		const response = await postBatch(fx.caseId, [
			{
				type: "update",
				elementId: fx.goal.id,
				data: { parentId: elsewhere.id },
			},
		]);

		expect(response.status).toBe(400);
		expect((await storedGoal(fx.goal.id))?.parentId).toBeNull();
	});
});

describe("POST /api/elements/[id]/restore on a goal", () => {
	it("answers 422 while the case has another top goal", async () => {
		const { owner, fx } = await build();
		await prisma.assuranceElement.update({
			where: { id: fx.goal.id },
			data: { deletedAt: new Date() },
		});
		await createTestElement(fx.caseId, owner.id, {
			elementType: "GOAL",
			name: "G2",
			description: "a new top goal",
		});

		const response = await postRestore(fx.goal.id);

		expect(response.status).toBe(422);
		expect((await storedGoal(fx.goal.id))?.deletedAt).not.toBeNull();
	});

	it("restores the top goal when the case has no other", async () => {
		const { fx } = await build();
		await prisma.assuranceElement.update({
			where: { id: fx.goal.id },
			data: { deletedAt: new Date() },
		});

		const response = await postRestore(fx.goal.id);

		expect(response.status).toBe(200);
		expect((await storedGoal(fx.goal.id))?.deletedAt).toBeNull();
	});
});

describe("two writes to one case at the same moment", () => {
	it("leave one top goal when several counter-goals are made ordinary together", async () => {
		const { fx } = await build();
		await prisma.assuranceElement.update({
			where: { id: fx.goal.id },
			data: { deletedAt: new Date() },
		});
		const counterGoals: { id: string }[] = [];
		for (const n of [1, 2, 3, 4]) {
			counterGoals.push(
				await addCounterGoal(fx, {
					name: `CG${n}`,
					description: `counter-goal ${n}`,
					parentId: fx.claim.id,
				})
			);
		}

		const responses = await Promise.all(
			counterGoals.map((counterGoal) =>
				putElement(counterGoal.id, { isDefeater: false, parentId: null })
			)
		);

		expect(responses.map((response) => response.status).sort()).toEqual([
			200, 422, 422, 422,
		]);
		const ordinary = await prisma.assuranceElement.count({
			where: {
				caseId: fx.caseId,
				elementType: "GOAL",
				isDefeater: false,
				deletedAt: null,
			},
		});
		expect(ordinary).toBe(1);
	});
});
