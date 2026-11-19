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
 * Evidence hangs from claims through links, never through parentId, so the
 * general edit refuses a parentId on evidence instead of failing in the
 * database.
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

async function linkedEvidence() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
	});
	const evidence = await createTestElement(testCase.id, owner.id, {
		elementType: "EVIDENCE",
		name: "E1",
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: evidence.id, claimId: claim.id },
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase, claim, evidence };
}

describe("PUT /api/elements/[id] — a parentId on evidence", () => {
	it("answers 400 for a claim as parent and leaves the links alone", async () => {
		const { claim, evidence } = await linkedEvidence();

		const response = await putElement(evidence.id, { parentId: claim.id });

		expect(response.status).toBe(400);
		const links = await prisma.evidenceLink.findMany({
			where: { evidenceId: evidence.id },
		});
		expect(links.map((l) => l.claimId)).toEqual([claim.id]);
	});

	it("answers 400 for parentId null", async () => {
		const { evidence } = await linkedEvidence();

		const response = await putElement(evidence.id, { parentId: null });

		expect(response.status).toBe(400);
	});

	it("still answers 404 for a parentId in another case", async () => {
		const { owner, evidence } = await linkedEvidence();
		const otherCase = await createTestCase(owner.id);
		const foreign = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
		});

		const response = await putElement(evidence.id, { parentId: foreign.id });

		expect(response.status).toBe(404);
	});
});

describe("POST /api/cases/[id]/batch — a null parentId on evidence", () => {
	it("answers 400 and keeps the links", async () => {
		const { testCase, claim, evidence } = await linkedEvidence();

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { parentId: null },
				},
			],
		});

		expect(response.status).toBe(400);
		const links = await prisma.evidenceLink.findMany({
			where: { evidenceId: evidence.id, claimId: claim.id },
		});
		expect(links).toHaveLength(1);
	});
});

describe("POST /api/cases/[id]/batch — a parentId on evidence", () => {
	it("answers 400 and changes nothing", async () => {
		const { testCase, claim, evidence } = await linkedEvidence();

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { parentId: claim.id },
				},
			],
		});

		expect(response.status).toBe(400);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(row?.parentId).toBeNull();
	});
});
