import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for named context entries on the two single-element
 * write routes (PUT /api/elements/[id], POST /api/cases/[id]/elements) and for
 * reading them back. Each rule is checked through the route, so the status and
 * body are what a client actually gets.
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

function put(elementId: string, body: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
		method: "PUT",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

function post(caseId: string, body: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

async function putContext(elementId: string, context: unknown) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	const response = await PUT(put(elementId, { context }), {
		params: Promise.resolve({ id: elementId }),
	});
	return { response, body: await response.json() };
}

async function postGoal(caseId: string, context: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	const response = await POST(
		post(caseId, { type: "goal", description: "A new goal", context }),
		{ params: Promise.resolve({ id: caseId }) }
	);
	return { response, body: await response.json() };
}

async function storedContext(elementId: string): Promise<unknown> {
	const row = await prisma.assuranceElement.findUnique({
		where: { id: elementId },
		select: { context: true },
	});
	return row?.context;
}

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase, goal };
}

describe("PUT /api/elements/[id] — named context entries", () => {
	it("saves a named entry next to plain text and returns both", async () => {
		const { goal } = await setup();

		const { response, body } = await putContext(goal.id, ["plain", WINDOW]);

		expect(response.status).toBe(200);
		expect(body.context).toEqual(["plain", WINDOW]);
		expect(await storedContext(goal.id)).toEqual(["plain", WINDOW]);
	});

	it("trims the name it stores", async () => {
		const { goal } = await setup();

		const { response, body } = await putContext(goal.id, [
			{ ...WINDOW, name: "  window  " },
		]);

		expect(response.status).toBe(200);
		expect(body.context[0].name).toBe("window");
	});

	it("reads back only the four fields of a stored entry, whatever else the row holds", async () => {
		const { goal } = await setup();
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { context: [{ ...WINDOW, hidden: false }] },
		});
		const { GET } = await import("@/app/api/elements/[id]/route");

		const response = await GET(
			new NextRequest(`http://localhost:3000/api/elements/${goal.id}`),
			{ params: Promise.resolve({ id: goal.id }) }
		);

		expect(response.status).toBe(200);
		expect((await response.json()).context).toEqual([WINDOW]);
	});

	it.each([
		[
			"a name that starts with a digit",
			{ ...WINDOW, name: "5 minutes" },
			"Context entry names must start with a letter and use only letters, digits, spaces, hyphens and underscores",
		],
		[
			"a name of more than 40 characters",
			{ ...WINDOW, name: "a".repeat(41) },
			"Context entry names must be at most 40 characters",
		],
		[
			"a value of more than 500 characters",
			{ ...WINDOW, value: "v".repeat(501) },
			"Context entry values must be at most 500 characters",
		],
		[
			"an id that is not ten lowercase letters or digits",
			{ ...WINDOW, id: "WINDOW" },
			"Context entry ids must be 10 lowercase letters or digits",
		],
		[
			"a record with no name",
			{ id: WINDOW.id, text: WINDOW.text },
			'A named context entry needs an id, a name and a text; missing "name"',
		],
		[
			"a record with an unexpected key",
			{ ...WINDOW, hidden: false },
			'Unrecognized key: "hidden"',
		],
		[
			"an entry that is neither text nor a record",
			42,
			"A context entry must be a piece of text or a named entry with an id, a name, a text and an optional value",
		],
	])("rejects %s with 400 and a readable message", async (_label, entry, message) => {
		const { goal } = await setup();

		const { response, body } = await putContext(goal.id, [entry]);

		expect(response.status).toBe(400);
		expect(body.error).toBe(message);
		expect(await storedContext(goal.id)).toEqual([]);
	});

	it("rejects two names that differ only in case, and stores nothing", async () => {
		const { goal } = await setup();

		const { response, body } = await putContext(goal.id, [
			{ ...WINDOW, name: "Window" },
			{ ...RANGE, name: "window" },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toBe(
			'Context entry names must be unique within an element, ignoring case: "Window" and "window" both appear'
		);
		expect(await storedContext(goal.id)).toEqual([]);
	});

	it("allows the same name on two different elements", async () => {
		const { owner, testCase, goal } = await setup();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});

		const first = await putContext(goal.id, [WINDOW]);
		const second = await putContext(claim.id, [{ ...RANGE, name: "window" }]);

		expect(first.response.status).toBe(200);
		expect(second.response.status).toBe(200);
	});

	it("rejects an id used twice on the same element", async () => {
		const { goal } = await setup();

		const { response, body } = await putContext(goal.id, [
			WINDOW,
			{ ...RANGE, id: WINDOW.id },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toBe(
			`Context entry id "${WINDOW.id}" is used by more than one entry on the same element`
		);
	});

	it("rejects an id that another element of the case already uses", async () => {
		const { owner, testCase, goal } = await setup();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await putContext(goal.id, [WINDOW]);

		const { response, body } = await putContext(claim.id, [
			{ ...RANGE, id: WINDOW.id },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toBe(
			`Context entry id "${WINDOW.id}" is used by more than one entry in this case`
		);
		expect(await storedContext(claim.id)).toEqual([]);
	});

	it("counts an element in the bin when it checks an id", async () => {
		const { owner, testCase, goal } = await setup();
		const binned = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await prisma.assuranceElement.update({
			where: { id: binned.id },
			data: { context: [WINDOW], deletedAt: new Date() },
		});

		const { response, body } = await putContext(goal.id, [WINDOW]);

		expect(response.status).toBe(400);
		expect(body.error).toContain("is used by more than one entry in this case");
	});

	it("allows the same id in a different case", async () => {
		const { owner, goal } = await setup();
		const otherCase = await createTestCase(owner.id);
		const otherGoal = await createTestElement(otherCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await putContext(goal.id, [WINDOW]);

		const { response } = await putContext(otherGoal.id, [WINDOW]);

		expect(response.status).toBe(200);
	});

	it("lets an element keep its own entry when it saves again", async () => {
		const { goal } = await setup();
		await putContext(goal.id, [WINDOW]);

		const { response, body } = await putContext(goal.id, [
			{ ...WINDOW, text: "a clearer meaning" },
			RANGE,
		]);

		expect(response.status).toBe(200);
		expect(body.context[0].text).toBe("a clearer meaning");
	});
});

describe("POST /api/cases/[id]/elements — named context entries", () => {
	it("creates an element with a named entry and returns it", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { response, body } = await postGoal(testCase.id, ["plain", WINDOW]);

		expect(response.status).toBe(201);
		expect(body.context).toEqual(["plain", WINDOW]);
		expect(await storedContext(body.id)).toEqual(["plain", WINDOW]);
	});

	it("rejects a bad name with 400 and creates nothing", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { response, body } = await postGoal(testCase.id, [
			{ ...WINDOW, name: "#window" },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toBe(
			"Context entry names must start with a letter and use only letters, digits, spaces, hyphens and underscores"
		);
		expect(
			await prisma.assuranceElement.count({ where: { caseId: testCase.id } })
		).toBe(0);
	});

	it("rejects an entry with an unexpected key with 400", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { response, body } = await postGoal(testCase.id, [
			{ ...WINDOW, hidden: false },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toBe('Unrecognized key: "hidden"');
	});

	it("rejects two names that differ only in case with 400", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { response, body } = await postGoal(testCase.id, [
			WINDOW,
			{ ...RANGE, name: "WINDOW" },
		]);

		expect(response.status).toBe(400);
		expect(body.error).toContain(
			"Context entry names must be unique within an element, ignoring case"
		);
		expect(
			await prisma.assuranceElement.count({ where: { caseId: testCase.id } })
		).toBe(0);
	});

	it("rejects an id that an element of the case already uses", async () => {
		const { testCase, goal } = await setup();
		await putContext(goal.id, [WINDOW]);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const response = await POST(
			post(testCase.id, {
				type: "strategy",
				description: "A strategy",
				parentId: goal.id,
				context: [WINDOW],
			}),
			{ params: Promise.resolve({ id: testCase.id }) }
		);

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			`Context entry id "${WINDOW.id}" is used by more than one entry in this case`
		);
	});
});

describe("GET /api/cases/[id] — named context entries", () => {
	it("returns the named entries of each element with only their four fields", async () => {
		const { owner, testCase, goal } = await setup();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await prisma.assuranceElement.update({
			where: { id: goal.id },
			data: { context: ["plain", { ...WINDOW, hidden: false }] },
		});
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { context: [RANGE] },
		});
		const { GET } = await import("@/app/api/cases/[id]/route");

		const response = await GET(
			new NextRequest(`http://localhost:3000/api/cases/${testCase.id}`),
			{ params: Promise.resolve({ id: testCase.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.goals[0].context).toEqual(["plain", WINDOW]);
		expect(body.goals[0].propertyClaims[0].context).toEqual([RANGE]);
	});
});

describe("activity notices for an element with no label", () => {
	async function setupUnlabelled() {
		const { owner, testCase, goal } = await setup();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: {
				name: null,
				description: `Separation holds within the {win#${WINDOW.id}}.`,
			},
		});
		vi.mocked(emitSSEEvent).mockClear();
		return { testCase, claim };
	}

	const PLAIN_NAME = "Separation holds within the {win}.";

	it("writes the references in the description as {name} when an element is deleted", async () => {
		const { testCase, claim } = await setupUnlabelled();
		const { DELETE } = await import("@/app/api/elements/[id]/route");

		const response = await DELETE(
			new NextRequest(`http://localhost:3000/api/elements/${claim.id}`, {
				method: "DELETE",
			}),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(200);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"element:deleted",
			testCase.id,
			expect.objectContaining({ elementName: PLAIN_NAME })
		);
	});

	it("writes the references in the description as {name} when an element is restored", async () => {
		const { testCase, claim } = await setupUnlabelled();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});
		const { POST } = await import("@/app/api/elements/[id]/restore/route");

		const response = await POST(
			new NextRequest(
				`http://localhost:3000/api/elements/${claim.id}/restore`,
				{ method: "POST" }
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(200);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"element:restored",
			testCase.id,
			expect.objectContaining({ elementName: PLAIN_NAME })
		);
	});

	it("writes the references in the description as {name} when a comment is added", async () => {
		const { testCase, claim } = await setupUnlabelled();
		const { POST } = await import("@/app/api/elements/[id]/comments/route");

		const response = await POST(
			new NextRequest(
				`http://localhost:3000/api/elements/${claim.id}/comments`,
				{
					method: "POST",
					body: JSON.stringify({ content: "Looks right" }),
					headers: { "Content-Type": "application/json" },
				}
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(201);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"comment:created",
			testCase.id,
			expect.objectContaining({ elementName: PLAIN_NAME })
		);
	});
});
