import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { addCounterGoal, buildArgument } from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * Only counter-goals hang from a piece of evidence. Export, import and the
 * diagram already treat it that way; the four routes that place an element
 * (create, edit, attach and the JSON editor's batch) refuse anything else, so
 * nothing is stored that the canvas never draws.
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

const REFUSAL =
	"parentId cannot be a piece of evidence unless the element is a counter-goal";

async function postElement(caseId: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function putElement(id: string, body: Record<string, unknown>) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return PUT(
		new NextRequest(`http://localhost:3000/api/elements/${id}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id }) }
	);
}

async function postAttach(id: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/elements/[id]/attach/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/elements/${id}/attach`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id }) }
	);
}

async function postBatch(caseId: string, changes: unknown[]) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify({ changes }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function build() {
	const owner = await createTestUser();
	const fx = await buildArgument(owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, fx };
}

function countElements(caseId: string) {
	return prisma.assuranceElement.count({ where: { caseId } });
}

function newChange(
	type: string,
	parentId: string,
	extra: Record<string, unknown> = {}
) {
	const id = crypto.randomUUID();
	return {
		type: "create",
		elementId: id,
		parentId,
		data: {
			id,
			type,
			name: null,
			description: "made in the batch",
			inSandbox: false,
			...extra,
		},
	};
}

describe("POST /api/cases/[id]/elements beneath evidence", () => {
	it.each([
		{
			label: "a claim defeater",
			body: { elementType: "PROPERTY_CLAIM", isDefeater: true },
		},
		{ label: "a plain claim", body: { elementType: "PROPERTY_CLAIM" } },
		{ label: "a strategy", body: { elementType: "STRATEGY" } },
	])("refuses $label and stores nothing", async ({ body }) => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);

		const response = await postElement(fx.caseId, {
			...body,
			description: "under evidence",
			parentId: fx.evidenceOne.id,
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(REFUSAL);
		expect(await countElements(fx.caseId)).toBe(before);
	});

	it("still accepts a counter-goal", async () => {
		const { fx } = await build();

		const response = await postElement(fx.caseId, {
			elementType: "GOAL",
			isDefeater: true,
			description: "counter-goal under evidence",
			parentId: fx.evidenceOne.id,
			defeatsElementId: fx.evidenceOne.id,
		});

		expect(response.status).toBe(201);
	});
});

describe("PUT /api/elements/[id] beneath evidence", () => {
	it("refuses moving a claim under evidence", async () => {
		const { fx } = await build();

		const response = await putElement(fx.strategyClaim.id, {
			parentId: fx.evidenceOne.id,
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(REFUSAL);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: fx.strategyClaim.id },
		});
		expect(row?.parentId).toBe(fx.strategy.id);
	});

	it("refuses turning a counter-goal under evidence into an ordinary goal", async () => {
		const { fx } = await build();
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal",
			parentId: fx.evidenceOne.id,
		});
		// Remove the top goal so the case could take an ordinary goal: the refusal
		// is then the rule that an ordinary goal has no parent.
		await prisma.assuranceElement.update({
			where: { id: fx.goal.id },
			data: { deletedAt: new Date() },
		});

		const response = await putElement(counterGoal.id, { isDefeater: false });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"parentId cannot be set on the top goal; only a counter-goal has a parent"
		);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: counterGoal.id },
		});
		expect(row?.isDefeater).toBe(true);
	});

	it("still lets an element already stored under evidence be edited", async () => {
		const { owner, fx } = await build();
		const stray = await createTestElement(fx.caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: fx.evidenceOne.id,
			description: "stored before the rule",
		});

		const response = await putElement(stray.id, { description: "edited" });

		expect(response.status).toBe(200);
	});
});

describe("POST /api/elements/[id]/attach beneath evidence", () => {
	it("refuses attaching an element under evidence", async () => {
		const { owner, fx } = await build();
		const orphan = await createTestElement(fx.caseId, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});

		const response = await postAttach(orphan.id, {
			parentId: fx.evidenceOne.id,
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(REFUSAL);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: orphan.id },
		});
		expect(row?.parentId).toBeNull();
		expect(row?.inSandbox).toBe(true);
	});
});

describe("POST /api/cases/[id]/batch beneath evidence", () => {
	it("refuses a create under stored evidence and writes nothing", async () => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);

		const response = await postBatch(fx.caseId, [
			newChange("PROPERTY_CLAIM", fx.evidenceOne.id),
		]);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toContain(REFUSAL);
		expect(await countElements(fx.caseId)).toBe(before);
	});

	it("refuses a create under evidence created in the same batch", async () => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);
		const evidence = newChange("EVIDENCE", fx.claim.id);

		const response = await postBatch(fx.caseId, [
			evidence,
			newChange("STRATEGY", evidence.elementId),
		]);

		expect(response.status).toBe(400);
		expect(await countElements(fx.caseId)).toBe(before);
	});

	it("accepts a counter-goal under evidence", async () => {
		const { fx } = await build();

		const response = await postBatch(fx.caseId, [
			newChange("GOAL", fx.evidenceOne.id, {
				isDefeater: true,
				defeatsElementId: fx.evidenceOne.id,
			}),
		]);

		expect(response.status).toBe(200);
	});

	it("refuses a move under evidence", async () => {
		const { fx } = await build();

		const response = await postBatch(fx.caseId, [
			{
				type: "update",
				elementId: fx.strategyClaim.id,
				data: { parentId: fx.evidenceOne.id },
			},
		]);

		expect(response.status).toBe(400);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: fx.strategyClaim.id },
		});
		expect(row?.parentId).toBe(fx.strategy.id);
	});
});
