import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for named context entries through the JSON editor's
 * batch path (POST /api/cases/[id]/batch): the entry rules, the case-wide id
 * rule judged on the state after the whole batch, and an unchanged named entry
 * being left alone.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const WINDOW = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval over which separation is measured",
	value: "5 minutes",
};
const RANGE = {
	id: "p4n8c2d6xz",
	name: "range",
	text: "how far ahead we look",
};

beforeEach(async () => {
	await mockNoAuth();
});

async function postBatch(caseId: string, body: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	const response = await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
	return { response, body: await response.json() };
}

async function setup() {
	const owner = await createTestUser();
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
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase, goal, claim };
}

function updateContext(elementId: string, context: unknown) {
	return { type: "update", elementId, data: { context } };
}

function createClaim(parentId: string, name: string, context: unknown) {
	const id = randomUUID();
	return {
		type: "create",
		elementId: id,
		parentId,
		data: {
			id,
			type: "property_claim",
			name,
			description: "A new claim",
			inSandbox: false,
			context,
		},
	};
}

async function storedContext(elementId: string): Promise<unknown> {
	const row = await prisma.assuranceElement.findUnique({
		where: { id: elementId },
		select: { context: true },
	});
	return row?.context;
}

describe("POST /api/cases/[id]/batch — named context entries", () => {
	it("saves a named entry on an update and on a create", async () => {
		const { testCase, goal } = await setup();
		const create = createClaim(goal.id, "P2", [RANGE]);

		const { response } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, ["plain", WINDOW]), create],
		});

		expect(response.status).toBe(200);
		expect(await storedContext(goal.id)).toEqual(["plain", WINDOW]);
		expect(await storedContext(create.elementId)).toEqual([RANGE]);
	});

	it.each([
		[
			"a name that starts with a digit",
			{ ...WINDOW, name: "5 minutes" },
			"Context entry names must start with a letter and use only letters, digits, spaces, hyphens and underscores",
		],
		[
			"a value of more than 500 characters",
			{ ...WINDOW, value: "v".repeat(501) },
			"Context entry values must be at most 500 characters",
		],
		[
			"a record with no id",
			{ name: "window", text: "x" },
			'A named context entry needs an id, a name and a text; missing "id"',
		],
		[
			"a record with an unexpected key",
			{ ...WINDOW, hidden: false },
			'Unrecognized key: "hidden"',
		],
	])("rejects %s with 400 and a readable message", async (_label, entry, message) => {
		const { testCase, goal } = await setup();

		const { response, body } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, [entry])],
		});

		expect(response.status).toBe(400);
		expect(body.error).toBe(message);
		expect(await storedContext(goal.id)).toEqual([]);
	});

	it("rejects two names that differ only in case on one element", async () => {
		const { testCase, goal } = await setup();

		const { response, body } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, [WINDOW, { ...RANGE, name: "Window" }])],
		});

		expect(response.status).toBe(400);
		expect(body.error).toContain(
			"Context entry names must be unique within an element, ignoring case"
		);
		expect(await storedContext(goal.id)).toEqual([]);
	});

	it("rejects an id that an element outside the batch already uses", async () => {
		const { testCase, goal, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { context: [WINDOW] },
		});

		const { response, body } = await postBatch(testCase.id, {
			changes: [updateContext(claim.id, [{ ...RANGE, id: WINDOW.id }])],
		});

		expect(response.status).toBe(400);
		expect(body.error).toBe(
			`Context entry id "${WINDOW.id}" is used by more than one entry in this case`
		);
		expect(await storedContext(claim.id)).toEqual([]);
	});

	it("rejects an id used by two elements inside the same batch", async () => {
		const { testCase, goal, claim } = await setup();

		const { response, body } = await postBatch(testCase.id, {
			changes: [
				updateContext(goal.id, [WINDOW]),
				updateContext(claim.id, [{ ...RANGE, id: WINDOW.id }]),
			],
		});

		expect(response.status).toBe(400);
		expect(body.error).toContain("is used by more than one entry in this case");
		expect(await storedContext(goal.id)).toEqual([]);
	});

	it("rejects an id that an element in the bin still holds", async () => {
		const { testCase, goal, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { context: [WINDOW], deletedAt: new Date() },
		});

		const { response, body } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, [WINDOW])],
		});

		expect(response.status).toBe(400);
		expect(body.error).toContain("is used by more than one entry in this case");
	});

	it("passes when one batch deletes an element and creates the same entry again", async () => {
		const { testCase, goal, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { context: [WINDOW] },
		});
		const recreated = createClaim(goal.id, "P2", [WINDOW]);

		const { response } = await postBatch(testCase.id, {
			changes: [{ type: "delete", elementId: claim.id }, recreated],
		});

		expect(response.status).toBe(200);
		expect(await storedContext(recreated.elementId)).toEqual([WINDOW]);
	});

	it("passes when one batch removes an entry from one element and puts it on another", async () => {
		const { testCase, goal, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { context: [WINDOW] },
		});

		const { response } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, []), updateContext(claim.id, [WINDOW])],
		});

		expect(response.status).toBe(200);
		expect(await storedContext(goal.id)).toEqual([]);
		expect(await storedContext(claim.id)).toEqual([WINDOW]);
	});

	it("allows the same id in another case", async () => {
		const { owner, testCase, goal } = await setup();
		const otherCase = await createTestCase(owner.id);
		const otherGoal = await createTestElement(otherCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await prisma.assuranceElement.update({
			where: { id: otherGoal.id },
			data: { context: [WINDOW] },
		});

		const { response } = await postBatch(testCase.id, {
			changes: [updateContext(goal.id, [WINDOW])],
		});

		expect(response.status).toBe(200);
	});
});
