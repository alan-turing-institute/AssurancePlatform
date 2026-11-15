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
 * Detaching a piece of evidence removes its links to every claim; attaching
 * it back links it to the chosen claim and no longer writes parentId.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => {
	await mockNoAuth();
});

async function postAttach(elementId: string, body: unknown) {
	const { POST } = await import("@/app/api/elements/[id]/attach/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/elements/${elementId}/attach`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

async function postDetach(elementId: string) {
	const { POST } = await import("@/app/api/elements/[id]/detach/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/elements/${elementId}/detach`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

async function world() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
	});
	const claimA = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
	});
	const claimB = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: goal.id,
	});
	const evidence = await createTestElement(testCase.id, owner.id, {
		elementType: "EVIDENCE",
		name: "E1",
	});
	await prisma.evidenceLink.createMany({
		data: [
			{ evidenceId: evidence.id, claimId: claimA.id },
			{ evidenceId: evidence.id, claimId: claimB.id },
		],
	});
	return { owner, testCase, goal, claimA, claimB, evidence };
}

const linksOf = (evidenceId: string) =>
	prisma.evidenceLink.findMany({ where: { evidenceId } });

describe("POST /api/elements/[id]/detach — evidence", () => {
	it("moves the evidence to the side area and removes every link", async () => {
		const { owner, evidence } = await world();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postDetach(evidence.id);

		expect(response.status).toBe(200);
		expect(await linksOf(evidence.id)).toHaveLength(0);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(row?.inSandbox).toBe(true);
		expect(row?.parentId).toBeNull();
	});

	it("leaves a link of other evidence on the same claim", async () => {
		const { owner, testCase, claimA, evidence } = await world();
		const other = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			name: "E2",
		});
		await prisma.evidenceLink.create({
			data: { evidenceId: other.id, claimId: claimA.id },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		await postDetach(evidence.id);

		expect(await linksOf(other.id)).toHaveLength(1);
	});
});

describe("POST /api/elements/[id]/attach — evidence", () => {
	it("links the detached evidence to the chosen claim only and clears the side-area flag", async () => {
		const { owner, claimA, claimB, evidence } = await world();
		await mockAuth(owner.id, owner.username, owner.email);
		await postDetach(evidence.id);

		const response = await postAttach(evidence.id, { parentId: claimB.id });

		expect(response.status).toBe(200);
		const links = await linksOf(evidence.id);
		expect(links.map((l) => l.claimId)).toEqual([claimB.id]);
		expect(links.map((l) => l.claimId)).not.toContain(claimA.id);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(row?.inSandbox).toBe(false);
		expect(row?.parentId).toBeNull();
	});

	it("does not duplicate a link that already exists", async () => {
		const { owner, claimA, evidence } = await world();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(evidence.id, { parentId: claimA.id });

		expect(response.status).toBe(200);
		expect(await linksOf(evidence.id)).toHaveLength(2);
	});

	it("answers 400 for a goal as parent and changes nothing", async () => {
		const { owner, goal, evidence } = await world();
		await mockAuth(owner.id, owner.username, owner.email);
		await postDetach(evidence.id);

		const response = await postAttach(evidence.id, { parentId: goal.id });

		expect(response.status).toBe(400);
		expect(await linksOf(evidence.id)).toHaveLength(0);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(row?.inSandbox).toBe(true);
	});

	it("answers 200 for a user with EDIT access through a direct share", async () => {
		const { owner, testCase, claimB, evidence } = await world();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(owner.id, owner.username, owner.email);
		await postDetach(evidence.id);
		await mockAuth(editor.id, editor.username, editor.email);

		const response = await postAttach(evidence.id, { parentId: claimB.id });

		expect(response.status).toBe(200);
		expect(await linksOf(evidence.id)).toHaveLength(1);
	});

	it("answers 200 for a user with EDIT access through a team", async () => {
		const { owner, testCase, claimB, evidence } = await world();
		const member = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, member.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
		await mockAuth(owner.id, owner.username, owner.email);
		await postDetach(evidence.id);
		await mockAuth(member.id, member.username, member.email);

		const response = await postAttach(evidence.id, { parentId: claimB.id });

		expect(response.status).toBe(200);
		expect(await linksOf(evidence.id)).toHaveLength(1);
	});

	it("answers 404 for a user with no access and writes nothing", async () => {
		const { owner, claimB, evidence } = await world();
		const stranger = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);
		await postDetach(evidence.id);
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const response = await postAttach(evidence.id, { parentId: claimB.id });

		expect(response.status).toBe(404);
		expect(await linksOf(evidence.id)).toHaveLength(0);
	});

	it("answers 401 with no session", async () => {
		const { claimB, evidence } = await world();

		const response = await postAttach(evidence.id, { parentId: claimB.id });

		expect(response.status).toBe(401);
	});

	it("answers 404 for a missing element", async () => {
		const { owner, claimB } = await world();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(NONEXISTENT_ID, { parentId: claimB.id });

		expect(response.status).toBe(404);
	});
});
