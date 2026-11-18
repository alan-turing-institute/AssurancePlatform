import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
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
 * Route-level tests for POST /api/elements/[id]/move: a move beneath the
 * element itself or one of its descendants answers 400, and who may move.
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

async function postMove(elementId: string, body: unknown) {
	const { POST } = await import("@/app/api/elements/[id]/move/route");
	const req = new NextRequest(
		`http://localhost:3000/api/elements/${elementId}/move`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await POST(req, { params: Promise.resolve({ id: elementId }) });
}

async function build() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
	});
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		parentId: goal.id,
	});
	const child = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		parentId: claim.id,
	});
	const other = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		parentId: goal.id,
	});
	return { owner, testCase, goal, claim, child, other };
}

const parentOf = async (id: string) =>
	(await prisma.assuranceElement.findUnique({ where: { id } }))?.parentId;

describe("POST /api/elements/[id]/move", () => {
	it("answers 400 for a move beneath the element's own child and keeps the parent", async () => {
		const { owner, goal, claim, child } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postMove(claim.id, { parentId: child.id });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"Cannot move element to one of its descendants"
		);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("answers 400 for a move beneath the element itself and keeps the parent", async () => {
		const { owner, goal, claim } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postMove(claim.id, { parentId: claim.id });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"Cannot set element as its own parent"
		);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("answers 400 for a strategy moved beneath itself and keeps the parent", async () => {
		const { owner, testCase, goal } = await build();
		const strategy = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			parentId: goal.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postMove(strategy.id, { parentId: strategy.id });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"Cannot set element as its own parent"
		);
		expect(await parentOf(strategy.id)).toBe(goal.id);
	});

	it("moves an element under a sibling", async () => {
		const { owner, claim, other } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postMove(claim.id, { parentId: other.id });

		expect(response.status).toBe(200);
		expect(await parentOf(claim.id)).toBe(other.id);
	});

	it("lets a person with a direct EDIT share refuse the loop with 400", async () => {
		const { owner, testCase, goal, claim, child } = await build();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const response = await postMove(claim.id, { parentId: child.id });

		expect(response.status).toBe(400);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("lets a member of a team with an EDIT share refuse the loop with 400", async () => {
		const { owner, testCase, goal, claim, child } = await build();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "MEMBER");
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(member.id, member.username, member.email);

		const response = await postMove(claim.id, { parentId: child.id });

		expect(response.status).toBe(400);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("answers 404 to a person with only a VIEW share and moves nothing", async () => {
		const { owner, testCase, goal, claim, other } = await build();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await postMove(claim.id, { parentId: other.id });

		expect(response.status).toBe(404);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("answers 401 when signed out and moves nothing", async () => {
		const { goal, claim, other } = await build();

		const response = await postMove(claim.id, { parentId: other.id });

		expect(response.status).toBe(401);
		expect(await parentOf(claim.id)).toBe(goal.id);
	});

	it("answers 404 for a missing element", async () => {
		const { owner, other } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postMove(MISSING_ID, { parentId: other.id });

		expect(response.status).toBe(404);
	});
});
