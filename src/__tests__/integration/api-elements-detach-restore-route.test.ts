import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
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
 * Who may detach an element or restore a deleted one, and what the restore
 * route announces. Both routes answer a person without access the same way as
 * a missing element.
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
	vi.mocked(emitSSEEvent).mockClear();
});

function post(url: string) {
	return new NextRequest(`http://localhost:3000${url}`, { method: "POST" });
}

async function postDetach(id: string) {
	const { POST } = await import("@/app/api/elements/[id]/detach/route");
	return POST(post(`/api/elements/${id}/detach`), {
		params: Promise.resolve({ id }),
	});
}

async function postRestore(id: string) {
	const { POST } = await import("@/app/api/elements/[id]/restore/route");
	return POST(post(`/api/elements/${id}/restore`), {
		params: Promise.resolve({ id }),
	});
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

const storedState = (id: string) =>
	prisma.assuranceElement.findUnique({
		where: { id },
		select: { inSandbox: true, deletedAt: true },
	});

describe("POST /api/elements/[id]/detach permissions", () => {
	it("answers 401 when signed out and detaches nothing", async () => {
		const { strategy } = await build();

		const response = await postDetach(strategy.id);

		expect(response.status).toBe(401);
		expect((await storedState(strategy.id))?.inSandbox).toBe(false);
	});

	it("lets a person with a direct EDIT share detach", async () => {
		const { owner, testCase, strategy } = await build();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const response = await postDetach(strategy.id);

		expect(response.status).toBe(200);
		expect((await storedState(strategy.id))?.inSandbox).toBe(true);
	});

	it("lets a member of a team with an EDIT share detach", async () => {
		const { owner, testCase, strategy } = await build();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id, "MEMBER");
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(member.id, member.username, member.email);

		const response = await postDetach(strategy.id);

		expect(response.status).toBe(200);
		expect((await storedState(strategy.id))?.inSandbox).toBe(true);
	});
});

describe("POST /api/elements/[id]/restore", () => {
	async function buildDeleted() {
		const world = await build();
		await prisma.assuranceElement.update({
			where: { id: world.strategy.id },
			data: { deletedAt: new Date(), deletedById: world.owner.id },
		});
		return world;
	}

	it("answers 404 for an element that does not exist", async () => {
		const { owner } = await build();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postRestore(crypto.randomUUID());

		expect(response.status).toBe(404);
	});

	it("answers 404 to a signed-in stranger and restores nothing", async () => {
		const { strategy } = await buildDeleted();
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await postRestore(strategy.id);

		expect(response.status).toBe(404);
		expect((await storedState(strategy.id))?.deletedAt).not.toBeNull();
	});

	it("answers 404 to a person with only a VIEW share and restores nothing", async () => {
		const { owner, testCase, strategy } = await buildDeleted();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const response = await postRestore(strategy.id);

		expect(response.status).toBe(404);
		expect((await storedState(strategy.id))?.deletedAt).not.toBeNull();
	});

	it("announces the name the element carries after a rename on restore", async () => {
		const { owner, testCase, goal, strategy } = await buildDeleted();
		await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: goal.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postRestore(strategy.id);

		expect(response.status).toBe(200);
		const restored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: strategy.id },
			select: { name: true },
		});
		expect(restored.name).not.toBe("S1");
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"element:restored",
			testCase.id,
			expect.objectContaining({ elementName: restored.name })
		);
	});
});
