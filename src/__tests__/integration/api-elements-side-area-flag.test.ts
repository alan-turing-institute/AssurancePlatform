import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { detachElement } from "@/lib/services/element-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The general edit and the batch never move an element into or out of the side
 * area. A flag equal to the stored one is accepted and ignored; any other value
 * answers 400 and names the detach or attach route.
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

const MISSING_ID = "00000000-0000-0000-0000-000000000000";
const SET_MESSAGE =
	"inSandbox cannot be set on the general edit; use the detach route";
const CLEAR_MESSAGE =
	"inSandbox cannot be cleared on the general edit; use the attach route";

async function putElement(elementId: string, body: unknown) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return await PUT(
		new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

async function postBatch(caseId: string, body: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function build() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const strategy = await createTestElement(testCase.id, owner.id, {
		elementType: "STRATEGY",
		name: "S1",
		parentId: goal.id,
	});
	return { owner, testCase, goal, strategy };
}

const stored = (id: string) =>
	prisma.assuranceElement.findUnique({
		where: { id },
		select: { inSandbox: true, parentId: true, description: true },
	});

describe("PUT /api/elements/[id] — inSandbox", () => {
	it("refuses to set the flag on a strategy and changes nothing", async () => {
		const { owner, goal, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(strategy.id, { inSandbox: true });

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(SET_MESSAGE);
		expect(body.code).toBe("VALIDATION");
		expect(await stored(strategy.id)).toMatchObject({
			inSandbox: false,
			parentId: goal.id,
		});
	});

	it("refuses to set the flag on the top goal", async () => {
		const { owner, goal } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(goal.id, { inSandbox: true });

		expect(response.status).toBe(400);
		expect((await stored(goal.id))?.inSandbox).toBe(false);
	});

	it("refuses to set the flag on a counter-goal and keeps its parent", async () => {
		const { owner, testCase, goal } = await build();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: goal.id,
		});
		const counterGoal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			isDefeater: true,
			parentId: claim.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(counterGoal.id, { inSandbox: true });

		expect(response.status).toBe(400);
		expect(await stored(counterGoal.id)).toMatchObject({
			inSandbox: false,
			parentId: claim.id,
		});
	});

	it("refuses to set the flag on linked evidence and keeps the link", async () => {
		const { owner, testCase, goal } = await build();
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: goal.id,
		});
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: evidence.id, claimId: claim.id },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(evidence.id, { inSandbox: true });

		expect(response.status).toBe(400);
		expect((await stored(evidence.id))?.inSandbox).toBe(false);
		expect(
			await prisma.evidenceLink.count({ where: { evidenceId: evidence.id } })
		).toBe(1);
	});

	it("refuses to clear the flag on a detached strategy and names the attach route", async () => {
		const { owner, strategy } = await build();
		expect(await detachElement(owner.id, strategy.id)).toHaveProperty("data");
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(strategy.id, { inSandbox: false });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(CLEAR_MESSAGE);
		expect(await stored(strategy.id)).toMatchObject({
			inSandbox: true,
			parentId: null,
		});
	});

	it("accepts the stored flag with another change and leaves the flag alone", async () => {
		const { owner, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const inTree = await putElement(strategy.id, {
			inSandbox: false,
			description: "Edited in the tree",
		});
		expect(inTree.status).toBe(200);
		expect(await stored(strategy.id)).toMatchObject({
			inSandbox: false,
			description: "Edited in the tree",
		});

		expect(await detachElement(owner.id, strategy.id)).toHaveProperty("data");
		const detached = await putElement(strategy.id, {
			inSandbox: true,
			description: "Edited in the side area",
		});
		expect(detached.status).toBe(200);
		expect(await stored(strategy.id)).toMatchObject({
			inSandbox: true,
			description: "Edited in the side area",
		});
	});

	it("refuses the flag for a person with direct EDIT and for a team member with EDIT", async () => {
		const { owner, testCase, strategy } = await build();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);
		expect((await putElement(strategy.id, { inSandbox: true })).status).toBe(
			400
		);

		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "MEMBER");
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(member.id, member.username, member.email);
		expect((await putElement(strategy.id, { inSandbox: true })).status).toBe(
			400
		);
		expect((await stored(strategy.id))?.inSandbox).toBe(false);
	});

	it("answers 404 to a person with only a VIEW share, 401 signed out, 404 for a missing element", async () => {
		const { owner, testCase, strategy } = await build();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);
		expect((await putElement(strategy.id, { inSandbox: true })).status).toBe(
			404
		);
		expect((await stored(strategy.id))?.inSandbox).toBe(false);

		await mockAuth(owner.id, owner.username, owner.email);
		expect((await putElement(MISSING_ID, { inSandbox: true })).status).toBe(
			404
		);

		await mockNoAuth();
		expect((await putElement(strategy.id, { inSandbox: true })).status).toBe(
			401
		);
	});
});

describe("POST /api/cases/[id]/batch — inSandbox", () => {
	it("refuses an update that sets the flag and stores nothing", async () => {
		const { owner, testCase, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: strategy.id,
					data: { inSandbox: true },
				},
			],
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			`inSandbox cannot be changed in a batch; use the detach or attach route (element ${strategy.id})`
		);
		expect((await stored(strategy.id))?.inSandbox).toBe(false);
	});

	it("refuses an update that clears the flag on a detached element", async () => {
		const { owner, testCase, strategy } = await build();
		expect(await detachElement(owner.id, strategy.id)).toHaveProperty("data");
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: strategy.id,
					data: { inSandbox: false },
				},
			],
		});

		expect(response.status).toBe(400);
		expect((await stored(strategy.id))?.inSandbox).toBe(true);
	});

	it("refuses a new element that carries the flag", async () => {
		const { owner, testCase, goal } = await build();
		await mockAuth(owner.id, owner.username, owner.email);
		const newId = "11111111-1111-4111-8111-111111111111";

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "create",
					elementId: newId,
					parentId: goal.id,
					data: {
						id: newId,
						type: "STRATEGY",
						name: "S2",
						description: "New",
						inSandbox: true,
					},
				},
			],
		});

		expect(response.status).toBe(400);
		expect(
			await prisma.assuranceElement.findUnique({ where: { id: newId } })
		).toBeNull();
	});

	it("accepts the stored flag with another change", async () => {
		const { owner, testCase, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: strategy.id,
					data: { inSandbox: false, description: "Edited in a batch" },
				},
			],
		});

		expect(response.status).toBe(200);
		expect(await stored(strategy.id)).toMatchObject({
			inSandbox: false,
			description: "Edited in a batch",
		});
	});
});

describe("a null parentId on anything but a goal", () => {
	it("is refused by the general edit, which keeps the parent", async () => {
		const { owner, goal, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await putElement(strategy.id, { parentId: null });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"parentId cannot be cleared on the general edit; use the detach route"
		);
		expect((await stored(strategy.id))?.parentId).toBe(goal.id);
	});

	it("is refused by the batch, which keeps the parent", async () => {
		const { owner, testCase, goal, strategy } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: strategy.id,
					data: { parentId: null },
				},
			],
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			`parentId cannot be cleared in a batch; use the detach route (element ${strategy.id})`
		);
		expect((await stored(strategy.id))?.parentId).toBe(goal.id);
	});
});
